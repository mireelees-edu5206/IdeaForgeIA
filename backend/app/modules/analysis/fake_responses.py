"""Análisis simulado para el proveedor falso (ejercita las reglas de respaldo).

ARCHIVO: backend/app/modules/analysis/fake_responses.py

¿Qué es?
Un análisis de mentira para pruebas. Arma oportunidades, riesgos, hipótesis e información faltante
a partir de las referencias de hallazgos [H#] que encuentra en el texto.

¿Para qué sirve?
Para probar en desarrollo que el sistema descarta lo que no debe:
- Una oportunidad sin hallazgos se descarta.
- Un riesgo que cita un hallazgo que no existe (H999) se descarta.
- Una hipótesis sin hallazgos sí se acepta, porque sirve para cubrir lo que no se verificó.

¿Quién lo usa?
El proveedor falso, cuando el análisis pide un AnalysisResult. Todos los textos llevan [Simulado].
"""

import re
from collections.abc import Sequence

from app.core.enums import AttributeType, Level, Priority
from app.modules.ai.providers.fake import FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.analysis.generation import (
    AnalysisResult,
    GeneratedHypothesis,
    GeneratedMissingInfo,
    GeneratedOpportunity,
    GeneratedRisk,
)
from app.modules.analysis.models import RiskCategory

# Busca en el texto líneas que empiezan con una referencia de hallazgo, por ejemplo "[H2]".
_REF = re.compile(r"^\[(H\d+)\]", re.MULTILINE)


@register_fake_response(AnalysisResult)
def fake_analysis(messages: Sequence[AIMessage]) -> AnalysisResult:
    """Arma un análisis falso usando los hallazgos que aparecen en el último mensaje."""
    refs = _REF.findall(messages[-1].content)
    # Toma los dos primeros hallazgos. Si solo hay uno, lo repite. Si no hay ninguno, usa H999
    # (inexistente).
    first, second = (refs + refs)[:2] if refs else ("H999", "H999")
    return AnalysisResult(
        opportunities=[
            GeneratedOpportunity(
                title=f"{FAKE_MARKER} Nicho con poca oferta especializada",
                description="Interpretación de prueba basada en los hallazgos simulados.",
                potential=Level.MEDIUM,
                findings=[first, second],
            ),
            # Sin hallazgos: debe descartarse.
            GeneratedOpportunity(title=f"{FAKE_MARKER} Oportunidad sin respaldo", description="x"),
        ],
        risks=[
            GeneratedRisk(
                title=f"{FAKE_MARKER} Competidor establecido",
                description="Riesgo de prueba derivado de un hallazgo simulado.",
                category=RiskCategory.COMPETITION,
                likelihood=Level.MEDIUM,
                impact=Level.HIGH,
                mitigation="Diferenciarse por trazabilidad del origen.",
                findings=[first],
            ),
            # Cita un hallazgo inexistente: debe descartarse.
            GeneratedRisk(
                title=f"{FAKE_MARKER} Riesgo inventado", description="x", findings=["H999"]
            ),
        ],
        hypotheses=[
            GeneratedHypothesis(
                statement=f"{FAKE_MARKER} Los restaurantes pagarían una comisión del 8 %.",
                related_attribute=AttributeType.REVENUE_MODEL,
                validation_method="Entrevistas con 10 restaurantes.",
                success_criteria="Al menos 6 de 10 aceptan la comisión.",
                priority=Priority.HIGH,
                findings=[first],
            ),
            # Las hipótesis pueden no tener hallazgo: cubren lo no verificado.
            GeneratedHypothesis(
                statement=f"{FAKE_MARKER} Los productores tienen capacidad de entrega semanal.",
                related_attribute=AttributeType.SOLUTION,
            ),
        ],
        missing_information=[
            GeneratedMissingInfo(
                question=f"{FAKE_MARKER} ¿Cuánto gastan al mes los restaurantes en verdura?",
                reason="Ninguna fuente simulada da cifras de gasto.",
                related_attribute=AttributeType.CUSTOMER_SEGMENT,
                priority=Priority.HIGH,
            )
        ],
    )
