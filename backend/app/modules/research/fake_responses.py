"""Respuestas simuladas del plan de investigación para el proveedor falso."""

import re
from collections.abc import Sequence

from app.core.enums import ResearchCategory
from app.modules.ai.providers.fake import FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.research.schemas import PlannedQuestion, ResearchPlan

_TEMPLATES = [
    (ResearchCategory.MARKET, "¿Qué tamaño y tendencia tiene el mercado de «{t}»?"),
    (ResearchCategory.CUSTOMERS, "¿Qué necesidades y hábitos tienen los clientes de «{t}»?"),
    (ResearchCategory.COMPETITION, "¿Qué competidores directos existen para «{t}»?"),
    (ResearchCategory.SUBSTITUTES, "¿Qué alternativas usan hoy los clientes en lugar de «{t}»?"),
    (ResearchCategory.PRICING, "¿Qué precios se cobran por soluciones parecidas a «{t}»?"),
    (ResearchCategory.REGULATION, "¿Qué regulación afecta a un negocio como «{t}»?"),
]


@register_fake_response(ResearchPlan)
def fake_research_plan(messages: Sequence[AIMessage]) -> ResearchPlan:
    match = re.search(r"^Título: (.+)$", messages[-1].content, re.MULTILINE)
    title = (match.group(1) if match else "la idea")[:80]
    return ResearchPlan(
        questions=[
            PlannedQuestion(category=category, question=f"{FAKE_MARKER} {template.format(t=title)}")
            for category, template in _TEMPLATES
        ]
    )
