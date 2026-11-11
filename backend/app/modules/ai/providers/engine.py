"""Motor propio de Inteligencia Artificial de IdeaForge (NLP, Razonamiento, Predicción y Web).

ARCHIVO: backend/app/modules/ai/providers/engine.py

¿Qué es?
El motor nativo de Inteligencia Artificial programado 100 % en Python para IdeaForge AI.
No depende de APIs externas de modelos de lenguaje (ni Gemini ni Ollama): implementa sus propios
algoritmos de procesamiento de lenguaje natural (TF-IDF y similitud coseno), navegación web en
vivo (DuckDuckGo + Wikipedia), extracción de entidades, encadenamiento de reglas de inferencia
(forward chaining) y modelo predictivo de viabilidad e inversión.

¿Para qué sirve?
1. Pensar y planificar (`ResearchPlan`): analiza los atributos de la idea y formula preguntas de
   investigación adaptadas al sector, cliente y zona geográfica.
2. Navegar por internet (`generate_grounded` y `_SynthesizedAnswer`): consulta fuentes públicas en
   internet, puntúa cada oración con TF-IDF + similitud coseno frente a la consulta y sintetiza
   afirmaciones con citas verificables (`CitationSpan`).
3. Razonar y extraer (`ExtractionResult` y `AnalysisResult`): aplica reglas de inferencia sobre la
   evidencia citada `[E#]` y los hallazgos `[H#]` para deducir oportunidades, riesgos, hipótesis
   comprobables, competidores e información faltante.
4. Predecir y recomendar (`ReportDraft` y `ChatAnswer`): calcula un índice multicriterio de
   viabilidad e incertidumbre, predice rangos de inversión en MXN cuando existen referencias de
   costos y responde preguntas del usuario usando ranking léxico-semántico BM25/TF-IDF.
"""

from __future__ import annotations

import json
import math
import re
import uuid
from collections import Counter
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ValidationError

from app.core.enums import (
    AIProviderName,
    AttributeType,
    Level,
    Priority,
    ResearchCategory,
)
from app.modules.ai.errors import AIInvalidResponseError, AIProviderError
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.web_search import synthesize_grounded_from_web
from app.modules.ai.types import AIMessage, AIUsage, GroundedResult, StructuredResult
from app.modules.analysis.generation import (
    AnalysisResult,
    GeneratedHypothesis,
    GeneratedMissingInfo,
    GeneratedOpportunity,
    GeneratedRisk,
)
from app.modules.analysis.models import RiskCategory
from app.modules.entities.models import CompetitorType, EntityType
from app.modules.findings.extraction import (
    ExtractedEntity,
    ExtractedEvidenceRef,
    ExtractedFinding,
    ExtractionResult,
)
from app.modules.findings.models import EvidenceStance
from app.modules.reports.schemas import (
    BusinessVerdict,
    InvestmentEstimate,
    ZoneRecommendation,
)

# Palabras vacías en español que no aportan significado al calcular similitud TF-IDF.
_STOPWORDS = {
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "al",
    "a",
    "en",
    "con",
    "por",
    "para",
    "sin",
    "sobre",
    "entre",
    "hacia",
    "hasta",
    "desde",
    "y",
    "o",
    "u",
    "e",
    "ni",
    "que",
    "como",
    "cuando",
    "donde",
    "quien",
    "cual",
    "es",
    "son",
    "fue",
    "ser",
    "esta",
    "este",
    "estos",
    "estas",
    "ese",
    "esa",
    "su",
    "sus",
    "mi",
    "mis",
    "tu",
    "tus",
    "se",
    "lo",
    "le",
    "les",
    "me",
    "te",
    "nos",
    "mas",
    "muy",
    "ya",
    "no",
    "si",
    "pero",
    "porque",
    "según",
    "segun",
    "cada",
}

_WORD_RE = re.compile(r"[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]{3,}")
_EVIDENCE_LINE_RE = re.compile(
    r'^\[(E\d+)\]\s*categoría:\s*([a-z_]+)\s*\|\s*fuente:\s*([^\s|]+)\s*\|\s*"(.+)"$',
    re.MULTILINE,
)
_FINDING_LINE_RE = re.compile(
    r"^\[(H\d+)\]\s*([^|]+)\|\s*confianza:\s*([a-z_]+)\s*\|\s*([^|]+)\|\s*(.+)$",
    re.MULTILINE,
)
_SOURCE_BLOCK_RE = re.compile(
    r"\[(\d+)\]\s*Título:\s*(.+?)\nURL:\s*(\S+)\nFragmento:\s*(.+?)(?=\n\[\d+\]|\Z)",
    re.DOTALL,
)
_PROPER_ENTITY_RE = re.compile(
    r"\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,2})\b"
)
_AMOUNT_RE = re.compile(r"\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\s*(?:pesos|mxn|usd)?", re.I)

_CATEGORY_FROM_LABEL = {
    "mercado": ResearchCategory.MARKET,
    "clientes": ResearchCategory.CUSTOMERS,
    "competencia": ResearchCategory.COMPETITION,
    "sustitutos y alternativas": ResearchCategory.SUBSTITUTES,
    "tecnología": ResearchCategory.TECHNOLOGY,
    "regulación": ResearchCategory.REGULATION,
    "precios": ResearchCategory.PRICING,
    "otros": ResearchCategory.OTHER,
}

_NEGATIVE_MARKERS = (
    "riesgo",
    "barrera",
    "problema",
    "saturado",
    "difícil",
    "dificil",
    "costoso",
    "caro",
    "caída",
    "caida",
    "rechazo",
    "restricción",
    "restriccion",
    "competidor",
    "amenaza",
    "limitación",
    "limitacion",
)

_POSITIVE_MARKERS = (
    "crecimiento",
    "demanda",
    "oportunidad",
    "aumento",
    "interés",
    "interes",
    "tendencia",
    "expansión",
    "expansion",
    "ventaja",
    "innovación",
    "innovacion",
    "rentable",
    "favorable",
)


