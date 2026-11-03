"""Respuestas explícitamente simuladas para probar el flujo de informes.

ARCHIVO: backend/app/modules/reports/fake_responses.py

¿Qué es?
Un informe de mentira. Cuando el proveedor de pruebas está activo, en lugar de llamar a una IA real,
arma un informe con todas sus secciones llenas de texto simulado.

¿Para qué sirve?
Para probar el flujo completo del informe (pedirlo, verlo en pantalla, exportarlo) sin gastar en IA.
El texto lleva la marca [Simulado] y dice que no es evidencia, para que nadie lo tome en serio.

¿Quién lo usa?
El proveedor falso (ai/providers/fake.py) cuando el informe pide un ReportDraft.
"""

from collections.abc import Sequence

from pydantic import BaseModel

from app.modules.ai.providers.fake import FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.reports.schemas import BusinessVerdict, ReportDraft


@register_fake_response(ReportDraft)
def report_response(_: Sequence[AIMessage]) -> BaseModel:
    """Devuelve un informe falso con todas las secciones llenas del mismo texto simulado.

    El argumento "_" no se usa: la respuesta falsa no depende de la pregunta.
    """
    simulated = (
        f"{FAKE_MARKER} Contenido simulado para probar el informe; no es evidencia "
        "ni representa una conclusión validada."
    )
    return ReportDraft(
        # El veredicto de prueba dice "información insuficiente" con confianza baja.
        executive_summary=BusinessVerdict(
            recommendation="insufficient_information",
            confidence="low",
            summary=simulated,
            next_steps=["Configurar un proveedor de IA real antes de evaluar una idea."],
        ),
        idea_overview=simulated,
        market=simulated,
        competition=simulated,
        opportunities=simulated,
        risks=simulated,
        hypotheses=simulated,
        missing_information=simulated,
        conclusions=simulated,
    )
