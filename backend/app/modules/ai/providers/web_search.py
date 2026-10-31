"""Búsqueda web pública gratuita y síntesis fundamentada con citas verificables."""

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

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

_RESULT_BLOCK_RE = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
    r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
    re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass(frozen=True, slots=True)
class WebHit:
    """Representa web hit."""

    url: str
    title: str
    snippet: str


class _CitedStatement(BaseModel):
    """Representa cited statement."""

    statement: str = Field(min_length=15, max_length=600)
    source_indexes: list[int] = Field(min_length=1, max_length=4)


class _SynthesizedAnswer(BaseModel):
    """Representa synthesized answer."""

    statements: list[_CitedStatement] = Field(min_length=1, max_length=6)


def extract_question(messages: Sequence[AIMessage]) -> str:
    """Extrae question."""
    user_text = next((m.content for m in reversed(messages) if m.role == "user"), "").strip()
    # Rama condicional: se cumple not user_text.
    if not user_text:
        return ""
    first_line = user_text.splitlines()[0].strip()
    return first_line or user_text[:200]


def _clean_html(raw: str) -> str:
    """Gestiona clean html."""
    text = html.unescape(_TAG_RE.sub(" ", raw))
    return " ".join(text.split())


def _resolve_ddg_url(href: str) -> str | None:
    """Resuelve ddg URL."""
    candidate = html.unescape(href).strip()
    # Rama condicional: se cumple candidate.startswith('//').
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    parsed = urlparse(candidate)
    # Rama condicional: se cumple 'duckduckgo.com' in parsed.netloc.
    if "duckduckgo.com" in parsed.netloc:
        # Rama condicional: se cumple parsed.path.startswith('/y.js').
        if parsed.path.startswith("/y.js"):
            return None
        qs = parse_qs(parsed.query)
        uddg = qs.get("uddg", [None])[0]
        # Rama condicional: se cumple not uddg.
        if not uddg:
            return None
        candidate = unquote(uddg).strip()
    # Rama condicional: se cumple not candidate.startswith(('https://', 'http://')).
    if not candidate.startswith(("https://", "http://")):
        return None
    host = urlparse(candidate).netloc.lower()
    # Rama condicional: se cumple not host or 'duckduckgo.com' in host.
    if not host or "duckduckgo.com" in host:
        return None
    return candidate


def _search_duckduckgo_sync(query: str, timeout: float, limit: int = 6) -> list[WebHit]:
    """Gestiona busqueda duckduckgo sync."""
    url = "https://html.duckduckgo.com/html/?" + urlencode({"q": query, "kl": "mx-es"})
    req = Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.7",
        },
    )
    # Abre y libera los recursos declarados en este bloque.
    with urlopen(req, timeout=min(timeout, 15.0)) as response:
        body = response.read().decode("utf-8", errors="ignore")

    hits: list[WebHit] = []
    seen_urls: set[str] = set()
    # Itera (raw_href, raw_title, raw_snippet) sobre _RESULT_BLOCK_RE.findall(body).
    for raw_href, raw_title, raw_snippet in _RESULT_BLOCK_RE.findall(body):
        resolved = _resolve_ddg_url(raw_href)
        # Rama condicional: se cumple not resolved or resolved in seen_urls.
        if not resolved or resolved in seen_urls:
            continue
        title = _clean_html(raw_title)
        snippet = _clean_html(raw_snippet)
        # Rama condicional: se cumple not title or len(snippet) < 25.
        if not title or len(snippet) < 25:
            continue
        seen_urls.add(resolved)
        hits.append(WebHit(url=resolved, title=title[:200], snippet=snippet[:420]))
        # Rama condicional: se cumple len(hits) >= limit.
        if len(hits) >= limit:
            break
    return hits


def _search_wikipedia_sync(query: str, timeout: float, limit: int = 5) -> list[WebHit]:
    """Gestiona busqueda wikipedia sync."""
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
    # Abre y libera los recursos declarados en este bloque.
    with urlopen(req, timeout=min(timeout, 12.0)) as response:
        payload: dict[str, Any] = json.loads(response.read().decode("utf-8", errors="ignore"))
    items = payload.get("query", {}).get("search", [])
    hits: list[WebHit] = []
    # Rama condicional: se cumple not isinstance(items, list).
    if not isinstance(items, list):
        return hits
    # Itera item sobre items.
    for item in items:
        # Rama condicional: se cumple not isinstance(item, dict).
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        snippet = _clean_html(str(item.get("snippet") or ""))
        # Rama condicional: se cumple not title or len(snippet) < 20.
        if not title or len(snippet) < 20:
            continue
        article_url = "https://es.wikipedia.org/wiki/" + title.replace(" ", "_")
        hits.append(WebHit(url=article_url, title=f"{title} - Wikipedia", snippet=snippet[:420]))
    return hits


