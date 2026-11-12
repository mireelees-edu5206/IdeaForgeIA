"""Pruebas de comportamiento para el motor propio de IA (IdeaForgeEngineProvider) y orquestador."""

import asyncio
import json
from collections import Counter
from collections.abc import Sequence
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from pydantic import BaseModel, ValidationError

from app.core.enums import AIProviderName, Level, ResearchCategory
from app.modules.ai.calls import AICallContext, AICallOutcome, build_call_logs
from app.modules.ai.errors import AIGroundingUnavailableError, AIRateLimitError
from app.modules.ai.factory import build_ai_provider
from app.modules.ai.models import AICallStatus, AIOperation
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.engine import (
    IdeaForgeEngineProvider,
    _drop_outliers_iqr,
    _tfidf_cosine_scores,
)
from app.modules.ai.providers.web_search import WebHit
from app.modules.ai.types import AIMessage, AIUsage, GroundedResult, StructuredResult
from app.modules.analysis.generation import AnalysisResult
from app.modules.chat.schemas import ChatAnswer
from app.modules.findings.extraction import ExtractionResult
from app.modules.reports.schemas import ReportDraft
from app.modules.research.orchestrator import _search_failure_code
from app.modules.research.schemas import ResearchPlan
from tests.conftest import make_settings


class Answer(BaseModel):
    """Esquema simple de prueba."""

    text: str
    count: int


def test_tfidf_cosine_similarity_ranks_matching_documents_first() -> None:
    """Verifica que el ranking TF-IDF del motor propio ordene primero los textos más relevantes."""
    scores = _tfidf_cosine_scores(
        "café de especialidad en Toluca precios",
        [
            "Renta de maquinaria pesada industrial para construcción en Monterrey.",
            "El mercado de café de especialidad en Toluca muestra precios de 65 a 95 pesos "
            "por taza.",
        ],
    )
    assert len(scores) == 2
    assert scores[1] > scores[0]


def test_engine_research_plan_builds_contextual_questions() -> None:
    """Verifica que el motor propio piense y formule preguntas contextuales para la idea."""
    provider = IdeaForgeEngineProvider()
    context = (
        "<idea>\n"
        "Título: Café Ruta Local\n"
        "Idea original: Suscripción de café de especialidad tostado en Toluca.\n"
        "Problema:\n- Cafeterías y oficinas no reciben grano recién tostado.\n"
        "Solución:\n- Entrega semanal de café de especialidad.\n"
        "Segmento de clientes:\n- Oficinas y cafeterías independientes.\n"
        "Alcance geográfico:\n- Toluca\n"
        "</idea>"
    )
    result = asyncio.run(
        provider.generate_structured(
            [
                AIMessage("system", "Entre 3 y 6 preguntas concretas."),
                AIMessage("user", context),
            ],
            ResearchPlan,
        )
    )
    assert result.provider == AIProviderName.ENGINE
    assert result.usage.estimated_cost_usd == Decimal(0)
    assert 3 <= len(result.data.questions) <= 6
    assert any("Toluca" in q.question for q in result.data.questions)


def test_engine_synthesizes_real_search_snippets_with_source_citations() -> None:
    """Verifica que el motor propio navegue en la web y sintetice fragmentos con citas exactas."""
    hits = [
        WebHit(
            url="https://example.org/cafe-toluca",
            title="Mercado de café en Toluca",
            snippet=(
                "El consumo de café de especialidad en Toluca creció 14% en cafeterías locales."
            ),
        ),
        WebHit(
            url="https://example.com/precios-grano",
            title="Precios de grano tostado",
            snippet="Las cafeterías pagan entre 380 y 520 pesos por kilo de café de especialidad.",
        ),
    ]
    provider = IdeaForgeEngineProvider()
    with patch(
        "app.modules.ai.providers.web_search.search_public_web",
        return_value=hits,
    ):
        actual = asyncio.run(
            provider.generate_grounded(
                [AIMessage("user", "¿Cómo funciona el mercado de café de especialidad en Toluca?")]
            )
        )

    assert actual.provider == AIProviderName.ENGINE
    assert actual.sources[0].url == hits[0].url
    assert actual.sources[0].cited is True
    assert len(actual.citations) >= 1
    assert actual.usage.search_queries_count == 1
    assert actual.usage.estimated_cost_usd == Decimal(0)


def test_engine_extracts_findings_and_entities_from_evidence() -> None:
    """Verifica la extracción NLP de hallazgos y competidores reales desde la evidencia."""
    provider = IdeaForgeEngineProvider()
    prompt = (
        "<idea>\nTítulo: Café Ruta\n</idea>\n\n"
        "<evidencia>\n"
        '[E1] categoría: market | fuente: economista.mx | "El crecimiento del consumo '
        'de café aumentó 12% en oficinas."\n'
        '[E2] categoría: competition | fuente: forbes.com.mx | "La cadena Cielito Querido '
        'compite como marca establecida."\n'
        "</evidencia>\n\n"
        "<respuestas>\n"
        "Pregunta: ¿Qué competidores existen?\n"
        "Respuesta: La empresa Cielito Querido opera cafeterías y compite en el sector.\n"
        "</respuestas>"
    )
    result = asyncio.run(
        provider.generate_structured(
            [AIMessage("system", "Extrae hallazgos"), AIMessage("user", prompt)],
            ExtractionResult,
        )
    )
    assert len(result.data.findings) >= 2
    assert any(f.finding_type == ResearchCategory.MARKET for f in result.data.findings)
    assert any("Cielito" in e.name for e in result.data.entities)


