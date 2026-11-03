"""Construye el contexto acotado para el asistente. Area: asistente contextual.

ARCHIVO: backend/app/modules/chat/context.py

¿Qué es?
El armador del "resumen del proyecto" que se le envía a la IA junto con cada pregunta. Reúne la
idea, sus atributos, los hallazgos, los competidores, el análisis y el último informe, y lo recorta
para que quepa en un tamaño fijo.

¿Para qué sirve?
Para que la IA responda con los datos reales del proyecto y no tenga que adivinar. Al mismo tiempo,
cuida el tamaño: si el contexto es muy grande, quita primero lo menos importante.

¿Quién lo usa?
service.py (build_project_context antes de cada respuesta del chat).

Límites principales:
- Tamaño máximo del contexto: 3500 caracteres (MAX_CONTEXT_CHARS).
- Hasta 12 hallazgos, 2 evidencias por hallazgo, 8 competidores y 6 elementos de análisis por tipo.

Importante: la función devuelve también las referencias de cada hallazgo (con sus fuentes). Así la
respuesta del chat puede mostrar de dónde sale cada dato. Un hallazgo que no entró en el contexto
no se puede citar.
"""

import json
import uuid
from collections import defaultdict
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ReviewStatus
from app.modules.analysis.models import (
    HypothesisFinding,
    MissingInformation,
    Opportunity,
    OpportunityFinding,
    Risk,
    RiskFinding,
    ValidationHypothesis,
)
from app.modules.chat.schemas import ChatEvidenceReference, ChatFindingReference
from app.modules.entities.models import Competitor, Entity
from app.modules.findings.models import Finding
from app.modules.findings.repository import FindingRepository
from app.modules.projects.models import IdeaAttribute, Project
from app.modules.reports.models import Report, ReportSection, ReportStatus

# Límites del contexto. Cambiarlos afecta cuánto ve la IA y cuánto cuesta cada pregunta.
MAX_CONTEXT_CHARS = 3500  # Tamaño máximo del resumen completo, en caracteres.
MAX_FINDINGS = 12  # Hallazgos más recientes que se incluyen.
MAX_EVIDENCE_PER_FINDING = 2  # Evidencias por hallazgo.
MAX_COMPETITORS = 8  # Competidores que se incluyen.
MAX_ANALYSIS_ITEMS = 6  # Elementos por cada tipo de análisis.
MAX_REPORT_SECTIONS = 6  # Secciones del último informe.


def _short(value: str | None, limit: int) -> str | None:
    """Recorta un texto a un máximo de caracteres. Si está vacío o es nulo, devuelve None."""
    return value[:limit] if value else None


def _safe_source_url(value: str) -> str | None:
    """Devuelve la dirección de la fuente solo si es http o https y sin credenciales."""
    try:
        parts = urlsplit(value)
    except ValueError:
        return None
    # Descarta esquemas raros (por ejemplo "javascript:") y direcciones con usuario o contraseña.
    if (
        parts.scheme not in {"https", "http"}
        or not parts.hostname
        or parts.username
        or parts.password
    ):
        return None
    return value


