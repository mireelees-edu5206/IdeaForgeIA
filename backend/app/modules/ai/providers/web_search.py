"""Búsqueda web pública gratuita y síntesis fundamentada con citas verificables.

ARCHIVO: backend/app/modules/ai/providers/web_search.py

¿Qué es?
Un plan de respaldo para buscar en internet sin pagar una API de búsqueda. Consulta DuckDuckGo
(versión HTML) y, si hay pocos resultados, Wikipedia en español. Después pide a la IA que
redacte afirmaciones usando solo esos fragmentos, cada una con el número de fuente que la respalda.

¿Para qué sirve?
Se usa cuando Gemini responde 429 (límite de uso) o cuando Ollama necesita buscar. Así la
investigación no se detiene.

¿Quién lo usa?
gemini.py (en generate_grounded, si hay 429) y ollama.py (en generate_grounded).

Reglas de seguridad:
- Solo se aceptan enlaces http o https; los enlaces internos de DuckDuckGo se descartan.
- Si la IA no logra citar nada válido, se usa un resumen extractivo: frases tomadas directamente
  de los fragmentos encontrados, nunca texto inventado.
- Si no hay ningún resultado, se lanza AIGroundingUnavailableError en lugar de inventar fuentes.
"""

import asyncio
import html
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

from app.modules.ai.errors import AIGroundingUnavailableError, AIProviderError
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import (
    AIMessage,
    AIUsage,
    CitationSpan,
    GroundedResult,
    GroundedSource,
)

# Identificación de navegador normal. Algunos sitios bloquean peticiones sin ella.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

# Busca, en el HTML de DuckDuckGo, cada resultado: su enlace, su título y su resumen.
_RESULT_BLOCK_RE = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
    r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
    re.DOTALL,
)
# Cualquier etiqueta HTML, por ejemplo <b> o </a>. Sirve para quitarlas del texto.
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass(frozen=True, slots=True)
class WebHit:
    """Un resultado de búsqueda: su dirección, su título y un fragmento de texto."""

    url: str
    title: str
    snippet: str


class _CitedStatement(BaseModel):
    """Una afirmación que devuelve la IA, con los números de las fuentes que la respaldan."""

    # Entre 15 y 600 caracteres. Muy corta no dice nada; muy larga se sale del formato.
    statement: str = Field(min_length=15, max_length=600)
    # Entre 1 y 4 fuentes por afirmación.
    source_indexes: list[int] = Field(min_length=1, max_length=4)


class _SynthesizedAnswer(BaseModel):
    """La respuesta completa de la IA: una lista de 1 a 6 afirmaciones citadas."""

    statements: list[_CitedStatement] = Field(min_length=1, max_length=6)


def extract_question(messages: Sequence[AIMessage]) -> str:
    """Saca la pregunta del último mensaje de la persona.

    Toma la primera línea del último mensaje "user". Si esa línea está vacía, usa los
    primeros 200 caracteres del mensaje. Si no hay mensaje de usuario, devuelve "".
    """
    # "reversed" recorre los mensajes del último al primero y toma el primer "user" que encuentre.
    user_text = next((m.content for m in reversed(messages) if m.role == "user"), "").strip()
    if not user_text:
        return ""
    first_line = user_text.splitlines()[0].strip()
    return first_line or user_text[:200]


def _clean_html(raw: str) -> str:
    """Quita las etiquetas HTML de un texto y deja solo las palabras con espacios normales."""
    # Primero se borran las etiquetas, luego se traducen los códigos como &amp; a su letra.
    text = html.unescape(_TAG_RE.sub(" ", raw))
    # "split()" separa por cualquier espacio; "join" los vuelve a unir con un solo espacio.
    return " ".join(text.split())


