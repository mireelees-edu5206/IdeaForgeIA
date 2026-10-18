"""Normalización de URLs para deduplicar fuentes dentro de un proyecto."""

from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.modules.research.models import SourceType

MAX_URL_LENGTH = 2048
_TRACKING_PARAMS = {"gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid"}


@dataclass(frozen=True, slots=True)
class NormalizedUrl:
    url: str  # la original (limpia de espacios)
    canonical: str
    domain: str  # host sin "www."


def normalize_url(raw: str) -> NormalizedUrl | None:
    """Devuelve None si no es una URL http(s) válida (se descarta la fuente)."""
    url = raw.strip()
    if not url or len(url) > MAX_URL_LENGTH:
        return None
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower().rstrip(".")
        port = parts.port
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not host or "." not in host:
        return None
    if parts.username or parts.password:
        return None
    domain = host.removeprefix("www.")
    netloc = domain if port in (None, 80, 443) else f"{domain}:{port}"
    path = parts.path.rstrip("/") or "/"
    query = urlencode(
        sorted(
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAMS
        )
    )
    # http/https y con/sin "www." se consideran la misma fuente; el fragmento (#) no cuenta.
    canonical = urlunsplit(("https", netloc, path, query, ""))
    return NormalizedUrl(url=url, canonical=canonical, domain=domain)


def guess_source_type(domain: str) -> SourceType:
    """Clasificación mínima por dominio; la Fase 10 podrá refinarla con la IA."""
    labels = domain.split(".")
    if any(label in ("gov", "gob", "gouv", "mil") for label in labels[-3:]):
        return SourceType.GOVERNMENT
    if any(label in ("edu", "ac") for label in labels[-3:]):
        return SourceType.ACADEMIC
    return SourceType.UNKNOWN