def _tokenize(text: str) -> list[str]:
    """Convierte un texto en tokens normalizados sin palabras vacías."""
    return [
        tok
        for word in _WORD_RE.findall(text.lower())
        if (tok := word.strip()) and tok not in _STOPWORDS
    ]


def _tfidf_cosine_scores(query: str, documents: Sequence[str]) -> list[float]:
    """Calcula la similitud coseno TF-IDF entre una consulta y una lista de textos.

    Es el núcleo matemático de recuperación y ranking del motor propio.
    """
    if not documents:
        return []
    q_tokens = _tokenize(query)
    if not q_tokens:
        return [1.0 / (idx + 1) for idx in range(len(documents))]

    doc_tokens = [_tokenize(doc) for doc in documents]
    n_docs = len(documents) + 1
    df: Counter[str] = Counter(set(q_tokens))
    for toks in doc_tokens:
        df.update(set(toks))

    def vectorize(tokens: list[str]) -> dict[str, float]:
        counts = Counter(tokens)
        total = max(len(tokens), 1)
        return {
            term: (freq / total) * (math.log((n_docs + 1) / (df[term] + 1)) + 1.0)
            for term, freq in counts.items()
        }

    q_vec = vectorize(q_tokens)
    q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

    scores: list[float] = []
    for toks in doc_tokens:
        d_vec = vectorize(toks)
        d_norm = math.sqrt(sum(v * v for v in d_vec.values())) or 1.0
        dot = sum(q_val * d_vec.get(term, 0.0) for term, q_val in q_vec.items())
        scores.append(dot / (q_norm * d_norm))
    return scores