async def build_project_context(
    session: AsyncSession, project: Project
) -> tuple[dict, dict[str, ChatFindingReference]]:
    """Arma el resumen del proyecto y las referencias de hallazgos que se pueden citar.

    Devuelve dos cosas:
    - el contexto (un diccionario que se manda a la IA como JSON);
    - las referencias de los hallazgos que sí cupieron en el contexto, indexadas por su id.
    """
    attributes = await session.scalars(
        select(IdeaAttribute)
        .where(IdeaAttribute.project_id == project.id)
        .order_by(IdeaAttribute.attribute_type, IdeaAttribute.position)
        .limit(20)
    )
    # Los hallazgos más recientes que no estén rechazados.
    findings = list(
        await session.scalars(
            select(Finding)
            .where(
                Finding.project_id == project.id,
                Finding.review_status != ReviewStatus.REJECTED,
            )
            .order_by(Finding.created_at.desc(), Finding.id)
            .limit(MAX_FINDINGS)
        )
    )
    finding_repository = FindingRepository(session)
    finding_ids = [finding.id for finding in findings]
    # Agrupa las evidencias por hallazgo, y guarda solo las primeras dos de cada uno.
    evidence_by_finding: dict = defaultdict(list)
    for link, evidence, source in await finding_repository.evidence_for(finding_ids):
        if len(evidence_by_finding[link.finding_id]) >= MAX_EVIDENCE_PER_FINDING:
            continue
        evidence_by_finding[link.finding_id].append((link, evidence, source))
    # Agrupa las entidades (empresas) mencionadas en cada hallazgo.
    entities_by_finding: dict = defaultdict(list)
    for link, entity in await finding_repository.entities_for(finding_ids):
        entities_by_finding[link.finding_id].append(entity)

    references: dict[str, ChatFindingReference] = {}
    finding_context: list[dict] = []
    for finding in findings:
        # Cada evidencia con su fuente, recortada para no ocupar demasiado.
        evidence_refs = [
            ChatEvidenceReference(
                stance=link.stance.value,
                content=_short(evidence.content, 350) or "",
                source_url=_safe_source_url(source.url),
                source_title=_short(source.title, 160),
                source_domain=_short(source.domain, 160) or "",
            )
            for link, evidence, source in evidence_by_finding[finding.id]
        ]
        # La referencia que el frontend puede mostrar junto a la respuesta.
        reference = ChatFindingReference(
            id=finding.id,
            finding_type=finding.finding_type,
            statement=_short(finding.statement, 500) or "",
            confidence_level=finding.confidence_level,
            origin=finding.origin,
            review_status=finding.review_status,
            evidence=evidence_refs,
        )
        references[str(finding.id)] = reference
        # La versión resumida que se manda a la IA.
        finding_context.append(
            {
                "id": str(finding.id),
                "type": finding.finding_type.value,
                "statement": reference.statement,
                "confidence": finding.confidence_level.value,
                "confidence_rationale": _short(finding.confidence_rationale, 250),
                "origin": finding.origin.value,
                "review_status": finding.review_status.value,
                # Hasta 5 nombres de empresas por hallazgo.
                "entities": [entity.name for entity in entities_by_finding[finding.id][:5]],
                "evidence": [
                    {
                        "stance": item.stance,
                        "content": item.content,
                        "source": {
                            "title": item.source_title,
                            "domain": item.source_domain,
                            "url": item.source_url,
                        },
                    }
                    for item in evidence_refs
                ],
            }
        )

    # Competidores no rechazados, con su tipo y su nivel de amenaza. Los más recientes primero.
    competitor_rows = await session.execute(
        select(Competitor, Entity)
        .join(Entity, Entity.id == Competitor.entity_id)
        .where(
            Competitor.project_id == project.id,
            Competitor.review_status != ReviewStatus.REJECTED,
        )
        .order_by(Competitor.created_at.desc(), Competitor.id)
        .limit(MAX_COMPETITORS)
    )
    competitors = [
        {
            "name": entity.name,
            "entity_type": entity.entity_type.value,
            "competitor_type": competitor.competitor_type.value,
            "threat_level": competitor.threat_level.value,
            "rationale": _short(competitor.rationale, 350),
            "origin": competitor.origin.value,
            "review_status": competitor.review_status.value,
        }
        for competitor, entity in competitor_rows.tuples()
    ]

    opportunities = await _analysis_items(session, Opportunity, project)
    risks = await _analysis_items(session, Risk, project)
    hypotheses = await _analysis_items(session, ValidationHypothesis, project)
    missing = await _analysis_items(session, MissingInformation, project)
    # Solo se enlazan hallazgos que están en el contexto visible.
    visible_findings = set(references)
    await _add_linked_findings(
        session, opportunities, OpportunityFinding, "opportunity_id", visible_findings
    )
    await _add_linked_findings(session, risks, RiskFinding, "risk_id", visible_findings)
    await _add_linked_findings(
        session, hypotheses, HypothesisFinding, "hypothesis_id", visible_findings
    )

    # El último informe completado del proyecto, con sus secciones.
    report = await session.scalar(
        select(Report)
        .where(Report.project_id == project.id, Report.status == ReportStatus.COMPLETED)
        .order_by(Report.version.desc())
        .limit(1)
    )
    reports: list[dict] = []
    if report is not None:
        sections = await session.scalars(
            select(ReportSection)
            .where(ReportSection.report_id == report.id)
            .order_by(ReportSection.position)
            .limit(MAX_REPORT_SECTIONS)
        )
        reports.append(
            {
                "title": _short(report.title, 200),
                "version": report.version,
                "sections": [
                    {
                        "title": _short(section.title, 160),
                        "content": _short(section.content, 500),
                    }
                    for section in sections
                ],
            }
        )

    # El contexto completo, con todas sus partes. Después se recorta si es necesario.
    context = {
        "project": {
            "title": project.title,
            "idea": _short(project.raw_idea, 1800),
            "status": project.status.value,
        },
        "attributes": [
            {
                "type": attribute.attribute_type.value,
                "value": _short(attribute.value, 220),
                "confirmed": attribute.is_confirmed,
                "origin": attribute.origin.value,
            }
            for attribute in attributes
        ],
        "findings": finding_context,
        "competitors": competitors,
        "analysis": {
            "opportunities": opportunities,
            "risks": risks,
            "hypotheses": hypotheses,
            "missing_information": missing,
        },
        "completed_reports": reports,
        "geography_note": (
            "Solo se dispone del alcance geográfico declarado en idea/atributos/hallazgos; "
            "no hay lugares ni resultados de geocodificación en el contexto."
        ),
    }
    _fit_context(context)
    # Después de recortar, se quitan de cada elemento del análisis los hallazgos que ya no están.
    visible_ids = {item["id"] for item in context["findings"]}
    for items in context["analysis"].values():
        for item in items:
            item["finding_ids"] = [
                finding_id
                for finding_id in item.get("finding_ids", [])
                if finding_id in visible_ids
            ]
    return context, {
        finding_id: reference
        for finding_id, reference in references.items()
        if finding_id in visible_ids
    }