async def search_public_web(query: str, timeout: float = 15.0, limit: int = 6) -> list[WebHit]:
    """Gestiona busqueda public web."""
    clean_query = " ".join(query.split()).strip()
    # Rama condicional: se cumple not clean_query.
    if not clean_query:
        return []
    hits: list[WebHit] = []
    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        hits = await asyncio.to_thread(_search_duckduckgo_sync, clean_query, timeout, limit)
    # Maneja el error (HTTPError, URLError, TimeoutError, OSError) sin detener el flujo esperado.
    except (HTTPError, URLError, TimeoutError, OSError):
        hits = []
    # Rama condicional: se cumple len(hits) < 2.
    if len(hits) < 2:
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            wiki_hits = await asyncio.to_thread(_search_wikipedia_sync, clean_query, timeout, limit)
            seen = {hit.url for hit in hits}
            # Itera wiki_hit sobre wiki_hits.
            for wiki_hit in wiki_hits:
                # Rama condicional: se cumple wiki_hit.url not in seen.
                if wiki_hit.url not in seen:
                    hits.append(wiki_hit)
                    # Rama condicional: se cumple len(hits) >= limit.
                    if len(hits) >= limit:
                        break
        # Maneja el error (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) sin
        # detener el flujo esperado.
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            pass
    return hits


def _build_grounded_result(
    hits: Sequence[WebHit],
    statements: Sequence[tuple[str, tuple[int, ...]]],
    query: str,
    provider: AIProvider,
    usage: AIUsage,
) -> GroundedResult:
    """Construye fundamentada resultado."""
    parts: list[str] = []
    citations: list[CitationSpan] = []
    cited_sources: set[int] = set()
    cursor = 0

    # Itera (statement_text, indexes) sobre statements.
    for statement_text, indexes in statements:
        clean_statement = " ".join(statement_text.split()).strip()
        # Rama condicional: se cumple not clean_statement or not indexes.
        if not clean_statement or not indexes:
            continue
        # Rama condicional: se cumple parts.
        if parts:
            parts.append("\n\n")
            cursor += 2
        start = cursor
        parts.append(clean_statement)
        cursor += len(clean_statement)
        citations.append(CitationSpan(start=start, end=cursor, source_indexes=indexes))
        cited_sources.update(indexes)

    # Rama condicional: se cumple not parts or not citations.
    if not parts or not citations:
        raise AIGroundingUnavailableError()

    sources = [
        GroundedSource(url=hit.url, title=hit.title, cited=index in cited_sources)
        for index, hit in enumerate(hits)
    ]
    return GroundedResult(
        text="".join(parts),
        sources=sources,
        citations=citations,
        executed_queries=[query],
        search_suggestions_html=None,
        usage=replace(usage, search_queries_count=1),
        provider=provider.name,
        model=provider.model,
    )


def _extractive_fallback_statements(hits: Sequence[WebHit]) -> list[tuple[str, tuple[int, ...]]]:
    """Gestiona extractive respaldo statements."""
    statements: list[tuple[str, tuple[int, ...]]] = []
    # Itera (index, hit) sobre enumerate(hits[:4]).
    for index, hit in enumerate(hits[:4]):
        sentence = f"Según {hit.title}: {hit.snippet}"
        # Rama condicional: se cumple not sentence.endswith('.').
        if not sentence.endswith("."):
            sentence += "."
        statements.append((sentence, (index,)))
    return statements


async def synthesize_grounded_from_web(
    provider: AIProvider,
    messages: Sequence[AIMessage],
    timeout: float,
) -> GroundedResult:
    """Gestiona synthesize fundamentada from web."""
    question = extract_question(messages)
    hits = await search_public_web(question, timeout=timeout)
    # Rama condicional: se cumple not hits.
    if not hits:
        error = AIGroundingUnavailableError()
        error.provider = provider.name
        error.model = provider.model
        raise error

    sources_block = "\n".join(
        f"[{idx}] Título: {hit.title}\nURL: {hit.url}\nFragmento: {hit.snippet}"
        for idx, hit in enumerate(hits)
    )
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
    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        structured = await provider.generate_structured(synthesis_messages, _SynthesizedAnswer)
        usage = structured.usage
        # Itera item sobre structured.data.statements.
        for item in structured.data.statements:
            valid_indexes = tuple(
                dict.fromkeys(idx for idx in item.source_indexes if 0 <= idx < len(hits))
            )
            # Rama condicional: se cumple valid_indexes.
            if valid_indexes:
                statements.append((item.statement, valid_indexes))
    # Maneja el error AIProviderError sin detener el flujo esperado.
    except AIProviderError:
        statements = []

    # Rama condicional: se cumple not statements.
    if not statements:
        statements = _extractive_fallback_statements(hits)

    # Protege la operacion y dirige sus errores a manejadores explicitos.
    try:
        return _build_grounded_result(hits, statements, question, provider, usage)
    # Maneja el error AIGroundingUnavailableError sin detener el flujo esperado.
    except AIGroundingUnavailableError as exc:
        exc.provider = provider.name
        exc.model = provider.model
        raise
