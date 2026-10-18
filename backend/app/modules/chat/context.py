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

MAX_CONTEXT_CHARS = 3500
MAX_FINDINGS = 12
MAX_EVIDENCE_PER_FINDING = 2
MAX_COMPETITORS = 8
MAX_ANALYSIS_ITEMS = 6
MAX_REPORT_SECTIONS = 6


def _short(value: str | None, limit: int) -> str | None:
    return value[:limit] if value else None


def _safe_source_url(value: str) -> str | None:
    try:
        parts = urlsplit(value)
    except ValueError:
        return None
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
    attributes = await session.scalars(
        select(IdeaAttribute)
        .where(IdeaAttribute.project_id == project.id)
        .order_by(IdeaAttribute.attribute_type, IdeaAttribute.position)
        .limit(20)
    )
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
    evidence_by_finding: dict = defaultdict(list)
    for link, evidence, source in await finding_repository.evidence_for(finding_ids):
        if len(evidence_by_finding[link.finding_id]) >= MAX_EVIDENCE_PER_FINDING:
            continue
        evidence_by_finding[link.finding_id].append((link, evidence, source))
    entities_by_finding: dict = defaultdict(list)
    for link, entity in await finding_repository.entities_for(finding_ids):
        entities_by_finding[link.finding_id].append(entity)

    references: dict[str, ChatFindingReference] = {}
    finding_context: list[dict] = []
    for finding in findings:
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
        finding_context.append(
            {
                "id": str(finding.id),
                "type": finding.finding_type.value,
                "statement": reference.statement,
                "confidence": finding.confidence_level.value,
                "confidence_rationale": _short(finding.confidence_rationale, 250),
                "origin": finding.origin.value,
                "review_status": finding.review_status.value,
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
    visible_findings = set(references)
    await _add_linked_findings(
        session, opportunities, OpportunityFinding, "opportunity_id", visible_findings
    )
    await _add_linked_findings(session, risks, RiskFinding, "risk_id", visible_findings)
    await _add_linked_findings(
        session, hypotheses, HypothesisFinding, "hypothesis_id", visible_findings
    )

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
    context["context_truncated"] = False

    def serialize() -> str:
        return json.dumps(context, ensure_ascii=False, separators=(",", ":"))

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
            candidates[0].pop()
            continue
        idea = context["project"]["idea"] or ""
        if len(idea) > 500:
            context["project"]["idea"] = idea[: len(idea) // 2]
            continue
        break
    context["context_truncated"] = len(serialize()) > MAX_CONTEXT_CHARS
