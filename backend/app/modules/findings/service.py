import uuid
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Origin, ResearchCategory, ReviewStatus
from app.core.errors import AppError, ConflictError, NotFoundError
from app.modules.entities.repository import EntityRepository
from app.modules.findings.models import Finding, FindingEntity, FindingEvidence
from app.modules.findings.repository import FindingRepository
from app.modules.findings.schemas import (
    EvidenceSourceRead,
    FindingCreate,
    FindingEntityRead,
    FindingEvidenceRead,
    FindingRead,
    FindingUpdate,
)
from app.modules.projects.service import get_owned_project
from app.modules.users.models import User

# Cambiar estos campos de un hallazgo de la IA lo convierte en un dato del usuario.
_CONTENT_FIELDS = ("finding_type", "statement", "confidence_level", "confidence_rationale")


class FindingNotFoundError(NotFoundError):
    code = "finding_not_found"
    message = "El hallazgo no existe."


class FindingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.findings = FindingRepository(session)
        self.entities = EntityRepository(session)

    async def _to_read(self, findings: list[Finding]) -> list[FindingRead]:
        ids = [f.id for f in findings]
        evidence: dict[uuid.UUID, list[FindingEvidenceRead]] = defaultdict(list)
        for link, item, source in await self.findings.evidence_for(ids):
            evidence[link.finding_id].append(
                FindingEvidenceRead(
                    evidence_id=item.id,
                    stance=link.stance,
                    content=item.content,
                    source=EvidenceSourceRead(
                        id=source.id,
                        url=source.url,
                        domain=source.domain,
                        title=source.title,
                        source_type=source.source_type,
                    ),
                )
            )
        entities: dict[uuid.UUID, list[FindingEntityRead]] = defaultdict(list)
        for link, entity in await self.findings.entities_for(ids):
            entities[link.finding_id].append(
                FindingEntityRead(id=entity.id, name=entity.name, entity_type=entity.entity_type)
            )
        return [
            FindingRead.model_validate(f).model_copy(
                update={"evidence": evidence[f.id], "entities": entities[f.id]}
            )
            for f in findings
        ]

    async def _get(self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID) -> Finding:
        project = await get_owned_project(self.session, user, project_id)
        finding = await self.findings.get(project.id, finding_id)
        if finding is None:
            raise FindingNotFoundError()
        return finding

    async def list_findings(
        self,
        user: User,
        project_id: uuid.UUID,
        run_id: uuid.UUID | None,
        finding_type: ResearchCategory | None,
        review_status: ReviewStatus | None,
    ) -> list[FindingRead]:
        project = await get_owned_project(self.session, user, project_id)
        findings = await self.findings.list_for_project(
            project.id, run_id, finding_type, review_status
        )
        return await self._to_read(findings)

    async def create_finding(
        self, user: User, project_id: uuid.UUID, data: FindingCreate
    ) -> FindingRead:
        project = await get_owned_project(self.session, user, project_id)
        # Las tablas intermedias no llevan project_id: la pertenencia se comprueba aquí.
        links = {link.evidence_id: link.stance for link in data.evidence}
        if await self.findings.evidence_ids_in_project(project.id, set(links)) != set(links):
            raise AppError("Alguna evidencia no existe en este proyecto.", code="invalid_evidence")
        entity_ids = set(data.entity_ids)
        if await self.entities.ids_in_project(project.id, entity_ids) != entity_ids:
            raise AppError("Alguna entidad no existe en este proyecto.", code="invalid_entity")

        finding = Finding(
            project_id=project.id,
            origin=Origin.USER,
            review_status=ReviewStatus.ACCEPTED,
            finding_type=data.finding_type,
            statement=data.statement,
            confidence_level=data.confidence_level,
            confidence_rationale=data.confidence_rationale or None,
        )
        self.findings.add(finding)
        await self.session.flush()
        self.session.add_all(
            FindingEvidence(finding_id=finding.id, evidence_id=evidence_id, stance=stance)
            for evidence_id, stance in links.items()
        )
        self.session.add_all(FindingEntity(finding_id=finding.id, entity_id=e) for e in entity_ids)
        await self.session.commit()
        return (await self._to_read([finding]))[0]

    async def update_finding(
        self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID, data: FindingUpdate
    ) -> FindingRead:
        finding = await self._get(user, project_id, finding_id)
        changes = data.model_dump(exclude_unset=True)
        content = {k: v for k, v in changes.items() if k in _CONTENT_FIELDS}
        if any(getattr(finding, k) != v for k, v in content.items()):
            for field, value in content.items():
                if field == "confidence_rationale":
                    value = value or None
                setattr(finding, field, value)
            # El usuario asume el contenido: deja de ser una propuesta de la IA.
            finding.origin = Origin.USER
            finding.review_status = ReviewStatus.ACCEPTED
        if "review_status" in changes:
            finding.review_status = changes["review_status"]
        await self.session.commit()
        return (await self._to_read([finding]))[0]

    async def delete_finding(
        self, user: User, project_id: uuid.UUID, finding_id: uuid.UUID
    ) -> None:
        finding = await self._get(user, project_id, finding_id)
        if finding.origin != Origin.USER:
            raise ConflictError(
                "Los hallazgos de la IA no se borran para conservar la trazabilidad; recházalo.",
                code="ai_item_not_deletable",
            )
        await self.findings.delete(finding)
        await self.session.commit()