def _resolve_ddg_url(href: str) -> str | None:
    """Convierte el enlace de un resultado de DuckDuckGo en la dirección real de la página.

    DuckDuckGo envuelve los enlaces así: duckduckgo.com/l/?uddg=<direccion real>.
    Si el enlace no es una página externa válida, devuelve None.
    """
    candidate = html.unescape(href).strip()
    # Un enlace que empieza con "//" no tiene protocolo; se le agrega https:.
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    parsed = urlparse(candidate)
    # Si el enlace apunta a DuckDuckGo, hay que sacar la dirección real del parámetro "uddg".
    if "duckduckgo.com" in parsed.netloc:
        # Los enlaces a /y.js son anuncios: se descartan.
        if parsed.path.startswith("/y.js"):
            return None
        qs = parse_qs(parsed.query)
        uddg = qs.get("uddg", [None])[0]
        if not uddg:
            return None
        # "unquote" convierte %3A%2F%2F en ://.
        candidate = unquote(uddg).strip()
    # Solo se aceptan direcciones http o https.
    if not candidate.startswith(("https://", "http://")):
        return None
    host = urlparse(candidate).netloc.lower()
    # Se descarta si no tiene dominio o si todavía apunta a DuckDuckGo.
    if not host or "duckduckgo.com" in host:
        return None
    return candidate


def _search_duckduckgo_sync(query: str, timeout: float, limit: int = 6) -> list[WebHit]:
    """Busca en DuckDuckGo (versión HTML) de forma bloqueante y devuelve hasta `limit` resultados.

    Usa "es-MX" como región para obtener resultados en español de México.
    """
    url = "https://html.duckduckgo.com/html/?" + urlencode({"q": query, "kl": "mx-es"})
    req = Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.7",
        },
    )
    # El tiempo máximo de espera nunca pasa de 15 segundos, aunque se pida más.
    with urlopen(req, timeout=min(timeout, 15.0)) as response:
        # "errors=ignore" descarta bytes que no se puedan leer en UTF-8, en vez de fallar.
        body = response.read().decode("utf-8", errors="ignore")

    hits: list[WebHit] = []
    # Evita repetir la misma dirección dos veces.
    seen_urls: set[str] = set()
    # findall devuelve una tupla (enlace, título, resumen) por cada resultado encontrado.
    for raw_href, raw_title, raw_snippet in _RESULT_BLOCK_RE.findall(body):
        resolved = _resolve_ddg_url(raw_href)
        # Se salta el resultado si el enlace no sirve o ya lo tenemos.
        if not resolved or resolved in seen_urls:
            continue
        title = _clean_html(raw_title)
        snippet = _clean_html(raw_snippet)
        # Un resultado sin título o con un resumen muy corto no aporta nada útil.
        if not title or len(snippet) < 25:
            continue
        seen_urls.add(resolved)
        # El título se corta a 200 letras y el resumen a 420, para no saturar el mensaje a la IA.
        hits.append(WebHit(url=resolved, title=title[:200], snippet=snippet[:420]))
        if len(hits) >= limit:
            break
    return hits


def _search_wikipedia_sync(query: str, timeout: float, limit: int = 5) -> list[WebHit]:
    """Busca en Wikipedia en español de forma bloqueante y devuelve hasta `limit` artículos."""
    # Parámetros de la API de búsqueda de Wikipedia.
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "utf8": "1",
        "format": "json",
        "srlimit": str(limit),
    }
    url = "https://es.wikipedia.org/w/api.php?" + urlencode(params)
    req = Request(url, headers={"User-Agent": _USER_AGENT})
    # Wikipedia responde más rápido, así que el límite de espera es de 12 segundos.
    with urlopen(req, timeout=min(timeout, 12.0)) as response:
        payload: dict[str, Any] = json.loads(response.read().decode("utf-8", errors="ignore"))
    # Si la respuesta no trae la lista de resultados, se usa una lista vacía.
    items = payload.get("query", {}).get("search", [])
    hits: list[WebHit] = []
    if not isinstance(items, list):
        return hits
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        snippet = _clean_html(str(item.get("snippet") or ""))
        # Se pide un título y un resumen de al menos 20 letras.
        if not title or len(snippet) < 20:
            continue
        # La dirección del artículo se arma con el título.
        # Los espacios se cambian por guiones bajos, como en Wikipedia.
        article_url = "https://es.wikipedia.org/wiki/" + title.replace(" ", "_")
        hits.append(WebHit(url=article_url, title=f"{title} - Wikipedia", snippet=snippet[:420]))
    return hits


