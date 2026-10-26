import json
import re
import uuid
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ValidationError

from app.core.enums import AIProviderName
from app.modules.ai.errors import (
    AIInvalidResponseError,
    AIProviderError,
)
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.providers.http import post_json
from app.modules.ai.providers.web_search import synthesize_grounded_from_web
from app.modules.ai.types import AIMessage, AIUsage, GroundedResult, StructuredResult


class OllamaProvider(AIProvider):
    name = AIProviderName.OLLAMA

    def __init__(self, base_url: str, model: str, timeout: float, think: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.think = think

    def _annotate(self, error: AIProviderError) -> AIProviderError:
        error.provider = self.name
        error.model = self.model
        return error

    async def generate_structured[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        is_chat_answer = schema.__name__ == "ChatAnswer"
        is_report_draft = schema.__name__ == "ReportDraft"
        if is_report_draft:
            return await self._generate_report_draft(messages, schema)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": message.role, "content": message.content} for message in messages
            ],
            "stream": False,
            "think": self.think,
            "keep_alive": "30m",
            "options": {
                "temperature": 0.6 if is_chat_answer else 0.2,
                "num_ctx": 8192 if is_chat_answer else 4096,
                "num_predict": 4096 if is_chat_answer else 1400,
                "repeat_penalty": 1.15 if is_chat_answer else 1.0,
                "top_p": 0.9 if is_chat_answer else 1.0,
            },
        }
        # En el chat no forzamos GBNF JSON (`format`), para que no corte tras ":" + salto de línea
        if not is_chat_answer:
            payload["format"] = schema.model_json_schema()
        try:
            response = await post_json(f"{self.base_url}/api/chat", payload, {}, self.timeout)
            message = response.get("message")
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str):
                raise AIInvalidResponseError()
            if is_chat_answer:
                data = _parse_chat_content(content, schema)
            else:
                data = schema.model_validate_json(content)
        except (AIProviderError, ValidationError, json.JSONDecodeError) as exc:
            if isinstance(exc, AIProviderError):
                raise self._annotate(exc) from None
            raise self._annotate(AIInvalidResponseError()) from None

        return StructuredResult(
            data=data,
            usage=AIUsage(
                input_tokens=_token_count(response.get("prompt_eval_count")),
                output_tokens=_token_count(response.get("eval_count")),
                estimated_cost_usd=Decimal(0),
            ),
            provider=self.name,
            model=self.model,
        )

    async def _generate_report_draft[T: BaseModel](
        self, messages: Sequence[AIMessage], schema: type[T]
    ) -> StructuredResult[T]:
        user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
        raw_json = user_msg.removeprefix("<report_data>").removesuffix("</report_data>")
        raw_json = raw_json.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&")
        try:
            ctx = json.loads(raw_json)
        except json.JSONDecodeError:
            ctx = {}

        title = ctx.get("project", {}).get("title") or "Proyecto"
        idea = (ctx.get("project", {}).get("idea") or "")[:500]
        findings_summary = [
            f"[{f.get('ref')}] {f.get('statement')}" for f in ctx.get("findings", [])[:6]
        ]
        opps_summary = [
            o.get("title") for o in ctx.get("analysis", {}).get("opportunities", [])[:4]
        ]
        risks_summary = [r.get("title") for r in ctx.get("analysis", {}).get("risks", [])[:4]]

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Redacta en español y sin HTML (1) un Resumen Ejecutivo de un párrafo "
                        "claro y (2) las Conclusiones y próximos pasos de un párrafo basándote "
                        "solo en los datos del proyecto. Sepáralos con ===CONCLUSIONES===."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Proyecto: {title}\nIdea: {idea}\n"
                        f"Hallazgos principales: {findings_summary}\n"
                        f"Oportunidades: {opps_summary}\nRiesgos: {risks_summary}"
                    ),
                },
            ],
            "stream": False,
            "think": self.think,
            "keep_alive": "30m",
            "options": {"num_ctx": 2048, "num_predict": 420, "temperature": 0.2},
        }
        try:
            response = await post_json(f"{self.base_url}/api/chat", payload, {}, self.timeout)
            message = response.get("message")
            content = message.get("content") if isinstance(message, dict) else None
            if not isinstance(content, str):
                raise AIInvalidResponseError()
            draft_dict = _assemble_report_draft_from_context(ctx, content)
            data = schema.model_validate(draft_dict)
        except (AIProviderError, ValidationError, json.JSONDecodeError) as exc:
            if isinstance(exc, AIProviderError):
                raise self._annotate(exc) from None
            raise self._annotate(AIInvalidResponseError()) from None

        return StructuredResult(
            data=data,
            usage=AIUsage(
                input_tokens=_token_count(response.get("prompt_eval_count")),
                output_tokens=_token_count(response.get("eval_count")),
                estimated_cost_usd=Decimal(0),
            ),
            provider=self.name,
            model=self.model,
        )

    async def generate_grounded(self, messages: Sequence[AIMessage]) -> GroundedResult:
        try:
            return await synthesize_grounded_from_web(self, messages, self.timeout)
        except AIProviderError as exc:
            raise self._annotate(exc) from None


_UUID_RE = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)


