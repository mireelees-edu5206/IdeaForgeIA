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
    url: str
    title: str
    snippet: str


class _CitedStatement(BaseModel):
    statement: str = Field(min_length=15, max_length=600)
    source_indexes: list[int] = Field(min_length=1, max_length=4)


class _SynthesizedAnswer(BaseModel):
    statements: list[_CitedStatement] = Field(min_length=1, max_length=6)


def extract_question(messages: Sequence[AIMessage]) -> str:
    user_text = next((m.content for m in reversed(messages) if m.role == "user"), "").strip()
    if not user_text:
        return ""
    first_line = user_text.splitlines()[0].strip()
    return first_line or user_text[:200]


def _clean_html(raw: str) -> str:
    text = html.unescape(_TAG_RE.sub(" ", raw))
    return " ".join(text.split())


def _resolve_ddg_url(href: str) -> str | None:
    candidate = html.unescape(href).strip()
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    parsed = urlparse(candidate)
    if "duckduckgo.com" in parsed.netloc:
        if parsed.path.startswith("/y.js"):
            return None
        qs = parse_qs(parsed.query)
        uddg = qs.get("uddg", [None])[0]
        if not uddg:
            return None
        candidate = unquote(uddg).strip()
    if not candidate.startswith(("https://", "http://")):
        return None
    host = urlparse(candidate).netloc.lower()
    if not host or "duckduckgo.com" in host:
        return None
    return candidate


def _search_duckduckgo_sync(query: str, timeout: float, limit: int = 6) -> list[WebHit]:
    url = "https://html.duckduckgo.com/html/?" + urlencode({"q": query, "kl": "mx-es"})
    req = Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.7",
        },
    )
    with urlopen(req, timeout=min(timeout, 15.0)) as response:
        body = response.read().decode("utf-8", errors="ignore")

    hits: list[WebHit] = []
    seen_urls: set[str] = set()
    for raw_href, raw_title, raw_snippet in _RESULT_BLOCK_RE.findall(body):
        resolved = _resolve_ddg_url(raw_href)
        if not resolved or resolved in seen_urls:
            continue
        title = _clean_html(raw_title)
        snippet = _clean_html(raw_snippet)
        if not title or len(snippet) < 25:
            continue
        seen_urls.add(resolved)
        hits.append(WebHit(url=resolved, title=title[:200], snippet=snippet[:420]))
        if len(hits) >= limit:
            break
    return hits


def _search_wikipedia_sync(query: str, timeout: float, limit: int = 5) -> list[WebHit]:
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
    with urlopen(req, timeout=min(timeout, 12.0)) as response:
        payload: dict[str, Any] = json.loads(response.read().decode("utf-8", errors="ignore"))
    items = payload.get("query", {}).get("search", [])
    hits: list[WebHit] = []
    if not isinstance(items, list):
        return hits
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        snippet = _clean_html(str(item.get("snippet") or ""))
        if not title or len(snippet) < 20:
            continue
        article_url = "https://es.wikipedia.org/wiki/" + title.replace(" ", "_")
        hits.append(WebHit(url=article_url, title=f"{title} - Wikipedia", snippet=snippet[:420]))
    return hits


async def search_public_web(query: str, timeout: float = 15.0, limit: int = 6) -> list[WebHit]:
    clean_query = " ".join(query.split()).strip()
    if not clean_query:
        return []
    hits: list[WebHit] = []
    try:
        hits = await asyncio.to_thread(_search_duckduckgo_sync, clean_query, timeout, limit)
    except (HTTPError, URLError, TimeoutError, OSError):
        hits = []
    if len(hits) < 2:
        try:
            wiki_hits = await asyncio.to_thread(_search_wikipedia_sync, clean_query, timeout, limit)
            seen = {hit.url for hit in hits}
            for wiki_hit in wiki_hits:
                if wiki_hit.url not in seen:
                    hits.append(wiki_hit)
                    if len(hits) >= limit:
                        break
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
    parts: list[str] = []
    citations: list[CitationSpan] = []
    cited_sources: set[int] = set()
    cursor = 0

    for statement_text, indexes in statements:
        clean_statement = " ".join(statement_text.split()).strip()
        if not clean_statement or not indexes:
            continue
        if parts:
            parts.append("\n\n")
            cursor += 2
        start = cursor
        parts.append(clean_statement)
        cursor += len(clean_statement)
        citations.append(CitationSpan(start=start, end=cursor, source_indexes=indexes))
        cited_sources.update(indexes)

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
    statements: list[tuple[str, tuple[int, ...]]] = []
    for index, hit in enumerate(hits[:4]):
        sentence = f"Según {hit.title}: {hit.snippet}"
        if not sentence.endswith("."):
            sentence += "."
        statements.append((sentence, (index,)))
    return statements


async def synthesize_grounded_from_web(
    provider: AIProvider,
    messages: Sequence[AIMessage],
    timeout: float,
) -> GroundedResult:
    question = extract_question(messages)
    hits = await search_public_web(question, timeout=timeout)
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
    try:
        structured = await provider.generate_structured(synthesis_messages, _SynthesizedAnswer)
        usage = structured.usage
        for item in structured.data.statements:
            valid_indexes = tuple(
                dict.fromkeys(idx for idx in item.source_indexes if 0 <= idx < len(hits))
            )
            if valid_indexes:
                statements.append((item.statement, valid_indexes))
    except AIProviderError:
        statements = []

    if not statements:
        statements = _extractive_fallback_statements(hits)

    try:
        return _build_grounded_result(hits, statements, question, provider, usage)
    except AIGroundingUnavailableError as exc:
        exc.provider = provider.name
        exc.model = provider.model
        raise
