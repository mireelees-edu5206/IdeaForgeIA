"""Normalización de URLs para deduplicar fuentes dentro de un proyecto.

ARCHIVO: backend/app/modules/research/urls.py

¿Qué es?
Un limpiador de direcciones web. Convierte cada enlace en una forma estándar (canónica) para
saber cuándo dos enlaces son en realidad la misma página.

¿Para qué sirve?
Si la IA encuentra "https://www.ejemplo.com/nota/?utm_source=x" y después
"http://ejemplo.com/nota", son la misma fuente. Sin esta limpieza, el proyecto tendría dos
fuentes repetidas.

¿Qué hace al limpiar?
- Solo acepta http o https. Descarta enlaces con usuario y contraseña.
- Quita "www." y el puerto si es el normal (80 o 443).
- Quita el final "/" de la ruta y el #fragmento.
- Quita parámetros de rastreo como utm_* o fbclid, y ordena el resto.

¿Quién lo usa?
orchestrator.py (al guardar cada fuente) y las pruebas de URLs.

Cambios comunes:
- Parámetros que se consideran rastreo: _TRACKING_PARAMS.
- Tamaño máximo de un enlace: MAX_URL_LENGTH (2048 caracteres).
- Cómo se clasifica un dominio como gobierno o académico: guess_source_type.
"""

from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.modules.research.models import SourceType

# Un enlace más largo que esto se descarta.
MAX_URL_LENGTH = 2048
# Parámetros de rastreo que se quitan para no duplicar fuentes (publicidad y redes sociales).
_TRACKING_PARAMS = {"gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid"}


@dataclass(frozen=True, slots=True)
class NormalizedUrl:
    """El resultado de limpiar una dirección: la original, la canónica y el dominio."""

    url: str  # la original (limpia de espacios)
    canonical: str  # la forma estándar que se usa para comparar fuentes
    domain: str  # host sin "www."


def normalize_url(raw: str) -> NormalizedUrl | None:
    """Limpia un enlace.

    Devuelve None si no es una dirección http(s) válida. En ese caso la fuente se descarta.
    """
    url = raw.strip()
    # Vacío o demasiado largo: no se guarda.
    if not url or len(url) > MAX_URL_LENGTH:
        return None
    try:
        parts = urlsplit(url)
        # El host en minúsculas y sin el punto final que a veces trae.
        host = (parts.hostname or "").lower().rstrip(".")
        port = parts.port
    except ValueError:
        # Si el puerto o la dirección no se pueden leer, la URL no sirve.
        return None
    # Solo http o https, con un host que tenga punto (por ejemplo "ejemplo.com").
    if parts.scheme.lower() not in ("http", "https") or not host or "." not in host:
        return None
    # Las direcciones con usuario o contraseña no se guardan, por seguridad.
    if parts.username or parts.password:
        return None
    # Sin "www." el dominio queda limpio (ejemplo.com en lugar de www.ejemplo.com).
    domain = host.removeprefix("www.")
    # El puerto solo se conserva si no es el normal (80 para http, 443 para https).
    netloc = domain if port in (None, 80, 443) else f"{domain}:{port}"
    # Se quita el "/" final de la ruta. Si queda vacía, se usa "/".
    path = parts.path.rstrip("/") or "/"
    # Se dejan solo los parámetros que no son de rastreo, ordenados alfabéticamente.
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
    """Clasifica una fuente por su dominio: gobierno, académica o desconocida.

    Mira solo las últimas tres partes del dominio. Por ejemplo, "gob" en "economia.gob.mx"
    indica gobierno, y "edu" en "uni.edu.mx" indica académica.
    """
    labels = domain.split(".")
    # Terminaciones de gobierno en varios países: gov (EE. UU.), gob (México), gouv (Francia), mil.
    if any(label in ("gov", "gob", "gouv", "mil") for label in labels[-3:]):
        return SourceType.GOVERNMENT
    # Terminaciones académicas: edu (educación) y ac (académico, por ejemplo en Reino Unido).
    if any(label in ("edu", "ac") for label in labels[-3:]):
        return SourceType.ACADEMIC
    return SourceType.UNKNOWN