def _parse_chat_content[T: BaseModel](content: str, schema: type[T]) -> T:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        try:
            return schema.model_validate_json(stripped)
        except ValidationError:
            pass
    found_ids: list[uuid.UUID] = []
    for raw_id in _UUID_RE.findall(stripped):
        try:
            uid = uuid.UUID(raw_id)
            if uid not in found_ids:
                found_ids.append(uid)
        except ValueError:
            continue
    clean_answer = re.sub(
        r"\n*\s*(?:finding_ids|referencias_ids)\s*:\s*\[.*?\]\s*$",
        "",
        stripped,
        flags=re.IGNORECASE | re.DOTALL,
    ).strip()
    return schema.model_validate(
        {"answer": clean_answer or stripped, "finding_ids": found_ids[:10]}
    )


def _assemble_report_draft_from_context(ctx: dict[str, Any], llm_text: str) -> dict[str, str]:
    parts = llm_text.split("===CONCLUSIONES===", 1)
    exec_summary = re.sub(r"^\*\*Resumen Ejecutivo\*\*\s*", "", parts[0].strip(), flags=re.I)
    conclusions = (
        parts[1].strip()
        if len(parts) > 1 and len(parts[1].strip()) >= 40
        else (
            "Con base en los hallazgos recopilados y el análisis del proyecto, se recomienda "
            "validar en campo las hipótesis prioritarias y resolver la información faltante "
            "antes de comprometer capital fijo."
        )
    )
    if len(exec_summary) < 40:
        title = ctx.get("project", {}).get("title") or "el proyecto"
        exec_summary = (
            f"Este informe sintetiza la evaluación y validación basada en evidencia para {title}, "
            "integrando los atributos confirmados, los hallazgos de investigación web y los "
            "cuatro cuadrantes de análisis."
        )

    project = ctx.get("project", {})
    attrs = project.get("attributes", [])
    attr_lines = [
        f"- **{a.get('type')}**: {a.get('value')} "
        f"({'confirmado' if a.get('confirmed') else 'pendiente'})"
        for a in attrs
        if a.get("value")
    ]
    idea_overview = f"**Idea central:** {project.get('idea') or 'Sin descripción.'}\n\n" + (
        "\n".join(attr_lines)
        if attr_lines
        else "Atributos estructurados registrados en el proyecto."
    )

    findings = ctx.get("findings", [])
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
            f"*(confianza: {f.get('confidence')}; estado: {f.get('review_status')})*"
        )
    market_text = (
        "\n".join(market_lines)
        if market_lines
        else (
            "La investigación no arrojó hallazgos específicos de mercado con evidencia suficiente; "
            "se requiere validación directa con clientes potenciales."
        )
    )

    competitors = ctx.get("competitors", [])
    comp_findings = [f for f in findings if f.get("category") in {"competition", "substitutes"}]
    comp_lines = [
        f"- **{c.get('name')}** (tipo: {c.get('type')}, amenaza: {c.get('threat')}, "
        f"revisión: {c.get('review_status')}): "
        f"{c.get('rationale') or 'Identificado en la investigación.'}"
        for c in competitors
    ]
    for f in comp_findings:
        comp_lines.append(f"- Hallazgo competitivo [{f.get('ref')}]: {f.get('statement')}")
    competition_text = (
        "\n".join(comp_lines)
        if comp_lines
        else (
            "No se registraron competidores confirmados en esta ejecución. La ausencia de "
            "resultados no demuestra inexistencia de competencia local."
        )
    )

    analysis = ctx.get("analysis", {})
    opps = analysis.get("opportunities", [])
    opp_lines = [
        f"- **{o.get('title')}** (potencial: {o.get('potential')}, "
        f"revisión: {o.get('review_status')}): {o.get('description')} *(interpretación de IA)*"
        for o in opps
    ]
    opportunities_text = (
        "\n".join(opp_lines)
        if opp_lines
        else "No se registraron oportunidades adicionales en el análisis actual."
    )

    risks = analysis.get("risks", [])
    risk_lines = [
        f"- **{r.get('title')}** (categoría: {r.get('category')}, probabilidad: "
        f"{r.get('likelihood')}, impacto: {r.get('impact')}): {r.get('description')} "
        f"— Mitigación propuesta: {r.get('mitigation') or 'Por definir.'}"
        for r in risks
    ]
    risks_text = (
        "\n".join(risk_lines)
        if risk_lines
        else "No se registraron riesgos específicos en el análisis actual."
    )

    hyps = analysis.get("hypotheses", [])
    hyp_lines = [
        f"- **Hipótesis:** {h.get('statement')} | **Método de validación:** "
        f"{h.get('validation_method')} | **Criterio de éxito:** {h.get('success_criteria')} "
        f"*(estado: {h.get('validation_status')})*"
        for h in hyps
    ]
    hypotheses_text = (
        "\n".join(hyp_lines)
        if hyp_lines
        else "Queda pendiente definir experimentos formales de validación con usuarios."
    )

    missing = analysis.get("missing_information", [])
    miss_lines = [
        f"- **{m.get('question')}** — Motivo: {m.get('reason')} "
        f"*(prioridad: {m.get('priority')}, estado: {m.get('resolution_status')})*"
        for m in missing
    ]
    missing_text = (
        "\n".join(miss_lines)
        if miss_lines
        else "Toda la información crítica inicial fue registrada o revisada."
    )

    return {
        "executive_summary": exec_summary,
        "idea_overview": idea_overview,
        "market": market_text,
        "competition": competition_text,
        "opportunities": opportunities_text,
        "risks": risks_text,
        "hypotheses": hypotheses_text,
        "missing_information": missing_text,
        "conclusions": conclusions,
    }


def _token_count(value: Any) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None
