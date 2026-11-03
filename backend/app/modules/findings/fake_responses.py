"""Extracción simulada para el proveedor falso (ejercita las reglas de validación).

ARCHIVO: backend/app/modules/findings/fake_responses.py

¿Qué es?
Una extracción de mentira: en lugar de llamar a una IA real, arma hallazgos a partir de las
evidencias que encuentra en el texto (las líneas "[E#] categoría: ..."). Está pensada para probar
las reglas de validación, no para dar resultados reales.

¿Para qué sirve?
Para probar en desarrollo y en las pruebas que el sistema descarta lo que no debe:
- Un hallazgo con dos fuentes distintas sí puede quedar con confianza alta.
- Un hallazgo con una sola fuente se limita a confianza media.
- Una evidencia que no existe (E999) se descarta.
- Una empresa que no aparece en el texto se descarta.

¿Quién lo usa?
El proveedor falso, cuando la extracción de una investigación pide un ExtractionResult.
Todos los textos llevan la marca [Simulado].
"""

import re
from collections.abc import Sequence

from app.core.enums import Level
from app.modules.ai.providers.fake import FAKE_COMPETITOR, FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.entities.models import CompetitorType, EntityType
from app.modules.findings.extraction import (
    ExtractedEntity,
    ExtractedEvidenceRef,
    ExtractedFinding,
    ExtractionResult,
)

# Busca en el texto líneas como "[E3] categoría: market |" y captura la referencia y la categoría.
_LINE = re.compile(r"^\[(E\d+)\] categoría: (\w+) \|", re.MULTILINE)


@register_fake_response(ExtractionResult)
def fake_extraction(messages: Sequence[AIMessage]) -> ExtractionResult:
    """Arma una extracción falsa a partir de las evidencias que aparecen en el último mensaje."""
    lines = _LINE.findall(messages[-1].content)
    findings = [
        # Dos dominios distintos: se admite confianza alta.
        # Se toman las evidencias de dos en dos (la 1 con la 2, la 3 con la 4...).
        ExtractedFinding(
            finding_type=category,
            statement=f"{FAKE_MARKER} Hallazgo de prueba respaldado por {ref_a} y {ref_b}.",
            confidence_level=Level.HIGH,
            confidence_rationale=f"{FAKE_MARKER} Dos fuentes simuladas coinciden.",
            evidence=[ExtractedEvidenceRef(ref=ref_a), ExtractedEvidenceRef(ref=ref_b)],
            entities=[FAKE_COMPETITOR],
        )
        for (ref_a, category), (ref_b, _) in zip(lines[::2], lines[1::2], strict=False)
    ]
    if lines:
        # Una sola fuente: la regla la limita a confianza media.
        findings.append(
            ExtractedFinding(
                finding_type=lines[0][1],
                statement=f"{FAKE_MARKER} Hallazgo de prueba con una única fuente.",
                confidence_level=Level.HIGH,
                evidence=[ExtractedEvidenceRef(ref=lines[0][0])],
            )
        )
    # Cita una evidencia inexistente: debe descartarse.
    findings.append(
        ExtractedFinding(
            finding_type="other",
            statement=f"{FAKE_MARKER} Afirmación sin evidencia real.",
            evidence=[ExtractedEvidenceRef(ref="E999")],
        )
    )
    return ExtractionResult(
        findings=findings,
        entities=[
            ExtractedEntity(
                name=FAKE_COMPETITOR,
                entity_type=EntityType.COMPANY,
                description=f"{FAKE_MARKER} Empresa ficticia mencionada por una fuente simulada.",
                website="https://example.org/competidor-simulado",
                competitor_type=CompetitorType.DIRECT,
                competitor_rationale=f"{FAKE_MARKER} Ofrece una solución parecida a la idea.",
                threat_level=Level.MEDIUM,
            ),
            # No aparece en ningún texto: debe descartarse.
            ExtractedEntity(name="Entidad Inventada", competitor_type=CompetitorType.INDIRECT),
        ],
    )
