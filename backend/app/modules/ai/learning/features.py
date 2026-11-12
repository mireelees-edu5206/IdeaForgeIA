"""Convierte un hallazgo en números que el árbol puede usar. Área: aprendizaje del motor de IA.

El árbol de decisión solo sabe comparar números ("¿es mayor que X?"). Un hallazgo es texto,
una lista de evidencias y un tipo. Este archivo lo traduce a una fila de números, en el mismo orden.

Cada rasgo (feature) responde una pregunta sobre el hallazgo:
- confidence_score: qué tan seguro está el motor de su propio hallazgo (0 a 1).
- evidence_count: cuántas evidencias lo respaldan o lo contradicen en total.
- supports_count: cuántas evidencias lo respaldan.
- contradicts_count: cuántas evidencias lo contradicen.
- distinct_domains: cuántos sitios web distintos aportan evidencia. Dos fuentes del mismo sitio
  cuentan como una sola, para no inflar la confianza.
- mentions_amount: 1 si el texto contiene una cifra de 4 dígitos o más (posible precio o costo).
- is_pricing, is_competition, is_customers: 1 si el hallazgo es de ese tipo; si no, 0.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

# Los nombres van en el mismo orden que los números de finding_feature_row. El árbol usa el índice
# para saber qué columna es cada rasgo, y este nombre para escribir las reglas en texto.
FEATURE_NAMES: tuple[str, ...] = (
    "confidence_score",
    "evidence_count",
    "supports_count",
    "contradicts_count",
    "distinct_domains",
    "mentions_amount",
    "is_pricing",
    "is_competition",
    "is_customers",
)

# Expresión regular: una secuencia de 4 o más dígitos seguidos. "\d" es un dígito y "{4,}" significa
# "cuatro o más veces". Ejemplo: "12000 pesos" coincide, "año 2026" también (es una limitación).
_AMOUNT_RE = re.compile(r"\d{4,}")


def finding_feature_row(
    *,
    finding_type: str,
    statement: str,
    confidence_score: float | None,
    stances: Sequence[str],
    domains: Sequence[str],
) -> list[float]:
    """Arma la fila de números de un hallazgo, en el mismo orden que FEATURE_NAMES.

    Entradas:
    - finding_type: el tipo del hallazgo (por ejemplo "pricing").
    - statement: el texto del hallazgo.
    - confidence_score: la confianza del motor, o None si no tiene.
    - stances: la postura de cada evidencia ("supports", "contradicts" o "context").
    - domains: el dominio de la fuente de cada evidencia.

    Salida: una lista de 9 números decimales.
    Nota: "context" no cuenta como apoyo ni como contradicción; solo aporta a evidence_count.
    """
    return [
        # "confidence_score or 0.0": si no hay valor (None), se usa 0.
        float(confidence_score or 0.0),
        float(len(stances)),
        float(sum(1 for stance in stances if stance == "supports")),
        float(sum(1 for stance in stances if stance == "contradicts")),
        # set() elimina los dominios repetidos; len cuenta los que quedan.
        float(len(set(domains))),
        # Un valor de 1.0 si el patrón aparece; 0.0 si no. Así las preguntas del árbol son sí/no.
        1.0 if _AMOUNT_RE.search(statement) else 0.0,
        1.0 if finding_type == "pricing" else 0.0,
        1.0 if finding_type == "competition" else 0.0,
        1.0 if finding_type == "customers" else 0.0,
    ]
