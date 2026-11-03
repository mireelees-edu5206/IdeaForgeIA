"""Aplica reglas de negocio y permisos. Area: administracion.

ARCHIVO: backend/app/modules/admin/service.py

¿Qué es?
La lógica del panel de administración: calcular las métricas, listar cuentas, cambiar roles y
eliminar cuentas.

¿Para qué sirve?
Para que la administradora vea el estado de la aplicación y pueda administrar cuentas con las
protecciones necesarias.

¿Quién lo usa?
router.py de este módulo.

Protecciones principales:
- Nadie puede desactivarse, quitarse el rol de admin ni eliminarse a sí mismo.
- La última cuenta de administración activa no se puede eliminar ni desactivar.
- No se elimina una cuenta mientras tenga investigaciones activas o informes generándose.
- Al desactivar una cuenta, sus sesiones abiertas se cierran.
- Al eliminar una cuenta con id de Supabase, también se borra en Supabase.

Para evitar carreras (dos administradoras haciendo cambios a la vez), las consultas de borrado
usan bloqueos de fila (with_for_update).
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings
from app.core.errors import ConflictError, NotFoundError, ServiceUnavailableError
from app.core.supabase_admin import SupabaseAdminClient
from app.core.supabase_auth import SupabaseAuthUnavailableError
from app.modules.admin.schemas import (
    AdminAILogRead,
    AdminOverview,
    AdminUserRead,
    AdminUserUpdate,
    ProviderMetrics,
)
from app.modules.ai.models import AIApiLog, AICallStatus
from app.modules.auth.repository import RefreshTokenRepository
from app.modules.findings.models import Finding
from app.modules.projects.models import Project, ProjectStatus
from app.modules.reports.models import Report, ReportStatus
from app.modules.research.models import ACTIVE_RUN_STATUSES, ResearchRun, RunStatus
from app.modules.users.models import User, UserRole


class UserNotFoundError(NotFoundError):
    """La cuenta solicitada no existe. Responde 404."""

    code = "user_not_found"
    message = "El usuario solicitado no existe."


class AdminService:
    """Reglas del panel de administración para cada petición."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        """Guarda la sesión de base de datos y la configuración de la aplicación."""
        self.session = session
        self.settings = settings

    async def overview(self) -> AdminOverview:
        """Calcula todas las métricas del resumen general, con varias consultas agrupadas."""
        # Cuenta usuarios en total, activos y administradores en una sola consulta.
        user_row = (
            await self.session.execute(
                select(
                    func.count(User.id),
                    func.count(case((User.is_active.is_(True), 1))),
                    func.count(case((User.role == UserRole.ADMIN, 1))),
                )
            )
        ).one()

        # Cuenta proyectos por etapa. Las etapas vacías quedan en 0.
        status_rows = await self.session.execute(
            select(Project.status, func.count(Project.id)).group_by(Project.status)
        )
        projects_by_status = {status: 0 for status in ProjectStatus}
        projects_by_status.update({status: count for status, count in status_rows.tuples()})

        # Cuenta investigaciones en total, terminadas y fallidas.
        run_row = (
            await self.session.execute(
                select(
                    func.count(ResearchRun.id),
                    func.count(case((ResearchRun.status == RunStatus.COMPLETED, 1))),
                    func.count(case((ResearchRun.status == RunStatus.FAILED, 1))),
                )
            )
        ).one()

        total_findings = await self.session.scalar(select(func.count(Finding.id))) or 0
        total_reports = await self.session.scalar(select(func.count(Report.id))) or 0

        # Uso de IA agrupado por proveedor: llamadas, errores, tiempos, tokens y costo.
        # coalesce convierte los totales vacíos en 0 para que no fallen las sumas.
        provider_rows = await self.session.execute(
            select(
                AIApiLog.provider,
                func.count(AIApiLog.id),
                func.count(case((AIApiLog.status == AICallStatus.SUCCESS, 1))),
                func.count(case((AIApiLog.status == AICallStatus.ERROR, 1))),
                func.avg(AIApiLog.latency_ms),
                func.coalesce(func.sum(AIApiLog.input_tokens), 0),
                func.coalesce(func.sum(AIApiLog.output_tokens), 0),
                func.coalesce(func.sum(AIApiLog.search_queries_count), 0),
                func.coalesce(func.sum(AIApiLog.estimated_cost_usd), Decimal(0)),
            )
            .group_by(AIApiLog.provider)
            .order_by(func.count(AIApiLog.id).desc())
        )
        # Convierte cada fila en el resumen de un proveedor. El promedio se redondea a enteros.
        ai_by_provider = [
            ProviderMetrics(
                provider=provider,
                total_calls=total_calls,
                success_calls=success_calls,
                error_calls=error_calls,
                avg_latency_ms=round(float(avg_latency)) if avg_latency is not None else None,
                input_tokens=int(in_tok),
                output_tokens=int(out_tok),
                search_queries=int(searches),
                estimated_cost_usd=Decimal(cost),
            )
            for (
                provider,
                total_calls,
                success_calls,
                error_calls,
                avg_latency,
                in_tok,
                out_tok,
                searches,
                cost,
            ) in provider_rows.tuples()
        ]

        # Las 25 llamadas más recientes. "outerjoin" conserva la llamada aunque ya no exista el
        # usuario o el proyecto.
        log_rows = await self.session.execute(
            select(AIApiLog, User.email, Project.title)
            .outerjoin(User, User.id == AIApiLog.user_id)
            .outerjoin(Project, Project.id == AIApiLog.project_id)
            .order_by(AIApiLog.created_at.desc(), AIApiLog.id.desc())
            .limit(25)
        )
        recent_ai_logs = [
            AdminAILogRead.model_validate(log).model_copy(
                update={"user_email": user_email, "project_title": project_title}
            )
            for log, user_email, project_title in log_rows.tuples()
        ]

        return AdminOverview(
            total_users=user_row[0],
            active_users=user_row[1],
            admin_users=user_row[2],
            total_projects=sum(projects_by_status.values()),
            projects_by_status=projects_by_status,
            total_research_runs=run_row[0],
            completed_research_runs=run_row[1],
            failed_research_runs=run_row[2],
            total_findings=total_findings,
            total_reports=total_reports,
            # El total de llamadas es la suma de lo que reportó cada proveedor.
            total_ai_calls=sum(item.total_calls for item in ai_by_provider),
            ai_by_provider=ai_by_provider,
            recent_ai_logs=recent_ai_logs,
        )

    async def list_users(self) -> list[AdminUserRead]:
        """Lista todas las cuentas con cuántos proyectos e investigaciones tiene cada una."""
        # Subconsulta: cuántos proyectos tiene cada usuario.
        project_counts = (
            select(Project.user_id, func.count(Project.id).label("project_count"))
            .group_by(Project.user_id)
            .subquery()
        )
        # Subconsulta: cuántas investigaciones tiene cada usuario (a través de sus proyectos).
        run_counts = (
            select(Project.user_id, func.count(ResearchRun.id).label("run_count"))
            .join(ResearchRun, ResearchRun.project_id == Project.id)
            .group_by(Project.user_id)
            .subquery()
        )
        rows = await self.session.execute(
            select(
                User,
                # coalesce: si una cuenta no tiene proyectos, cuenta como 0 (no como vacío).
                func.coalesce(project_counts.c.project_count, 0),
                func.coalesce(run_counts.c.run_count, 0),
            )
            .outerjoin(project_counts, project_counts.c.user_id == User.id)
            .outerjoin(run_counts, run_counts.c.user_id == User.id)
            .order_by(User.created_at.desc())
        )
        return [
            AdminUserRead(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
                project_count=int(project_count),
                research_run_count=int(run_count),
                last_login_at=user.last_login_at,
                created_at=user.created_at,
            )
            for user, project_count, run_count in rows.tuples()
        ]

    async def update_user(
        self, actor: User, target_id: uuid.UUID, data: AdminUserUpdate
    ) -> AdminUserRead:
        """Cambia el rol o el estado activo de una cuenta, con sus protecciones."""
        target = await self.session.get(User, target_id)
        if target is None:
            raise UserNotFoundError()

        # Solo se revisan los campos que la administradora mandó.
        changes = data.model_dump(exclude_unset=True)
        # Protecciones para la propia cuenta de quien administra.
        if target.id == actor.id:
            if changes.get("is_active") is False:
                raise ConflictError(
                    "No puedes desactivar tu propia cuenta de administrador.",
                    code="cannot_deactivate_self",
                )
            if changes.get("role") == UserRole.USER:
                raise ConflictError(
                    "No puedes quitarte el rol de administrador a ti mismo.",
                    code="cannot_demote_self",
                )

        if "role" in changes and changes["role"] is not None:
            target.role = changes["role"]
        if "is_active" in changes and changes["is_active"] is not None:
            target.is_active = changes["is_active"]
            # Si se desactiva la cuenta, se cierran todas sus sesiones abiertas.
            if not target.is_active:
                await RefreshTokenRepository(self.session).revoke_all_active(
                    target.id, datetime.now(UTC)
                )

        await self.session.commit()
        # Vuelve a leer la lista y devuelve solo la cuenta modificada, ya con sus datos
        # actualizados.
        users = await self.list_users()
        return next(item for item in users if item.id == target.id)

    async def delete_user(self, actor: User, target_id: uuid.UUID) -> uuid.UUID | None:
        """Elimina una cuenta de forma permanente, si las reglas lo permiten.

        Devuelve el id de Supabase de la cuenta eliminada (o None) para que la ruta
        pueda olvidar sus tokens.
        """
        # Bloquea las cuentas administradoras activas, para que dos borrados simultáneos no dejen
        # cero admins.
        active_admin_ids = list(
            await self.session.scalars(
                select(User.id)
                .where(User.role == UserRole.ADMIN, User.is_active.is_(True))
                .order_by(User.id)
                .with_for_update()
            )
        )
        target = await self.session.scalar(
            select(User).where(User.id == target_id).with_for_update()
        )
        if target is None:
            raise UserNotFoundError()
        if target.id == actor.id:
            raise ConflictError(
                "No puedes eliminar tu propia cuenta de administrador.",
                code="cannot_delete_self",
            )

        # Nunca se deja el panel sin ninguna administradora activa.
        if target.role == UserRole.ADMIN and target.is_active:
            if len(active_admin_ids) <= 1:
                raise ConflictError(
                    "No se puede eliminar la última cuenta de administrador activa.",
                    code="last_admin_required",
                )

        # No se elimina una cuenta que tenga investigaciones corriendo.
        active_run = await self.session.scalar(
            select(ResearchRun.id)
            .join(Project, Project.id == ResearchRun.project_id)
            .where(
                Project.user_id == target.id,
                ResearchRun.status.in_(ACTIVE_RUN_STATUSES),
            )
            .limit(1)
        )
        # Ni una cuenta con un informe generándose.
        generating_report = await self.session.scalar(
            select(Report.id)
            .join(Project, Project.id == Report.project_id)
            .where(
                Project.user_id == target.id,
                Report.status == ReportStatus.GENERATING,
            )
            .limit(1)
        )
        if active_run is not None or generating_report is not None:
            raise ConflictError(
                "Espera a que terminen las tareas del usuario antes de eliminar su cuenta.",
                code="user_has_active_jobs",
            )

        # Si la cuenta existe también en Supabase, primero se borra allá.
        # La llamada es síncrona, así que se ejecuta en un hilo aparte para no bloquear el servidor.
        if target.supabase_user_id is not None:
            try:
                await run_in_threadpool(
                    SupabaseAdminClient(self.settings).delete_user, target.supabase_user_id
                )
            except SupabaseAuthUnavailableError as exc:
                raise ServiceUnavailableError(
                    str(exc), code="supabase_account_deletion_unavailable"
                ) from exc

        # Al borrar la cuenta, la base de datos borra en cascada sus proyectos y datos dependientes.
        supabase_user_id = target.supabase_user_id
        await self.session.delete(target)
        await self.session.commit()
        return supabase_user_id