def test_engine_infers_business_analysis_from_findings() -> None:
    """Verifica que el motor de inferencia encadene oportunidades, riesgos e hipótesis."""
    provider = IdeaForgeEngineProvider()
    prompt = (
        "<idea>\nTítulo: Café Ruta\n</idea>\n\n"
        "<hallazgos>\n"
        "[H1] mercado | confianza: high | IA proposed | Crecimiento sostenido en la demanda "
        "de café.\n"
        "[H2] competencia | confianza: medium | IA proposed | Existe barrera por competidor "
        "establecido.\n"
        "</hallazgos>\n\n"
        "<competidores>\n- Cielito (direct, amenaza: medium)\n</competidores>\n\n"
        "<respuestas>\nPregunta: Mercado\nRespuesta: Hay demanda creciente.\n</respuestas>"
    )
    result = asyncio.run(
        provider.generate_structured(
            [AIMessage("system", "Analiza"), AIMessage("user", prompt)],
            AnalysisResult,
        )
    )
    assert len(result.data.opportunities) >= 1
    assert result.data.opportunities[0].findings == ["H1"]
    assert len(result.data.risks) >= 1
    assert len(result.data.hypotheses) >= 2
    assert len(result.data.missing_information) >= 1


def test_engine_chat_answer_calculates_investment_and_cites_findings() -> None:
    """Verifica que el asistente propio desglose costos, fórmula de inversión y cite hallazgos."""
    provider = IdeaForgeEngineProvider()
    fid = uuid4()
    ctx_payload = {
        "project": {
            "title": "Marca Textil",
            "idea": "Playeras básicas",
            "status": "analyzed",
        },
        "findings": [
            {
                "id": str(fid),
                "type": "pricing",
                "statement": "El costo unitario de confección es de 180 pesos.",
                "confidence": "high",
                "origin": "user",
                "review_status": "accepted",
                "entities": [],
                "evidence": [],
            }
        ],
        "competitors": [],
        "analysis": {
            "opportunities": [],
            "risks": [],
            "hypotheses": [],
            "missing_information": [],
        },
        "attributes": [],
        "context_truncated": False,
    }
    sys_prompt = f"Reglas del chat\n<project_context>{json.dumps(ctx_payload)}</project_context>"
    result = asyncio.run(
        provider.generate_structured(
            [
                AIMessage("system", sys_prompt),
                AIMessage("user", "¿Cuánto necesito invertir para empezar la marca?"),
            ],
            ChatAnswer,
        )
    )
    assert (
        "unidades × costo unitario + gastos de arranque + capital de trabajo" in result.data.answer
    )
    assert fid in result.data.finding_ids


def test_engine_report_draft_builds_structured_verdict_and_predicts_investment() -> None:
    """Verifica el modelo predictivo de viabilidad, inversión y zonas del informe final."""
    provider = IdeaForgeEngineProvider()
    ctx_data = {
        "project": {
            "title": "Taller de Bicicletas",
            "idea": "Mantenimiento a domicilio",
            "attributes": [
                {
                    "type": "problem",
                    "value": "Talleres lentos",
                    "origin": "user",
                    "confirmed": True,
                }
            ],
        },
        "findings": [
            {
                "ref": "H1",
                "category": "pricing",
                "statement": "El costo promedio de servicio es de 450 pesos.",
                "confidence": "medium",
                "origin": "user",
                "review_status": "accepted",
                "evidence": [
                    {
                        "ref": "E1",
                        "source_ref": "S1",
                        "content": "Servicio en 450 pesos.",
                    }
                ],
            }
        ],
        "sources": [
            {
                "ref": "S1",
                "title": "Estudio",
                "domain": "example.com",
                "url": "https://example.com",
            }
        ],
        "competitors": [
            {
                "name": "BiciExpress",
                "type": "direct",
                "threat": "medium",
                "rationale": "Opera en la zona",
                "origin": "ai",
                "review_status": "accepted",
            }
        ],
        "analysis": {
            "opportunities": [
                {
                    "title": "Servicio a domicilio",
                    "description": "Ahorra tiempo",
                    "potential": "medium",
                    "origin": "ai",
                    "review_status": "accepted",
                }
            ],
            "risks": [
                {
                    "title": "Logística",
                    "description": "Traslados",
                    "category": "operational",
                    "likelihood": "medium",
                    "impact": "medium",
                    "mitigation": "Rutas por zona",
                    "origin": "ai",
                    "review_status": "accepted",
                }
            ],
            "hypotheses": [
                {
                    "statement": "Clientes pagan extra a domicilio",
                    "validation_method": "Entrevistas a 15 ciclistas",
                    "success_criteria": "10 de 15 aceptan",
                    "priority": "high",
                    "validation_status": "pending",
                    "origin": "ai",
                    "review_status": "accepted",
                }
            ],
            "missing_information": [
                {
                    "question": "¿Cuál es el costo de herramienta móvil?",
                    "reason": "Falta cotizar",
                    "priority": "high",
                    "resolution_status": "open",
                    "origin": "ai",
                    "review_status": "accepted",
                }
            ],
        },
        "geography": {
            "status": "places_found",
            "areas": [
                {
                    "query": "Toluca",
                    "resolved_area": "Toluca, México",
                    "places": [
                        {
                            "ref": "G1",
                            "name": "Taller Central",
                            "category": "shop",
                            "subtype": "bicycle",
                            "latitude": 19.29,
                            "longitude": -99.65,
                            "osm_url": "https://www.openstreetmap.org/node/1",
                        }
                    ],
                }
            ],
        },
        "context_truncated": False,
    }
    report_context = f"<report_data>{json.dumps(ctx_data)}</report_data>"
    result = asyncio.run(
        provider.generate_structured(
            [AIMessage("system", "Informe"), AIMessage("user", report_context)],
            ReportDraft,
        )
    )
    verdict = result.data.executive_summary
    assert verdict.recommendation in {"needs_validation", "worth_testing"}
    assert verdict.investment is not None
    assert verdict.investment.minimum_mxn > 0
    assert "H1" in verdict.investment.evidence_refs
    assert verdict.zones[0].place_refs == ["G1"]
    assert "[H1]" in result.data.market


