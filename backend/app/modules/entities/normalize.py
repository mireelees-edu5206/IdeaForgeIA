"""Normalización de nombres de entidades para deduplicarlas dentro de un proyecto."""

import re
import unicodedata

# Sufijos legales habituales (se comparan ya sin puntos ni acentos).
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
_SUFFIX_RE = re.compile(r"(?:\s+(?:" + "|".join(re.escape(s) for s in _LEGAL_SUFFIXES) + r"))+$")


def fold(text: str) -> str:
    """Minúsculas, sin acentos y con la puntuación convertida en espacios."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w]+", " ", without_accents).split())


def normalize_entity_name(name: str) -> str:
    folded = fold(name)
    stripped = _SUFFIX_RE.sub("", folded).strip()
    return (stripped or folded)[:200]
