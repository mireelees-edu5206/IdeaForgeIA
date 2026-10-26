"""Respuestas explícitamente simuladas para probar el flujo de informes."""

from collections.abc import Sequence

from pydantic import BaseModel

from app.modules.ai.providers.fake import FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.reports.schemas import BusinessVerdict, ReportDraft


@register_fake_response(ReportDraft)
def report_response(_: Sequence[AIMessage]) -> BaseModel:
    simulated = (
        f"{FAKE_MARKER} Contenido simulado para probar el informe; no es evidencia "
        "ni representa una conclusión validada."
    )
    return ReportDraft(
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