def test_iqr_filter_removes_a_mistyped_amount_and_keeps_the_rest() -> None:
    """Un precio mal leído (9 000 000 en vez de 9 000) sale del promedio; el resto se conserva."""
    assert _drop_outliers_iqr([1000, 1100, 1200, 1300, 9_000_000]) == [1000, 1100, 1200, 1300]


def test_iqr_filter_keeps_all_amounts_when_there_are_too_few_to_compare() -> None:
    """Con menos de 4 cifras no hay dispersión que medir, así que no se quita ninguna."""
    assert _drop_outliers_iqr([1000, 1100, 9_000_000]) == [1000, 1100, 9_000_000]


class StubProvider(AIProvider):
    """Adaptador de prueba para verificar el orquestador."""

    def __init__(self, name: AIProviderName, model: str, error: Exception | None = None) -> None:
        self.name = name
        self.model = model
        self.error = error

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        if self.error:
            raise self.error
        return StructuredResult(
            data=schema.model_validate({"text": "local", "count": 1}),
            usage=AIUsage(input_tokens=4, output_tokens=3, estimated_cost_usd=Decimal(0)),
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        raise AIGroundingUnavailableError()


def test_orchestrator_fallback_logs_both_attempts() -> None:
    """Verifica que el orquestador registre el intento fallido y el de respaldo con costo cero."""
    primary = StubProvider(AIProviderName.ENGINE, "engine-v1", AIRateLimitError())
    fallback = StubProvider(AIProviderName.ENGINE, "engine-fallback")
    provider = AIOrchestrator(primary, fallback)
    result = asyncio.run(provider.generate_structured([AIMessage("user", "Entrada")], Answer))
    logs = build_call_logs(
        AICallContext(uuid4(), uuid4()),
        provider,
        AIOperation.ANALYSIS,
        "test.v1",
        AICallOutcome(result, None, 1),
        result.usage,
    )

    assert [log.provider for log in logs] == [AIProviderName.ENGINE, AIProviderName.ENGINE]
    assert [log.status for log in logs] == [AICallStatus.ERROR, AICallStatus.SUCCESS]
    assert logs[0].error_code == "ai_rate_limited"
    assert logs[1].estimated_cost_usd == Decimal(0)


def test_uniform_search_rate_limits_keep_the_provider_error_code() -> None:
    """Verifica que los códigos uniformes de error de búsqueda se conserven."""
    assert _search_failure_code(Counter({"ai_rate_limited": 6})) == "ai_rate_limited"
    assert (
        _search_failure_code(Counter({"ai_rate_limited": 3, "ai_timeout": 3}))
        == "all_searches_failed"
    )


def test_settings_select_native_engine_without_external_keys() -> None:
    """Verifica que el motor nativo de IdeaForge no requiera claves externas ni servidores "
    "aparte."""
    with pytest.raises(ValidationError):
        make_settings(ai_provider="legacy")

    engine_settings = make_settings(
        ai_provider="engine",
        ai_engine_model="ideaforge-engine-v1",
    )
    provider = build_ai_provider(engine_settings)

    assert isinstance(provider, AIOrchestrator)
    assert provider.name == AIProviderName.ENGINE
    assert provider.model == "ideaforge-engine-v1"
    assert Level.HIGH.value == "high"
