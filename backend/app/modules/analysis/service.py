"""Aplica reglas de negocio y permisos. Area: analisis.

ARCHIVO: backend/app/modules/analysis/service.py

¿Qué es?
Las reglas del análisis cuando la persona interactúa con él: cuándo se puede iniciar, qué se
muestra, y cómo se crean, cambian o borran oportunidades, riesgos, hipótesis e información faltante.

¿Para qué sirve?
Para que nadie analice una investigación que no está terminada, y para que lo que la IA propuso
no se borre sin dejar rastro.

¿Quién lo usa?
router.py (cada endpoint del análisis llama a un método de AnalysisService).

Reglas principales:
- Solo se analiza la investigación más reciente, y solo cuando terminó.
- El proyecto debe estar en investigación o ya analizado.
  Si la idea cambió, hay que investigar otra vez.
- Tiene que haber al menos un hallazgo sin rechazar para analizar.
- Lo que propuso la IA no se borra: solo se puede rechazar.
- Si la persona cambia el contenido de algo que propuso la IA, pasa a ser suyo.
"""

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

# Porcentaje de la barra de progreso cuando empieza el análisis.
ANALYSIS_PROGRESS = 50


class AnalysisItemNotFoundError(NotFoundError):
    """El elemento del análisis no existe en ese proyecto. Responde 404."""

    code = "analysis_item_not_found"


def _clean(field: str, value: Any) -> Any:
    """Convierte un texto vacío en nulo, solo en los campos que pueden quedar vacíos."""
    return (value or None) if field in NULLABLE_TEXT else value


class AnalysisService:
    """Reglas de negocio del análisis para cada petición de la API."""

    def __init__(self, session: AsyncSession) -> None:
        """Crea el repositorio de investigaciones con la sesión de esta petición."""
        self.session = session
        self.runs = ResearchRunRepository(session)

    # ─────────────── Lanzar el análisis ───────────────

    async def start(self, user: User, project_id: uuid.UUID, run_id: uuid.UUID) -> ResearchRunRead:
        """Pone la investigación en estado "corriendo, analizando".

        El router lanza el análisis en segundo plano.

        Revisa, en orden: que la investigación exista, que el proyecto esté listo, que la
        investigación esté completa, que sea la más reciente y que haya hallazgos utilizables.
        """
        project = await get_owned_project(self.session, user, project_id)
        run = await self.runs.get(project.id, run_id)
        if run is None:
            raise ResearchRunNotFoundError()
        # Si la idea cambió después de investigar, el análisis ya no corresponde.
        if project.status not in (ProjectStatus.RESEARCHING, ProjectStatus.ANALYZED):
            raise ConflictError(
                "La idea cambió desde la investigación: confirma la estructura "
                "e investiga de nuevo.",
                code="project_not_researched",
            )
        if run.status != RunStatus.COMPLETED:
            # Si todavía corre, se avisa que hay una investigación en curso.
            if run.status in (RunStatus.PENDING, RunStatus.RUNNING):
                raise ResearchInProgressError()
            raise ConflictError(
                "Solo se puede analizar una investigación completada.", code="run_not_completed"
            )
        # Solo se analiza la investigación más reciente del proyecto.
        latest = (await self.runs.list_for_project(project.id))[0]
        if latest.id != run.id:
            raise ConflictError(
                "Solo se puede analizar la investigación más reciente.", code="run_not_latest"
            )
        # Sin hallazgos que no estén rechazados, no hay nada que analizar.
        if not await self._count_usable_findings(project.id, run.id):
            raise ConflictError(
                "No hay hallazgos sin rechazar que analizar. Revisa los hallazgos "
                "o añade los tuyos.",
                code="no_findings",
            )
        # Marca la investigación como "analizando". Se borran los errores anteriores.
        run.status = RunStatus.RUNNING
        run.current_step = RunStep.ANALYZING
        run.progress_pct = ANALYSIS_PROGRESS
        run.error_code = None
        run.error_message = None
        try:
            await self.session.commit()
        except IntegrityError as exc:  # otra ejecución se activó a la vez
            # Si otra petición activó una investigación al mismo tiempo, se rechaza esta.
            await self.session.rollback()
            raise ResearchInProgressError() from exc
        return ResearchRunRead.model_validate(run)

    async def _count_usable_findings(self, project_id: uuid.UUID, run_id: uuid.UUID) -> int:
        """Cuenta los hallazgos de la investigación, o del usuario, que no estén rechazados."""
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
        """Convierte los elementos en datos para el frontend, con sus hallazgos de apoyo.

        Trae los hallazgos de todos los elementos con una sola consulta.
        """
        findings: dict[uuid.UUID, list[FindingBrief]] = defaultdict(list)
        if kind.link_model is not None and items:
            # La columna de la tabla intermedia que apunta al elemento, por ejemplo opportunity_id.
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
        # "model_copy" agrega la lista de hallazgos a cada elemento ya convertido.
        return [
            kind.read.model_validate(i).model_copy(update={"findings": findings[i.id]})
            for i in items
        ]

    async def _list(
        self, kind: AnalysisKind, project_id: uuid.UUID, run_id: uuid.UUID | None
    ) -> list[AnalysisItemRead]:
        """Lista los elementos de un tipo.

        Incluye los de la investigación indicada y los que aportó el usuario.
        """
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
        """Devuelve las cuatro listas del análisis del proyecto."""
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
        """Busca un elemento del tipo indicado, solo si es del proyecto del usuario."""
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
        """Crea un elemento escrito por la persona. Queda aceptado y es suyo desde el inicio."""
        project = await get_owned_project(self.session, user, project_id)
        values = data.model_dump()
        # Los ids de hallazgos se separan de los campos normales: van en la tabla intermedia.
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
        # flush obtiene el id del elemento para poder vincular los hallazgos.
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
        """Cambia los campos que se mandan de un elemento.

        Si se cambia su contenido, pasa a ser de la persona. Los campos de seguimiento (por ejemplo,
        el estado de una hipótesis) se cambian sin cambiar quién lo creó.
        """
        item = await self._get(kind, user, project_id, item_id)
        changes = {k: _clean(k, v) for k, v in data.model_dump(exclude_unset=True).items()}
        content = {k: v for k, v in changes.items() if k in kind.content_fields}
        if any(getattr(item, k) != v for k, v in content.items()):
            for field, value in content.items():
                setattr(item, field, value)
            # El usuario asume el contenido: deja de ser una propuesta de la IA.
            item.origin = Origin.USER
            item.review_status = ReviewStatus.ACCEPTED
        # Campos de seguimiento: se aplican sin cambiar la procedencia.
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
        """Borra un elemento propio. Lo que propuso la IA no se borra: solo se puede rechazar."""
        item = await self._get(kind, user, project_id, item_id)
        if item.origin != Origin.USER:
            raise ConflictError(
                "Lo propuesto por la IA no se borra para conservar la trazabilidad; recházalo.",
                code="ai_item_not_deletable",
            )
        await self.session.delete(item)
        await self.session.commit()
