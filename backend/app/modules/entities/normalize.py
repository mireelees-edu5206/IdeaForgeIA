"""Normalización de nombres de entidades para deduplicarlas dentro de un proyecto.

ARCHIVO: backend/app/modules/entities/normalize.py

¿Qué es?
Un limpiador de nombres. Convierte "Panadería El Trigo S.A. de C.V." y "panaderia el trigo" en
la misma forma, para saber que son la misma empresa.

¿Para qué sirve?
Para evitar duplicados. Sin esta limpieza, la misma empresa aparecería varias veces según cómo la
escribió cada fuente.

¿Qué hace?
- Pasa a minúsculas, quita acentos y cambia la puntuación por espacios.
- Quita los sufijos legales al final (S.A., S. de R.L., Inc., LLC, etc.).

¿Quién lo usa?
findings/extraction.py, entities/service.py, entities/repository.py y entities/schemas.py.
"""

import re
import unicodedata

# Sufijos legales habituales (se comparan ya sin puntos ni acentos).
# Los más largos van primero, para que se quiten completos.
_LEGAL_SUFFIXES = (
    "s a de c v",
    "s de r l de c v",
    "s de r l",
    "s a p i de c v",
    "s a s",
    "s a",
    "s l",
    "sas",
    "sa",
    "sl",
    "inc",
    "llc",
    "ltd",
    "ltda",
    "corp",
    "co",
    "gmbh",
    "plc",
)
# Busca uno o varios sufijos al final del texto, separados por espacios.
_SUFFIX_RE = re.compile(r"(?:\s+(?:" + "|".join(re.escape(s) for s in _LEGAL_SUFFIXES) + r"))+$")


def fold(text: str) -> str:
    """Pasa a minúsculas, quita acentos y cambia la puntuación por espacios.

    Ejemplo: "Café-Lúcuma, S.A." queda "cafe lucuma s a".
    """
    # NFKD separa cada letra acentuada en letra + acento, para poder quitar el acento.
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    # Cualquier signo se vuelve espacio, y se juntan los espacios repetidos.
    return " ".join(re.sub(r"[^\w]+", " ", without_accents).split())


def normalize_entity_name(name: str) -> str:
    """Devuelve la forma normalizada del nombre, sin sufijos legales y de máximo 200 letras.

    Si quitar el sufijo dejara el nombre vacío (por ejemplo, un nombre que era solo "S.A."),
    se conserva el nombre completo.
    """
    folded = fold(name)
    stripped = _SUFFIX_RE.sub("", folded).strip()
    return (stripped or folded)[:200]