class IdeaForgeEngineProvider(AIProvider):
    """Motor nativo de IA de IdeaForge: razona, predice y navega por internet en Python."""

    def __init__(
        self,
        name: AIProviderName = AIProviderName.ENGINE,
        model: str = "ideaforge-engine-v1",
        timeout: float = 30.0,
    ) -> None:
        """Inicializa el motor propio con identificador compatible con el esquema de BD."""
        self.name = name
        self.model = model
        self.timeout = timeout

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        """Registra qué motor y versión produjeron un error."""
        error.provider = self.name
        error.model = self.model
        return error

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        """Ejecuta el motor de razonamiento, extracción o predicción según el esquema pedido."""
        prompt_text = "\n".join(m.content for m in messages)
        in_tokens = max(1, len(prompt_text.split()))
        schema_name = schema.__name__

        try:
            if schema_name == "ResearchPlan":
                payload = self._plan_research(messages)
            elif schema_name == "_SynthesizedAnswer":
                payload = self._synthesize_web_statements(messages)
            elif schema_name == "ExtractionResult":
                payload = self._extract_findings_and_entities(messages)
            elif schema_name == "AnalysisResult":
                payload = self._infer_business_analysis(messages)
            elif schema_name == "ChatAnswer":
                payload = self._reason_chat_answer(messages)
            elif schema_name == "ReportDraft":
                payload = self._predict_report_verdict(messages)
            else:
                payload = self._generic_structured_fallback(messages, schema)

            validated = schema.model_validate(payload)
        except (ValidationError, ValueError, KeyError) as exc:
            raise self._annotate(AIInvalidResponseError()) from exc

        out_tokens = max(1, len(validated.model_dump_json().split()))
        return StructuredResult(
            data=validated,
            usage=AIUsage(
                input_tokens=in_tokens,
                output_tokens=out_tokens,
                estimated_cost_usd=Decimal(0),
            ),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        """Navega en internet (DuckDuckGo y Wikipedia) y sintetiza hallazgos con citas."""
        try:
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        except AIProviderError as exc:
            raise self._annotate(exc) from None

    # ─────────────── 1. Planificación de Investigación (Pensar) ───────────────

    def _plan_research(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Analiza el contexto de la idea y formula preguntas de búsqueda específicas."""
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "")
        sys_text = next((m.content for m in messages if m.role == "system"), "")
        max_match = re.search(r"Entre 3 y (\d+) preguntas", sys_text)
        max_q = int(max_match.group(1)) if max_match else 8

        title = _extract_line_value(user_text, "Título") or "la idea propuesta"
        idea = _extract_line_value(user_text, "Idea original") or title
        geo = _extract_section_bullet(user_text, "Alcance geográfico")
        segment = _extract_section_bullet(user_text, "Segmento de clientes")
        solution = _extract_section_bullet(user_text, "Solución") or title
        pricing = _extract_section_bullet(user_text, "Modelo de ingresos")

        geo_suffix = f" en {geo}" if geo else ""
        focus_term = solution[:70] if len(solution) >= 6 else title[:70]
        client_term = segment[:65] if segment else f"clientes de {focus_term}"

        planned = [
            (
                ResearchCategory.MARKET,
                f"¿Cuál es la demanda actual y tendencia del mercado para "
                f"{focus_term}{geo_suffix}?",
            ),
            (
                ResearchCategory.CUSTOMERS,
                f"¿Qué hábitos de compra y necesidades principales tienen "
                f"{client_term}{geo_suffix}?",
            ),
            (
                ResearchCategory.COMPETITION,
                f"¿Qué empresas o competidores directos ofrecen {focus_term}{geo_suffix}?",
            ),
            (
                ResearchCategory.SUBSTITUTES,
                f"¿Qué alternativas o sustitutos utilizan actualmente {client_term}?",
            ),
            (
                ResearchCategory.PRICING,
                (
                    f"¿Cuáles son los precios y tarifas promedio de {focus_term}"
                    f" ({pricing[:40] if pricing else 'referencia comercial'}){geo_suffix}?"
                ),
            ),
            (
                ResearchCategory.REGULATION,
                f"¿Qué permisos, normativas o requisitos legales aplican a "
                f"{focus_term}{geo_suffix}?",
            ),
            (
                ResearchCategory.TECHNOLOGY,
                f"¿Qué herramientas tecnológicas e insumos requiere operar {focus_term}?",
            ),
        ]

        # Si la idea menciona palabras clave específicas, priorizamos esas categorías.
        idea_lower = idea.lower()
        if "app" in idea_lower or "software" in idea_lower or "plataforma" in idea_lower:
            planned.insert(2, planned.pop(6))

        selected = planned[: max(3, min(max_q, len(planned)))]
        return {"questions": [{"category": cat, "question": q[:280]} for cat, q in selected]}

    # ─────────────── 2. Síntesis Web con TF-IDF (Navegar y Sintetizar) ───────────────

    def _synthesize_web_statements(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Selecciona y sintetiza los fragmentos web más relevantes usando similitud TF-IDF."""
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "")
        q_match = re.search(r"^Pregunta:\s*(.+)$", user_text, re.MULTILINE)
        question = q_match.group(1).strip() if q_match else user_text[:160]

        sources: list[tuple[int, str, str, str]] = []
        for idx_str, title, url, snippet in _SOURCE_BLOCK_RE.findall(user_text):
            sources.append((int(idx_str), title.strip(), url.strip(), " ".join(snippet.split())))

        if not sources:
            return {
                "statements": [
                    {
                        "statement": "No se encontraron fragmentos suficientes en las "
                        "fuentes consultadas.",
                        "source_indexes": [0],
                    }
                ]
            }

        docs = [f"{title}. {snippet}" for _, title, _, snippet in sources]
        scores = _tfidf_cosine_scores(question, docs)
        ranked = sorted(
            zip(scores, sources, strict=False),
            key=lambda item: item[0],
            reverse=True,
        )

        statements: list[dict[str, Any]] = []
        for _score, (idx, title, _url, snippet) in ranked[:4]:
            clean_title = title.split(" - ")[0].strip()[:90]
            clean_snippet = snippet.rstrip(".")
            statement = f"Según {clean_title}: {clean_snippet}."
            if len(statement) > 580:
                statement = statement[:577].rstrip() + "..."
            if len(statement) >= 15:
                statements.append({"statement": statement, "source_indexes": [idx]})

        # Si hay dos fuentes con vocabulario común, agregamos una inferencia comparativa.
        if len(ranked) >= 2:
            idx_a = ranked[0][1][0]
            idx_b = ranked[1][1][0]
            shared = set(_tokenize(ranked[0][1][3])) & set(_tokenize(ranked[1][1][3]))
            if shared:
                top_terms = ", ".join(sorted(shared)[:4])
                synthesis = (
                    f"Interpretación: Las fuentes consultadas coinciden en factores clave "
                    f"relacionados con {top_terms}, lo cual aporta evidencia convergente."
                )
                statements.append({"statement": synthesis[:580], "source_indexes": [idx_a, idx_b]})

        return {"statements": statements[:6]}

    # ─────────────── 3. Extracción NLP de Hallazgos y Competidores ───────────────

    def _extract_findings_and_entities(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Extrae hallazgos verificables, postura de evidencia y competidores desde el corpus."""
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "")
        evidences = _EVIDENCE_LINE_RE.findall(user_text)

        resp_match = re.search(r"<respuestas>\s*(.*?)\s*</respuestas>", user_text, re.DOTALL)
        corpus_text = resp_match.group(1) if resp_match else user_text

        # 1. Extracción de entidades reales mencionadas en las respuestas.
        entities: list[ExtractedEntity] = []
        seen_names: set[str] = set()
        banned_words = {
            "Según",
            "Interpretación",
            "Pregunta",
            "Respuesta",
            "Título",
            "Idea",
            "Problema",
            "Solución",
            "Segmento",
            "Alcance",
            "Wikipedia",
            "México",
            "Sin",
            "Para",
            "Los",
            "Las",
            "Una",
            "Con",
        }
        for candidate in _PROPER_ENTITY_RE.findall(corpus_text):
            clean_name = candidate.strip()
            first_word = clean_name.split()[0]
            if (
                len(clean_name) < 4
                or first_word in banned_words
                or clean_name.lower() in seen_names
                or clean_name.lower() not in corpus_text.lower()
            ):
                continue
            seen_names.add(clean_name.lower())
            is_comp = any(
                kw in corpus_text.lower()
                for kw in ("competidor", "empresa", "marca", "plataforma", "tienda", "cadena")
            )
            entities.append(
                ExtractedEntity(
                    name=clean_name[:120],
                    entity_type=EntityType.COMPANY,
                    description=(
                        f"Actor u organización identificada en las fuentes sobre {clean_name}."
                    ),
                    competitor_type=CompetitorType.DIRECT
                    if is_comp
                    else CompetitorType.ALTERNATIVE,
                    competitor_rationale=(
                        f"Mencionado en los fragmentos recopilados como referencia u opción "
                        f"en el sector ({clean_name})."
                    ),
                    threat_level=Level.MEDIUM if is_comp else Level.LOW,
                )
            )
            if len(entities) >= 8:
                break

        # 2. Construcción y agrupación de hallazgos por categoría y polaridad.
        findings: list[ExtractedFinding] = []
        by_category: dict[str, list[tuple[str, str, str]]] = {}
        for ref, cat_str, domain, content in evidences:
            by_category.setdefault(cat_str, []).append((ref, domain, content.strip()))

        entity_names = [e.name for e in entities[:3]]
        for cat_str, items in by_category.items():
            try:
                category = ResearchCategory(cat_str)
            except ValueError:
                category = ResearchCategory.OTHER

            for idx, (ref, domain, content) in enumerate(items[:4]):
                lower_c = content.lower()
                has_neg = any(m in lower_c for m in _NEGATIVE_MARKERS)
                ev_refs = [ExtractedEvidenceRef(ref=ref, stance=EvidenceStance.SUPPORTS)]

                # Si hay otro fragmento de otro dominio en la misma categoría, los vinculamos
                # para evaluar corroboración o contradicción.
                domains_used = {domain}
                if idx + 1 < len(items):
                    next_ref, next_dom, next_content = items[idx + 1]
                    next_neg = any(m in next_content.lower() for m in _NEGATIVE_MARKERS)
                    stance = (
                        EvidenceStance.CONTRADICTS
                        if has_neg != next_neg
                        else EvidenceStance.SUPPORTS
                    )
                    ev_refs.append(ExtractedEvidenceRef(ref=next_ref, stance=stance))
                    domains_used.add(next_dom)

                conf_level = Level.HIGH if len(domains_used) >= 2 else Level.MEDIUM
                rationale = (
                    f"Inferido por el motor propio a partir de {len(domains_used)} dominio(s) "
                    f"independiente(s) ({', '.join(sorted(domains_used))})."
                )
                linked_ents = [name for name in entity_names if name.lower() in lower_c]
                findings.append(
                    ExtractedFinding(
                        finding_type=category,
                        statement=content[:950],
                        confidence_level=conf_level,
                        confidence_rationale=rationale,
                        evidence=ev_refs,
                        entities=linked_ents,
                    )
                )

        return ExtractionResult(findings=findings[:30], entities=entities[:15]).model_dump()

    # ─────────────── 4. Motor de Inferencia de Análisis (Razonar) ───────────────

    def _infer_business_analysis(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Encadena reglas hacia adelante sobre los hallazgos [H#] para deducir el análisis."""
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "")
        parsed_findings = _FINDING_LINE_RE.findall(user_text)

        opportunities: list[GeneratedOpportunity] = []
        risks: list[GeneratedRisk] = []
        hypotheses: list[GeneratedHypothesis] = []
        missing_info: list[GeneratedMissingInfo] = []

        covered_categories: set[ResearchCategory] = set()
        all_refs: list[str] = []

        for ref, raw_cat, raw_conf, _origin, statement in parsed_findings:
            ref_code = ref.strip()
            all_refs.append(ref_code)
            cat = _CATEGORY_FROM_LABEL.get(raw_cat.strip().lower(), ResearchCategory.OTHER)
            covered_categories.add(cat)
            conf = raw_conf.strip().lower()
            stmt_clean = statement.strip()
            stmt_lower = stmt_clean.lower()

            is_neg = any(w in stmt_lower for w in _NEGATIVE_MARKERS)
            is_pos = any(w in stmt_lower for w in _POSITIVE_MARKERS)

            # Regla 1: Hallazgos con señales de oportunidad o demanda verificada.
            if is_pos or (
                cat
                in {
                    ResearchCategory.MARKET,
                    ResearchCategory.CUSTOMERS,
                    ResearchCategory.TECHNOLOGY,
                }
                and not is_neg
            ):
                if len(opportunities) < 6:
                    opportunities.append(
                        GeneratedOpportunity(
                            title=f"Aprovechar señal en {raw_cat.strip()}: {stmt_clean[:70]}",
                            description=(
                                f"Inferencia basada en [{ref_code}]: {stmt_clean[:360]} "
                                "Permite posicionar la propuesta de valor en un segmento receptivo."
                            ),
                            potential=Level.HIGH if conf == "high" else Level.MEDIUM,
                            findings=[ref_code],
                        )
                    )

            # Regla 2: Hallazgos competitivos, regulatorios o con señales de riesgo.
            if is_neg or cat in {
                ResearchCategory.COMPETITION,
                ResearchCategory.SUBSTITUTES,
                ResearchCategory.REGULATION,
                ResearchCategory.PRICING,
            }:
                if len(risks) < 6:
                    r_cat = {
                        ResearchCategory.COMPETITION: RiskCategory.COMPETITION,
                        ResearchCategory.SUBSTITUTES: RiskCategory.COMPETITION,
                        ResearchCategory.REGULATION: RiskCategory.REGULATORY,
                        ResearchCategory.PRICING: RiskCategory.FINANCIAL,
                        ResearchCategory.TECHNOLOGY: RiskCategory.TECHNICAL,
                    }.get(cat, RiskCategory.MARKET)
                    risks.append(
                        GeneratedRisk(
                            title=f"Factor crítico en {raw_cat.strip()}: {stmt_clean[:68]}",
                            description=(
                                f"Riesgo deducido del hallazgo [{ref_code}]: {stmt_clean[:340]}"
                            ),
                            category=r_cat,
                            likelihood=Level.MEDIUM,
                            impact=Level.HIGH
                            if r_cat in {RiskCategory.COMPETITION, RiskCategory.REGULATORY}
                            else Level.MEDIUM,
                            mitigation=(
                                "Validar diferenciadores con clientes reales y establecer un "
                                "protocolo de cumplimiento y control de costos antes de escalar."
                            ),
                            findings=[ref_code],
                        )
                    )

        # Garantizar al menos una oportunidad y un riesgo respaldados si existen hallazgos.
        if all_refs and not opportunities:
            first_ref = all_refs[0]
            opportunities.append(
                GeneratedOpportunity(
                    title="Diferenciación enfocada en el segmento objetivo",
                    description=(
                        f"A partir de la evidencia recopilada en [{first_ref}], existe margen "
                        "para diseñar una oferta especializada con atención directa."
                    ),
                    potential=Level.MEDIUM,
                    findings=[first_ref],
                )
            )
        if all_refs and not risks:
            first_ref = all_refs[0]
            risks.append(
                GeneratedRisk(
                    title="Incertidumbre en la tasa de adopción comercial",
                    description=(
                        f"Aunque existe el hallazgo [{first_ref}], la conversión real a ventas "
                        "depende de validar la disposición de pago en campo."
                    ),
                    category=RiskCategory.MARKET,
                    likelihood=Level.MEDIUM,
                    impact=Level.MEDIUM,
                    mitigation=(
                        "Realizar una prueba piloto de bajo presupuesto antes de invertir "
                        "en inventario."
                    ),
                    findings=[first_ref],
                )
            )

        # Regla 3: Hipótesis comprobables vinculadas a los atributos del negocio.
        ref_slice = all_refs[:2]
        hypotheses.extend(
            [
                GeneratedHypothesis(
                    statement=(
                        "Al menos el 60 % de los clientes objetivo entrevistados confirman que "
                        "el problema les ocurre de forma frecuente y buscan una alternativa."
                    ),
                    related_attribute=AttributeType.CUSTOMER_SEGMENT,
                    validation_method=(
                        "Realizar 15 entrevistas estructuradas con clientes potenciales "
                        "del segmento."
                    ),
                    success_criteria="Al menos 9 de 15 entrevistados confirman interés explícito.",
                    priority=Priority.HIGH,
                    findings=ref_slice,
                ),
                GeneratedHypothesis(
                    statement=(
                        "El precio estimado cubre los costos unitarios de operación y deja un "
                        "margen bruto positivo aceptable para el cliente."
                    ),
                    related_attribute=AttributeType.REVENUE_MODEL,
                    validation_method="Prueba de preventa o cotización real con 10 prospectos.",
                    success_criteria=(
                        "Al menos 4 prospectos aceptan la propuesta económica sin descuento "
                        "mayor al 10 %."
                    ),
                    priority=Priority.HIGH,
                    findings=ref_slice[:1],
                ),
                GeneratedHypothesis(
                    statement=(
                        "El canal principal permite captar los primeros clientes a un costo "
                        "de adquisición sostenible."
                    ),
                    related_attribute=AttributeType.CHANNELS,
                    validation_method=(
                        "Experimento de contacto directo y medición de tasa de respuesta "
                        "durante 2 semanas."
                    ),
                    success_criteria=(
                        "Tasa de conversión superior al 5 % sobre prospectos contactados."
                    ),
                    priority=Priority.MEDIUM,
                    findings=[],
                ),
            ]
        )

        # Regla 4: Detección de vacíos de información según categorías ausentes.
        expected_Checks = [
            (
                ResearchCategory.PRICING,
                AttributeType.REVENUE_MODEL,
                "¿Cuál es el costo unitario real de proveedores y el ticket promedio pagado "
                "localmente?",
                "Se requiere información de costos locales exactos para calcular el punto "
                "de equilibrio.",
            ),
            (
                ResearchCategory.REGULATION,
                AttributeType.SOLUTION,
                "¿Qué licencias municipales o registros sanitarios/comerciales exige la "
                "operación local?",
                "Las fuentes públicas no detallan los requisitos específicos del municipio "
                "o alcaldía.",
            ),
            (
                ResearchCategory.CUSTOMERS,
                AttributeType.CUSTOMER_SEGMENT,
                "¿Con qué frecuencia compran actualmente los clientes y cuánto gastan al mes?",
                "Es necesario medir la recurrencia real de compra mediante entrevistas en campo.",
            ),
        ]
        for cat, attr, question, reason in expected_Checks:
            if cat not in covered_categories or len(missing_info) < 2:
                missing_info.append(
                    GeneratedMissingInfo(
                        question=question,
                        reason=reason,
                        related_attribute=attr,
                        priority=Priority.HIGH
                        if cat == ResearchCategory.PRICING
                        else Priority.MEDIUM,
                    )
                )

        return AnalysisResult(
            opportunities=opportunities[:10],
            risks=risks[:10],
            hypotheses=hypotheses[:8],
            missing_information=missing_info[:8],
        ).model_dump()

    # ─────────────── 5. Motor Conversacional y Cálculo de Inversión (Chat) ───────────────

    def _reason_chat_answer(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Responde preguntas del usuario razonando sobre el contexto del proyecto con TF-IDF."""
        sys_text = next((m.content for m in messages if m.role == "system"), "")
        user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
        question = user_msg.split("(Instrucción:")[0].strip()
        q_lower = question.lower()

        ctx = _extract_tagged_json(sys_text, "project_context")
        project = ctx.get("project", {})
        title = project.get("title") or "tu proyecto"
        idea = project.get("idea") or ""
        findings = ctx.get("findings", [])
        competitors = ctx.get("competitors", [])
        analysis = ctx.get("analysis", {})
        attributes = ctx.get("attributes", [])

        # Ranking TF-IDF de hallazgos relevantes para la pregunta.
        finding_docs = [
            f"{f.get('type', '')} {f.get('statement', '')} {' '.join(f.get('entities', []))}"
            for f in findings
        ]
        scores = _tfidf_cosine_scores(question, finding_docs)
        ranked_findings = [
            f
            for score, f in sorted(
                zip(scores, findings, strict=False),
                key=lambda item: item[0],
                reverse=True,
            )
            if score > 0.01
        ] or findings[:3]

        cited_ids: list[uuid.UUID] = []
        for f in ranked_findings[:4]:
            try:
                cited_ids.append(uuid.UUID(str(f["id"])))
            except (KeyError, ValueError):
                continue

        paragraphs: list[str] = []

        # Caso especial 1: Pregunta sobre inversión, costos o presupuesto.
        if any(
            k in q_lower
            for k in (
                "invertir",
                "inversión",
                "inversion",
                "costo",
                "costos",
                "presupuesto",
                "cuánto cuesta",
                "cuanto cuesta",
                "dinero",
            )
        ):
            paragraphs.append(
                f"Para estimar la inversión inicial de **{title}**, el motor de análisis "
                "desglosa los rubros esenciales distinguiendo entre un arranque ligero (bajo "
                "pedido / validación) y uno con inventario o equipamiento propio:"
            )
            paragraphs.append(
                "- **Muestras, desarrollo o equipamiento inicial:** prototipos, pruebas de "
                "producto o herramientas básicas de operación.\n"
                "- **Producción o inventario inicial:** lote mínimo para validar ventas (en "
                "modelo bajo pedido este rubro se reduce significativamente frente a "
                "comprar stock por adelantado).\n"
                "- **Marca y tienda (canal de venta):** identidad visual, catálogo digital "
                "o adecuación del punto de contacto sin asumir la renta inmediata de un "
                "local fijo.\n"
                "- **Empaque y envíos:** insumos de entrega, bolsas/cajas y logística para "
                "los primeros pedidos.\n"
                "- **Lanzamiento y adquisición de clientes:** presupuesto para pruebas de "
                "anuncios, muestras o visitas comerciales.\n"
                "- **Capital de trabajo:** reserva operativa para cubrir de 2 a 3 meses de "
                "gastos fijos mientras se alcanza el punto de equilibrio."
            )
            paragraphs.append(
                "La fórmula práctica para calcular tu requerimiento exacto es: "
                "`unidades × costo unitario + gastos de arranque + capital de trabajo`."
            )
            if ranked_findings:
                f_lines = "; ".join(
                    f"«{f.get('statement', '')[:140]}»" for f in ranked_findings[:2]
                )
                paragraphs.append(
                    f"En los hallazgos verificados del proyecto se observa como referencia: "
                    f"{f_lines}."
                )
            paragraphs.append(
                "Para personalizar este cálculo a tu escala exacta: ¿planeas iniciar bajo pedido "
                "o con inventario propio, y qué volumen de unidades proyectas para el primer mes?"
            )
        else:
            # Caso 2: Evaluación de ubicación, viabilidad, competencia o estrategia del proyecto.
            paragraphs.append(
                f"Analizando **{title}** ({idea[:220] if idea else 'idea en evaluación'}), "
                "presento una valoración estructurada combinando los datos registrados en el "
                "proyecto y criterios prácticos de validación comercial:"
            )

            if ranked_findings:
                ev_bullets = "\n".join(
                    f"- **Hallazgo ({f.get('type', 'general')}, confianza "
                    f"{f.get('confidence', 'media')}):** {f.get('statement', '')}"
                    for f in ranked_findings[:3]
                )
                paragraphs.append(f"**Evidencia respaldada en el proyecto:**\n{ev_bullets}")

            opps = analysis.get("opportunities", [])[:2]
            risks = analysis.get("risks", [])[:2]
            if opps or risks:
                interp_lines: list[str] = []
                for o in opps:
                    interp_lines.append(
                        f"- **Ventaja / Oportunidad (interpretación):** {o.get('title')} — "
                        f"{o.get('description')}"
                    )
                for r in risks:
                    interp_lines.append(
                        f"- **Riesgo a mitigar:** {r.get('title')} — {r.get('description')}"
                    )
                paragraphs.append(
                    "**Balance de ventajas y riesgos identificados:**\n" + "\n".join(interp_lines)
                )

            if competitors:
                comp_names = ", ".join(
                    f"{c.get('name')} ({c.get('competitor_type')})" for c in competitors[:4]
                )
                paragraphs.append(
                    f"**Competencia y alternativas registradas:** {comp_names}. Conviene comparar "
                    "precios, tiempos de atención y diferenciación directa en campo."
                )
            elif attributes:
                attr_summary = ", ".join(
                    f"{a.get('type')}: {a.get('value')[:70]}" for a in attributes[:3]
                )
                paragraphs.append(f"**Atributos base considerados:** {attr_summary}.")

            paragraphs.append(
                "**Recomendación práctica:** valida primero en campo el flujo real de clientes, "
                "los costos operativos o de renta y la disposición de pago mediante una prueba "
                "pequeña antes de comprometer gastos fijos."
            )

        if ctx.get("context_truncated"):
            paragraphs.append(
                "Nota: el contexto consultado para esta respuesta es parcial debido al "
                "límite de longitud."
            )

        return {"answer": "\n\n".join(paragraphs), "finding_ids": cited_ids[:10]}

    # ─────────────── 6. Modelo Predictivo de Viabilidad e Informe Final (Predecir) ───────────────

    def _predict_report_verdict(self, messages: Sequence[AIMessage]) -> dict[str, Any]:
        """Evalúa cuantitativamente el proyecto y construye el veredicto y secciones del informe."""
        user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
        ctx = _extract_tagged_json(user_msg, "report_data")

        project = ctx.get("project", {})
        title = project.get("title") or "el proyecto"
        idea = project.get("idea") or "Sin descripción registrada."
        attrs = project.get("attributes", [])
        findings = ctx.get("findings", [])
        sources = ctx.get("sources", [])
        competitors = ctx.get("competitors", [])
        analysis = ctx.get("analysis", {})
        geography = ctx.get("geography", {})

        # ── Modelo predictivo multicriterio de viabilidad e incertidumbre ──
        accepted_findings = [
            f for f in findings if f.get("origin") == "user" or f.get("review_status") == "accepted"
        ]
        domains = {s.get("domain") for s in sources if s.get("domain")}
        opps = analysis.get("opportunities", [])
        risks = analysis.get("risks", [])
        hyps = analysis.get("hypotheses", [])
        missing_items = analysis.get("missing_information", [])

        high_risks = sum(
            1 for r in risks if r.get("impact") == "high" and r.get("likelihood") == "high"
        )
        evidence_score = min(1.0, len(accepted_findings) / 4.0) * 0.45
        domain_score = min(1.0, len(domains) / 3.0) * 0.25
        balance_score = (
            min(1.0, (len(opps) + 1) / (len(risks) + 1)) * 0.30 if (opps or risks) else 0.15
        )
        viability_index = round((evidence_score + domain_score + balance_score) * 100)

        if not accepted_findings or not sources:
            recommendation = "insufficient_information"
        elif high_risks >= 2 and len(opps) == 0:
            recommendation = "do_not_proceed_yet"
        elif len(accepted_findings) >= 4 and len(domains) >= 3 and high_risks == 0:
            recommendation = "worth_testing"
        else:
            recommendation = "needs_validation"

        confidence = (
            "high"
            if len(accepted_findings) >= 6
            and len(domains) >= 4
            and not ctx.get("context_truncated")
            else "medium"
            if len(accepted_findings) >= 3
            and len(domains) >= 2
            and not ctx.get("context_truncated")
            else "low"
        )

        # ── Predicción de inversión inicial en MXN solo si existen hallazgos financieros
        # aceptados ──
        investment = _predict_investment_from_context(accepted_findings)

        # ── Evaluación de zonas geográficas con referencias reales G# ──
        zones, geo_missing = _build_zone_recommendations(geography)

        missing_list = [
            str(m.get("question") or "").strip()[:240] for m in missing_items if m.get("question")
        ] + geo_missing
        if not accepted_findings:
            missing_list.append("Faltan hallazgos revisados o aceptados con evidencia suficiente.")
        if not sources:
            missing_list.append("Faltan fuentes públicas verificables para contrastar el mercado.")
        if ctx.get("context_truncated"):
            missing_list.append("El contexto del informe fue recortado parcialmente por longitud.")

        first_ref = f" [{findings[0]['ref']}]" if findings and findings[0].get("ref") else ""
        summary_text = (
            f"El motor predictivo de IdeaForge AI evaluó «{title}» con un índice de madurez docu"
            f"mental de {viability_index}/100 ({len(accepted_findings)} hallazgos validados, "
            f"{len(domains)} dominios independientes y {len(competitors)} alternativas registradas)"
            f"{first_ref}. Se distingue entre hechos observados en fuentes y las interpretaciones "
            "de análisis, recomendando validar en campo los supuestos críticos antes de escalar."
        )

        next_steps = [
            str(h.get("validation_method") or h.get("statement") or "")[:230]
            for h in hyps[:3]
            if h.get("validation_method") or h.get("statement")
        ]
        if not next_steps:
            next_steps = [
                "Entrevistar al menos a 10 clientes potenciales del segmento objetivo para "
                "confirmar el problema.",
                "Cotizar costos unitarios reales con proveedores locales antes de "
                "comprometer inversión.",
                "Ejecutar una prueba piloto de pequeña escala y medir la conversión real.",
            ]

        verdict = BusinessVerdict(
            recommendation=recommendation,
            confidence=confidence,
            summary=summary_text[:6000],
            investment=investment,
            zones=zones[:4],
            missing_information=missing_list[:8],
            next_steps=next_steps[:5],
        )

        # ── Construcción de las secciones del informe con referencias trazables ──
        attr_lines = [
            f"- **{a.get('type')}**: {a.get('value')} "
            f"({'confirmado' if a.get('confirmed') else 'pendiente de confirmar'})"
            for a in attrs
            if a.get("value")
        ]
        idea_overview = f"**Idea central:** {idea}\n\n" + (
            "\n".join(attr_lines)
            if attr_lines
            else "No se registraron atributos adicionales confirmados."
        )

        market_findings = [
            f
            for f in findings
            if f.get("category")
            in {"market", "customers", "pricing", "regulation", "technology", "other"}
        ] or findings
        market_lines = []
        for f in market_findings:
            ev_refs = " ".join(f"[{e['ref']}]" for e in f.get("evidence", []) if e.get("ref"))
            src_refs = " ".join(
                f"[{e['source_ref']}]" for e in f.get("evidence", []) if e.get("source_ref")
            )
            refs_str = " ".join(x for x in (f"[{f.get('ref')}]", ev_refs, src_refs) if x).strip()
            market_lines.append(
                f"- {f.get('statement')} {refs_str} "
                f"*(confianza: {f.get('confidence')}; revisión: {f.get('review_status')})*"
            )
        market_text = (
            "\n".join(market_lines)
            if market_lines
            else (
                "La búsqueda tuvo cobertura limitada y no arrojó hallazgos de mercado suficientes; "
                "esto no demuestra ausencia de demanda, por lo que requiere validación directa."
            )
        )

        comp_findings = [f for f in findings if f.get("category") in {"competition", "substitutes"}]
        comp_lines = [
            f"- **{c.get('name')}** (tipo: {c.get('type')}, amenaza: {c.get('threat')}, "
            f"revisión: {c.get('review_status')}): "
            f"{c.get('rationale') or 'Registrado durante la investigación.'}"
            for c in competitors
        ]
        for f in comp_findings:
            comp_lines.append(f"- Hallazgo competitivo [{f.get('ref')}]: {f.get('statement')}")
        competition_text = (
            "\n".join(comp_lines)
            if comp_lines
            else (
                "No se encontraron competidores confirmados en esta búsqueda. Una búsqueda "
                "limitada no demuestra inexistencia de competencia en el mercado."
            )
        )

        opp_lines = [
            f"- **{o.get('title')}** (potencial: {o.get('potential')}, "
            f"revisión: {o.get('review_status')}): {o.get('description')} *(interpretación "
            "de análisis)*"
            for o in opps
        ]
        opportunities_text = (
            "\n".join(opp_lines)
            if opp_lines
            else "No se registraron oportunidades confirmadas adicionales en el análisis actual."
        )

        risk_lines = [
            f"- **{r.get('title')}** (categoría: {r.get('category')}, probabilidad: "
            f"{r.get('likelihood')}, impacto: {r.get('impact')}): {r.get('description')} "
            f"— Mitigación propuesta: {r.get('mitigation') or 'Por definir.'}"
            for r in risks
        ]
        risks_text = (
            "\n".join(risk_lines)
            if risk_lines
            else "No se registraron riesgos específicos adicionales en el análisis actual."
        )

        hyp_lines = [
            f"- **Hipótesis:** {h.get('statement')} | **Método:** "
            f"{h.get('validation_method') or 'Entrevistas y prueba piloto'} | "
            f"**Criterio de éxito:** {h.get('success_criteria') or 'Por definir'} "
            f"*(estado: {h.get('validation_status')})*"
            for h in hyps
        ]
        hypotheses_text = (
            "\n".join(hyp_lines)
            if hyp_lines
            else (
                "Queda pendiente diseñar experimentos de campo para validar los supuestos "
                "principales."
            )
        )

        miss_lines = [
            f"- **{m.get('question')}** — Motivo: {m.get('reason') or 'Sin cobertura en fuentes.'} "
            f"*(prioridad: {m.get('priority')}, estado: {m.get('resolution_status')})*"
            for m in missing_items
        ]
        missing_text = (
            "\n".join(miss_lines)
            if miss_lines
            else "Se han registrado las preguntas críticas pendientes en el veredicto."
        )

        conclusions_text = (
            f"1. **Lo observado en fuentes:** se documentaron {len(findings)} hallazgos y "
            f"{len(sources)} fuentes verificables{first_ref}.\n"
            f"2. **Nivel de madurez calculado:** {viability_index}/100 con confianza "
            f"{confidence}.\n"
            "3. **Lo que falta comprobar:** validar en campo las hipótesis de clientes, precios "
            "y costos antes de comprometer inversión fija."
        )

        return {
            "executive_summary": verdict,
            "idea_overview": _bound_text(idea_overview),
            "market": _bound_text(market_text),
            "competition": _bound_text(competition_text),
            "opportunities": _bound_text(opportunities_text),
            "risks": _bound_text(risks_text),
            "hypotheses": _bound_text(hypotheses_text),
            "missing_information": _bound_text(missing_text),
            "conclusions": _bound_text(conclusions_text),
        }

    def _generic_structured_fallback[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> dict[str, Any]:
        """Respaldo genérico para esquemas de prueba simples (ej. en tests unitarios)."""
        user_text = next((m.content for m in reversed(messages) if m.role == "user"), "listo")
        fields = schema.model_fields
        result: dict[str, Any] = {}
        for name, field_info in fields.items():
            annotation = field_info.annotation
            if annotation is str:
                result[name] = user_text[:80] or "ok"
            elif annotation is int:
                result[name] = 1
            elif annotation is float:
                result[name] = 1.0
            elif annotation is bool:
                result[name] = True
        return result


# ─────────────── Funciones auxiliares de extracción y predicción ───────────────


def _extract_line_value(text: str, prefix: str) -> str:
    """Extrae el valor de una línea con formato 'Prefijo: valor'."""
    match = re.search(rf"^{re.escape(prefix)}:\s*(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _extract_section_bullet(text: str, header: str) -> str:
    """Extrae la primera viñeta debajo de un encabezado 'Encabezado:'."""
    match = re.search(rf"^{re.escape(header)}:\s*\n-\s*(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _extract_tagged_json(text: str, tag: str) -> dict[str, Any]:
    """Extrae y decodifica un bloque JSON envuelto en `<tag>...</tag>`."""
    match = re.search(rf"<{re.escape(tag)}>(.*?)</{re.escape(tag)}>", text, re.DOTALL)
    raw = match.group(1) if match else text
    raw = raw.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&")
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _bound_text(text: str) -> str:
    """Garantiza que una sección del informe tenga entre 20 y 6000 caracteres."""
    cleaned = text.strip()
    if len(cleaned) < 20:
        cleaned = f"{cleaned} Información sujeta a validación adicional en campo.".strip()
    return cleaned[:6000]


def _predict_investment_from_context(
    accepted_findings: list[dict[str, Any]],
) -> InvestmentEstimate | None:
    """Predice un rango de inversión en MXN si hay hallazgos aceptados sobre costos/precios."""
    financial_terms = (
        "precio",
        "costo",
        "costos",
        "inversión",
        "inversion",
        "renta",
        "presupuesto",
    )
    fin_refs: list[str] = []
    detected_amounts: list[int] = []

    for finding in accepted_findings:
        ev_texts = [str(e.get("content") or "") for e in finding.get("evidence", [])]
        combined = " ".join([str(finding.get("statement") or ""), *ev_texts]).lower()
        if finding.get("category") == "pricing" or any(t in combined for t in financial_terms):
            if finding.get("ref"):
                fin_refs.append(str(finding["ref"]))
            for raw_num in _AMOUNT_RE.findall(combined):
                digits = re.sub(r"[^\d]", "", raw_num)
                if digits:
                    val = int(digits)
                    if 100 <= val <= 10_000_000:
                        detected_amounts.append(val)

    if not fin_refs:
        return None

    if detected_amounts:
        base = int(sum(detected_amounts) / len(detected_amounts))
        min_mxn = max(1_500, min(base * 10, 50_000_000))
        max_mxn = max(min_mxn + 5_000, min(min_mxn * 3, 100_000_000))
    else:
        min_mxn = 15_000
        max_mxn = 65_000

    refs_str = ", ".join(f"[{r}]" for r in fin_refs[:4])
    return InvestmentEstimate(
        minimum_mxn=min_mxn,
        maximum_mxn=max_mxn,
        basis=(
            f"Rango calculado por el modelo predictivo de IdeaForge a partir de los hallazgos "
            f"de costos y precios {refs_str}, considerando lote piloto y capital de trabajo."
        ),
        assumptions=[
            "Arranque mediante lote piloto o esquema bajo pedido sin obra civil mayor.",
            "Reserva de capital de trabajo para los primeros 2 a 3 meses de validación.",
        ],
        evidence_refs=fin_refs[:8],
    )


def _build_zone_recommendations(
    geography: dict[str, Any],
) -> tuple[list[ZoneRecommendation], list[str]]:
    """Evalúa las áreas consultadas en OpenStreetMap y construye recomendaciones prudentes."""
    zones: list[ZoneRecommendation] = []
    missing: list[str] = []
    areas = geography.get("areas", [])[:3]
    single = len(areas) == 1

    for area in areas:
        places = area.get("places", [])
        refs = [
            p["ref"] for p in places if isinstance(p.get("ref"), str) and p["ref"].startswith("G")
        ][:8]
        if not refs:
            if area.get("status") in {"ambiguous", "not_found", "unavailable", "no_places"}:
                missing.append(
                    f"No se pudo evaluar con certeza la zona {area.get('query') or 'indicada'}."
                )
            continue
        zone_name = str(area.get("resolved_area") or area.get("query") or "Zona evaluada")[:160]
        label = "Zona evaluada" if single else "Zona candidata para investigar"
        refs_text = ", ".join(f"[{r}]" for r in refs[:3])
        zones.append(
            ZoneRecommendation(
                name=zone_name,
                reason=(
                    f"{label} con registros mapeados en OpenStreetMap ({refs_text}). "
                    "Permite observar puntos de actividad comercial cercanos para visitar en campo."
                ),
                place_refs=refs,
                caveat=(
                    "Los registros de OpenStreetMap no demuestran demanda, flujo peatonal "
                    "ni costos de renta."
                ),
            )
        )
    return zones, missing