async def search_public_web(query: str, timeout: float = 15.0, limit: int = 6) -> list[WebHit]:
    """Busca en DuckDuckGo y, si salen menos de 2 resultados, completa con Wikipedia.

    Las búsquedas bloqueantes corren en otro hilo para no detener el servidor. Si una de ellas
    falla por red, se ignora y se usa la otra.
    """
    # Quita espacios sobrantes; si la pregunta queda vacía, no se busca nada.
    clean_query = " ".join(query.split()).strip()
    if not clean_query:
        return []
    hits: list[WebHit] = []
    try:
        hits = await asyncio.to_thread(_search_duckduckgo_sync, clean_query, timeout, limit)
    except (HTTPError, URLError, TimeoutError, OSError):
        hits = []
    # Con menos de 2 resultados de DuckDuckGo, se intenta completar con Wikipedia.
    if len(hits) < 2:
        try:
            wiki_hits = await asyncio.to_thread(_search_wikipedia_sync, clean_query, timeout, limit)
            # Conjunto de direcciones ya usadas, para no repetir un artículo.
            seen = {hit.url for hit in hits}
            for wiki_hit in wiki_hits:
                if wiki_hit.url not in seen:
                    hits.append(wiki_hit)
                    if len(hits) >= limit:
                        break
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            # Si Wikipedia también falla, nos quedamos con lo que ya tenemos.
            pass
    return hits


def _build_grounded_result(
    hits: Sequence[WebHit],
    statements: Sequence[tuple[str, tuple[int, ...]]],
    query: str,
    provider: AIProvider,
    usage: AIUsage,
) -> GroundedResult:
    """Arma el texto final con sus citas.

    Cada afirmación se pega al texto con dos saltos de línea entre ellas. Se guarda en qué
    posición de letras empieza y termina cada una, y qué fuentes la respaldan.
    """
    parts: list[str] = []
    citations: list[CitationSpan] = []
    cited_sources: set[int] = set()
    # "cursor" lleva la cuenta de cuántas letras llevamos en el texto armado.
    cursor = 0

    for statement_text, indexes in statements:
        # Limpia espacios sobrantes; una afirmación vacía o sin fuentes se salta.
        clean_statement = " ".join(statement_text.split()).strip()
        if not clean_statement or not indexes:
            continue
        # Entre afirmaciones se agregan dos saltos de línea, y el cursor avanza 2 letras.
        if parts:
            parts.append("\n\n")
            cursor += 2
        # La afirmación empieza donde está el cursor y termina cuando se le suman sus letras.
        start = cursor
        parts.append(clean_statement)
        cursor += len(clean_statement)
        citations.append(CitationSpan(start=start, end=cursor, source_indexes=indexes))
        cited_sources.update(indexes)

    # Si no quedó ninguna afirmación citada, no hay resultado que devolver.
    if not parts or not citations:
        raise AIGroundingUnavailableError()

    # Cada fuente se marca como citada solo si apareció en alguna afirmación.
    sources = [
        GroundedSource(url=hit.url, title=hit.title, cited=index in cited_sources)
        for index, hit in enumerate(hits)
    ]
    return GroundedResult(
        text="".join(parts),
        sources=sources,
        citations=citations,
        executed_queries=[query],
        # Esta ruta no genera sugerencias de búsqueda de Google, así que va vacío.
        search_suggestions_html=None,
        # "replace" copia el uso y cambia solo el número de búsquedas a 1.
        usage=replace(usage, search_queries_count=1),
        provider=provider.name,
        model=provider.model,
    )