async def _analysis_items(session: AsyncSession, model, project: Project) -> list[dict]:
    """Trae los elementos de un tipo de análisis (no rechazados) en su versión resumida.

    Cada tipo de elemento tiene sus propios campos, por eso hay una rama para cada uno.
    """
    items = await session.scalars(
        select(model)
        .where(
            model.project_id == project.id,
            model.review_status != ReviewStatus.REJECTED,
        )
        .order_by(model.created_at.desc(), model.id)
        .limit(MAX_ANALYSIS_ITEMS)
    )
    result = []
    for item in items:
        if isinstance(item, Opportunity):
            value = {
                "title": _short(item.title, 200),
                "description": _short(item.description, 350),
                "potential": item.potential.value,
            }
        elif isinstance(item, Risk):
            value = {
                "title": _short(item.title, 200),
                "description": _short(item.description, 350),
                "category": item.category.value,
                "likelihood": item.likelihood.value,
                "impact": item.impact.value,
                "mitigation": _short(item.mitigation, 250),
            }
        elif isinstance(item, ValidationHypothesis):
            value = {
                "statement": _short(item.statement, 350),
                "validation_method": _short(item.validation_method, 250),
                "success_criteria": _short(item.success_criteria, 250),
                "priority": item.priority.value,
                "validation_status": item.validation_status.value,
                "result_notes": _short(item.result_notes, 250),
            }
        elif isinstance(item, MissingInformation):
            value = {
                "question": _short(item.question, 350),
                "reason": _short(item.reason, 250),
                "priority": item.priority.value,
                "resolution_status": item.resolution_status.value,
                "resolution_notes": _short(item.resolution_notes, 250),
            }
        else:
            continue
        result.append(
            {
                "id": str(item.id),
                **value,
                "origin": item.origin.value,
                "review_status": item.review_status.value,
            }
        )
    return result


async def _add_linked_findings(
    session: AsyncSession,
    items: list[dict],
    link_model,
    item_field: str,
    visible_finding_ids: set[str],
) -> None:
    """Agrega a cada elemento del análisis la lista de hallazgos que lo respaldan.

    Solo incluye hallazgos que estén en el contexto visible.
    """
    if not items:
        return
    item_ids = [uuid.UUID(item["id"]) for item in items]
    item_fk = getattr(link_model, item_field)
    rows = await session.execute(
        select(item_fk, link_model.finding_id).where(item_fk.in_(item_ids))
    )
    by_item: dict[uuid.UUID, list[str]] = defaultdict(list)
    for item_id, finding_id in rows.tuples():
        if str(finding_id) in visible_finding_ids:
            by_item[item_id].append(str(finding_id))
    for item in items:
        item["finding_ids"] = by_item[uuid.UUID(item["id"])]


def _fit_context(context: dict) -> None:
    """Recorta el contexto hasta que quepa en MAX_CONTEXT_CHARS.

    Quita primero lo menos importante.

    Orden de recorte: primero el informe, después los competidores y el análisis, luego los
    hallazgos y, por último, los atributos y la idea. Marca context_truncated si hubo recorte.
    """
    context["context_truncated"] = False

    def serialize() -> str:
        """Convierte el contexto en texto JSON compacto, para medir su tamaño."""
        return json.dumps(context, ensure_ascii=False, separators=(",", ":"))

    # Mientras el texto siga siendo demasiado grande, quitamos un elemento de la lista menos
    # importante.
    while len(serialize()) > MAX_CONTEXT_CHARS:
        context["context_truncated"] = True
        lists = [
            context["completed_reports"][0]["sections"] if context["completed_reports"] else [],
            context["completed_reports"],
            context["competitors"],
            context["analysis"]["missing_information"],
            context["analysis"]["hypotheses"],
            context["analysis"]["risks"],
            context["analysis"]["opportunities"],
            context["findings"],
            context["attributes"],
        ]
        candidates = [items for items in lists if items]
        if candidates:
            # pop() quita el último elemento de la primera lista que todavía tenga datos.
            candidates[0].pop()
            continue
        # Si ya no quedan listas, se recorta la idea a la mitad, hasta 500 caracteres.
        idea = context["project"]["idea"] or ""
        if len(idea) > 500:
            context["project"]["idea"] = idea[: len(idea) // 2]
            continue
        break
    context["context_truncated"] = len(serialize()) > MAX_CONTEXT_CHARS
