import uuid
from collections import defaultdict
from typing import Any

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Origin, ReviewStatus
from app.core.errors import AppError, ConflictError, NotFoundError
from app.modules.analysis.kinds import (
    HYPOTHESES,
    MISSING_INFORMATION,
    NULLABLE_TEXT,
    OPPORTUNITIES,
    RISKS,
    AnalysisKind,
)
from app.modules.analysis.schemas import AnalysisItemRead, AnalysisRead, FindingBrief
from app.modules.findings.models import Finding
from app.modules.projects.models import ProjectStatus
from app.modules.projects.service import get_owned_project
from app.modules.research.models import RunStatus, RunStep
from app.modules.research.repository import ResearchRunRepository
from app.modules.research.schemas import ResearchRunRead
from app.modules.research.service import ResearchInProgressError, ResearchRunNotFoundError
from app.modules.users.models import User

ANALYSIS_PROGRESS = 50


class AnalysisItemNotFoundError(NotFoundError):
    code = "analysis_item_not_found"


def _clean(field: str, value: Any) -> Any:
    return (value or None) if field in NULLABLE_TEXT else value


class AnalysisService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.runs = ResearchRunRepository(session)

    # ─────────────── Lanzar el análisis ───────────────

    async def start(self, user: User, project_id: uuid.UUID, run_id: uuid.UUID) -> ResearchRunRead:
        """Deja la ejecución en `running/analyzing`; el router lanza el análisis
        en segundo plano.
        """
        project = await get_owned_project(self.session, user, project_id)
        run = await self.runs.get(project.id, run_id)
        if run is None:
            raise ResearchRunNotFoundError()
        if project.status not in (ProjectStatus.RESEARCHING, ProjectStatus.ANALYZED):
            raise ConflictError(
                "La idea cambió desde la investigación: confirma la estructura "
                "e investiga de nuevo.",
                code="project_not_researched",
            )
        if run.status != RunStatus.COMPLETED:
            if run.status in (RunStatus.PENDING, RunStatus.RUNNING):
                raise ResearchInProgressError()
            raise ConflictError(
                "Solo se puede analizar una investigación completada.", code="run_not_completed"
            )
        latest = (await self.runs.list_for_project(project.id))[0]
        if latest.id != run.id:
            raise ConflictError(
                "Solo se puede analizar la investigación más reciente.", code="run_not_latest"
            )
        if not await self._count_usable_findings(project.id, run.id):
            raise ConflictError(
                "No hay hallazgos sin rechazar que analizar. Revisa los hallazgos "
                "o añade los tuyos.",
                code="no_findings",
            )
        run.status = RunStatus.RUNNING
        run.current_step = RunStep.ANALYZING
        run.progress_pct = ANALYSIS_PROGRESS
        run.error_code = None
        run.error_message = None
        try:
            await self.session.commit()
        except IntegrityError as exc:  # otra ejecución se activó a la vez
            await self.session.rollback()
            raise ResearchInProgressError() from exc
        return ResearchRunRead.model_validate(run)

    async def _count_usable_findings(self, project_id: uuid.UUID, run_id: uuid.UUID) -> int:
        count = await self.session.scalar(
            select(func.count()).where(
                Finding.project_id == project_id,
                or_(Finding.run_id == run_id, Finding.origin == Origin.USER),
                Finding.review_status != ReviewStatus.REJECTED,
            )
        )
        return count or 0

    # ─────────────── Lectura ───────────────

    async def _to_read(self, kind: AnalysisKind, items: list[Any]) -> list[AnalysisItemRead]:
        findings: dict[uuid.UUID, list[FindingBrief]] = defaultdict(list)
        if kind.link_model is not None and items:
            fk = getattr(kind.link_model, kind.link_fk)
            rows = await self.session.execute(
                select(fk, Finding)
                .join(Finding, Finding.id == kind.link_model.finding_id)
                .where(fk.in_([i.id for i in items]))
                .order_by(Finding.created_at)
            )
            for item_id, finding in rows.tuples():
                findings[item_id].append(
                    FindingBrief(
                        id=finding.id,
                        finding_type=finding.finding_type,
                        statement=finding.statement,
                        confidence_level=finding.confidence_level,
                        review_status=finding.review_status,
                    )
                )
        return [
            kind.read.model_validate(i).model_copy(update={"findings": findings[i.id]})
            for i in items
        ]

    async def _list(
        self, kind: AnalysisKind, project_id: uuid.UUID, run_id: uuid.UUID | None
    ) -> list[AnalysisItemRead]:
        model = kind.model
        conditions = [model.project_id == project_id]
        if run_id is not None:
            # Lo aportado por el usuario no pertenece a ninguna ejecución: siempre se incluye.
            conditions.append(or_(model.run_id == run_id, model.origin == Origin.USER))
        items = await self.session.scalars(
            select(model).where(*conditions).order_by(model.created_at, model.id)
        )
        return await self._to_read(kind, list(items))

    async def overview(
        self, user: User, project_id: uuid.UUID, run_id: uuid.UUID | None
    ) -> AnalysisRead:
        project = await get_owned_project(self.session, user, project_id)
        return AnalysisRead(
            opportunities=await self._list(OPPORTUNITIES, project.id, run_id),
            risks=await self._list(RISKS, project.id, run_id),
            hypotheses=await self._list(HYPOTHESES, project.id, run_id),
            missing_information=await self._list(MISSING_INFORMATION, project.id, run_id),
        )

    # ─────────────── Alta, edición y borrado ───────────────

    async def _get(
        self, kind: AnalysisKind, user: User, project_id: uuid.UUID, item_id: uuid.UUID
    ) -> Any:
        project = await get_owned_project(self.session, user, project_id)
        item = await self.session.scalar(
            select(kind.model).where(kind.model.id == item_id, kind.model.project_id == project.id)
        )
        if item is None:
            raise AnalysisItemNotFoundError(f"{kind.label} no existe.")
        return item

    async def create(
        self, kind: AnalysisKind, user: User, project_id: uuid.UUID, data: BaseModel
    ) -> AnalysisItemRead:
        project = await get_owned_project(self.session, user, project_id)
        values = data.model_dump()
        finding_ids = set(values.pop("finding_ids", []))
        if finding_ids:
            # Las tablas intermedias no llevan project_id: la pertenencia se comprueba aquí.
            found = await self.session.scalars(
                select(Finding.id).where(
                    Finding.project_id == project.id, Finding.id.in_(finding_ids)
                )
            )
            if set(found) != finding_ids:
                raise AppError("Algún hallazgo no existe en este proyecto.", code="invalid_finding")
        item = kind.model(
            project_id=project.id,
            origin=Origin.USER,
            review_status=ReviewStatus.ACCEPTED,
            **{k: _clean(k, v) for k, v in values.items()},
        )
        self.session.add(item)
        await self.session.flush()
        if kind.link_model is not None:
            self.session.add_all(
                kind.link_model(**{kind.link_fk: item.id, "finding_id": f}) for f in finding_ids
            )
        await self.session.commit()
        return (await self._to_read(kind, [item]))[0]

    async def update(
        self,
        kind: AnalysisKind,
        user: User,
        project_id: uuid.UUID,
        item_id: uuid.UUID,
        data: BaseModel,
    ) -> AnalysisItemRead:
        item = await self._get(kind, user, project_id, item_id)
        changes = {k: _clean(k, v) for k, v in data.model_dump(exclude_unset=True).items()}
        content = {k: v for k, v in changes.items() if k in kind.content_fields}
        if any(getattr(item, k) != v for k, v in content.items()):
            for field, value in content.items():
                setattr(item, field, value)
            # El usuario asume el contenido: deja de ser una propuesta de la IA.
            item.origin = Origin.USER
            item.review_status = ReviewStatus.ACCEPTED
        for field in kind.tracking_fields:
            if field in changes:
                setattr(item, field, changes[field])
        if "review_status" in changes:
            item.review_status = changes["review_status"]
        await self.session.commit()
        return (await self._to_read(kind, [item]))[0]

    async def delete(
        self, kind: AnalysisKind, user: User, project_id: uuid.UUID, item_id: uuid.UUID
    ) -> None:
        item = await self._get(kind, user, project_id, item_id)
        if item.origin != Origin.USER:
            raise ConflictError(
                "Lo propuesto por la IA no se borra para conservar la trazabilidad; recházalo.",
                code="ai_item_not_deletable",
            )
        await self.session.delete(item)
        await self.session.commit()
