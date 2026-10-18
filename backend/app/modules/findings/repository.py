import uuid

from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Level, Origin, ResearchCategory, ReviewStatus
from app.modules.entities.models import Entity
from app.modules.findings.models import Evidence, Finding, FindingEntity, FindingEvidence
from app.modules.research.models import Source

_CONFIDENCE_ORDER = case(
    {Level.HIGH: 0, Level.MEDIUM: 1, Level.LOW: 2, Level.UNDETERMINED: 3},
    value=Finding.confidence_level,
)


class FindingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_project(
        self,
        project_id: uuid.UUID,
        run_id: uuid.UUID | None,
        finding_type: ResearchCategory | None,
        review_status: ReviewStatus | None,
    ) -> list[Finding]:
        conditions = [Finding.project_id == project_id]
        if run_id is not None:
            # Los hallazgos del usuario no pertenecen a ninguna ejecución: siempre se incluyen.
            conditions.append(or_(Finding.run_id == run_id, Finding.origin == Origin.USER))
        if finding_type is not None:
            conditions.append(Finding.finding_type == finding_type)
        if review_status is not None:
            conditions.append(Finding.review_status == review_status)
        findings = await self.session.scalars(
            select(Finding)
            .where(*conditions)
            .order_by(_CONFIDENCE_ORDER, Finding.created_at.desc(), Finding.id)
        )
        return list(findings)

    async def get(self, project_id: uuid.UUID, finding_id: uuid.UUID) -> Finding | None:
        return await self.session.scalar(
            select(Finding).where(Finding.id == finding_id, Finding.project_id == project_id)
        )

    async def evidence_for(
        self, finding_ids: list[uuid.UUID]
    ) -> list[tuple[FindingEvidence, Evidence, Source]]:
        if not finding_ids:
            return []
        rows = await self.session.execute(
            select(FindingEvidence, Evidence, Source)
            .join(Evidence, Evidence.id == FindingEvidence.evidence_id)
            .join(Source, Source.id == Evidence.source_id)
            .where(FindingEvidence.finding_id.in_(finding_ids))
            .order_by(Evidence.created_at, Evidence.id)
        )
        return list(rows.tuples())

    async def entities_for(
        self, finding_ids: list[uuid.UUID]
    ) -> list[tuple[FindingEntity, Entity]]:
        if not finding_ids:
            return []
        rows = await self.session.execute(
            select(FindingEntity, Entity)
            .join(Entity, Entity.id == FindingEntity.entity_id)
            .where(FindingEntity.finding_id.in_(finding_ids))
            .order_by(Entity.name)
        )
        return list(rows.tuples())

    async def evidence_ids_in_project(
        self, project_id: uuid.UUID, ids: set[uuid.UUID]
    ) -> set[uuid.UUID]:
        if not ids:
            return set()
        found = await self.session.scalars(
            select(Evidence.id).where(Evidence.project_id == project_id, Evidence.id.in_(ids))
        )
        return set(found)

    def add(self, finding: Finding) -> None:
        self.session.add(finding)

    async def delete(self, finding: Finding) -> None:
        await self.session.delete(finding)
