"""Respuestas simuladas del plan de investigación para el proveedor falso.

ARCHIVO: backend/app/modules/research/fake_responses.py

¿Qué es?
Una respuesta de mentira para el plan de investigación. Cuando el proveedor de pruebas (fake) está
activo, en lugar de llamar a una IA real, este archivo arma un plan con seis preguntas, una por
cada tema de investigación.

¿Para qué sirve?
Para probar toda la investigación (crear, correr, ver resultados) sin gastar en IA ni depender
de internet. Las preguntas llevan la marca [Simulado] para que nadie las confunda con reales.

¿Quién lo usa?
El proveedor falso (ai/providers/fake.py) cuando la investigación pide un ResearchPlan.

Importante: el decorador @register_fake_response conecta esta función con el esquema ResearchPlan.
Si se borra el decorador, el proveedor falso no sabrá qué responder y fallará.
"""

import re
from collections.abc import Sequence

from app.core.enums import ResearchCategory
from app.modules.ai.providers.fake import FAKE_MARKER, register_fake_response
from app.modules.ai.types import AIMessage
from app.modules.research.schemas import PlannedQuestion, ResearchPlan

# Seis plantillas de preguntas, una por tema. Cada "{t}" se cambia por el título del proyecto.
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
    """Arma un plan falso con las seis preguntas, usando el título que venga en el mensaje."""
    # Busca en el último mensaje una línea "Título: ..." para tomar el nombre del proyecto.
    match = re.search(r"^Título: (.+)$", messages[-1].content, re.MULTILINE)
    # Si no hay título, usa "la idea". Se recorta a 80 letras para no pasarse del límite.
    title = (match.group(1) if match else "la idea")[:80]
    return ResearchPlan(
        questions=[
            # Cada pregunta lleva la marca [Simulado] al inicio y su tema correspondiente.
            PlannedQuestion(category=category, question=f"{FAKE_MARKER} {template.format(t=title)}")
            for category, template in _TEMPLATES
        ]
    )