def _extractive_fallback_statements(hits: Sequence[WebHit]) -> list[tuple[str, tuple[int, ...]]]:
    """Plan B sin IA: arma una frase por cada uno de los primeros 4 resultados.

    La frase solo repite el título y el resumen de la fuente. Así no se inventa nada.
    """
    statements: list[tuple[str, tuple[int, ...]]] = []
    # "hits[:4]" toma solo los primeros cuatro resultados.
    for index, hit in enumerate(hits[:4]):
        sentence = f"Según {hit.title}: {hit.snippet}"
        # La frase debe terminar con punto.
        if not sentence.endswith("."):
            sentence += "."
        # La fuente que la respalda es el propio resultado (su posición en la lista).
        statements.append((sentence, (index,)))
    return statements


async def synthesize_grounded_from_web(
    provider: AIProvider,
    messages: Sequence[AIMessage],
    timeout: float,
) -> GroundedResult:
    """Busca en la web, pide a la IA una síntesis citada y la valida contra las fuentes.

    Pasos:
    1. Busca la pregunta en DuckDuckGo y Wikipedia.
    2. Pide a la IA 2 a 4 afirmaciones, cada una con sus fuentes, usando solo los fragmentos.
    3. Descarta las fuentes que no existen (números fuera de rango).
    4. Si la IA falla o no devuelve nada válido, usa el plan B (frases tomadas de los resultados).
    """
    question = extract_question(messages)
    hits = await search_public_web(question, timeout=timeout)
    # Sin resultados no hay nada que citar: se avisa en lugar de inventar.
    if not hits:
        error = AIGroundingUnavailableError()
        error.provider = provider.name
        error.model = provider.model
        raise error

    # Lista numerada de las fuentes, que se le pasa a la IA para que cite por número.
    sources_block = "\n".join(
        f"[{idx}] Título: {hit.title}\nURL: {hit.url}\nFragmento: {hit.snippet}"
        for idx, hit in enumerate(hits)
    )
    # Instrucciones para la IA: solo puede usar las fuentes numeradas, sin inventar datos.
    synthesis_messages = [
        AIMessage(
            "system",
            (
                "Eres un analista de investigación riguroso. Responde la pregunta en español "
                "usando EXCLUSIVAMENTE los fragmentos web numerados [0..N]. "
                "Devuelve entre 2 y 4 afirmaciones verificables (statements), indicando en "
                "source_indexes los índices exactos [0..N] que respaldan cada afirmación. "
                "No inventes nombres, ubicación, fechas ni cifras que no aparezcan literalmente "
                "en un título o fragmento. No generalices un dato de una empresa a todo el "
                "mercado. Si un punto es inferencia tuya, inicia el enunciado con "
                "'Interpretación:'."
            ),
        ),
        AIMessage(
            "user",
            f"Pregunta: {question}\n\nFuentes web encontradas:\n{sources_block}",
        ),
    ]

    usage = AIUsage(search_queries_count=1)
    statements: list[tuple[str, tuple[int, ...]]] = []
    try:
        structured = await provider.generate_structured(synthesis_messages, _SynthesizedAnswer)
        usage = structured.usage
        for item in structured.data.statements:
            # Solo se aceptan índices que existan en la lista de fuentes.
            # "dict.fromkeys" quita repetidos y conserva el orden.
            valid_indexes = tuple(
                dict.fromkeys(idx for idx in item.source_indexes if 0 <= idx < len(hits))
            )
            if valid_indexes:
                statements.append((item.statement, valid_indexes))
    except AIProviderError:
        # Si la IA falla, seguimos con el plan B.
        statements = []

    # Si no quedó ninguna afirmación válida, usamos el plan B.
    if not statements:
        statements = _extractive_fallback_statements(hits)

    try:
        return _build_grounded_result(hits, statements, question, provider, usage)
    except AIGroundingUnavailableError as exc:
        # Se anota qué proveedor falló, para que la bitácora lo registre.
        exc.provider = provider.name
        exc.model = provider.model
        raise
