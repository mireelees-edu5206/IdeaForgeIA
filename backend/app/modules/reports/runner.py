"""Genera reportes en segundo plano y conserva el consumo de IA y su estado final."""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.modules.ai.calls import AICallContext, build_call_logs, timed_call
from app.modules.ai.errors import AIProviderError
from app.modules.ai.models import AIOperation
from app.modules.ai.providers.base import AIProvider
from app.modules.geo.providers.base import GeoProvider
from app.modules.projects.models import Project
from app.modules.reports import fake_responses as _fake_responses  # noqa: F401
from app.modules.reports.generation import (
    REPORT_PROMPT_VERSION,
    build_report_context,
    report_messages,
    report_sections,
)
from app.modules.reports.models import Report, ReportSection, ReportStatus
from app.modules.reports.schemas import SECTION_TITLES, ReportDraft
from app.modules.research.models import ResearchRun

logger = logging.getLogger(__name__)


class ReportRunner:
    """Representa informe runner."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
        geo_provider: GeoProvider | None = None,
    ) -> None:
        """Gestiona la inicializacion para informes."""
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings
        self.geo_provider = geo_provider

    async def run(self, report_id: uuid.UUID) -> None:
        """La tarea de fondo registra fallos sin propagar excepciones al servidor."""
        # Abre y libera los recursos declarados en este bloque.
        async with self.sessionmaker() as session:
            # Protege la operacion y dirige sus errores a manejadores explicitos.
            try:
                await self._execute(session, report_id)
            # Maneja el error Exception sin detener el flujo esperado.
            except Exception as exc:
                code = exc.code if isinstance(exc, AIProviderError) else "report_generation_failed"
                # Rama condicional: se cumple isinstance(exc, AIProviderError).
                if isinstance(exc, AIProviderError):
                    logger.warning("El informe %s falló: %s", report_id, code)
                else:
                    logger.exception("Error no controlado al generar el informe %s", report_id)
                # Protege la operacion y dirige sus errores a manejadores explicitos.
                try:
                    await session.rollback()
                    await self._mark_failed(session, report_id, code)
                # Maneja el error Exception sin detener el flujo esperado.
                except Exception:
                    logger.exception("No se pudo registrar el fallo del informe %s", report_id)

    async def _execute(self, session: AsyncSession, report_id: uuid.UUID) -> None:
        """Gestiona el flujo en informes."""
        report = await session.get(Report, report_id)
        # Rama condicional: se cumple report is None or report.status !=
        # ReportStatus.GENERATING.
        if report is None or report.status != ReportStatus.GENERATING:
            return
        project = await session.get(Project, report.project_id)
        run = await session.get(ResearchRun, report.run_id) if report.run_id else None
        # Rama condicional: se cumple project is None or run is None.
        if project is None or run is None:
            await self._mark_failed(session, report.id, "report_context_missing")
            return

        context = await build_report_context(
            session,
            project,
            run,
            self.geo_provider,
            report.geographic_scopes,
        )
        outcome = await timed_call(
            self.provider.generate_structured(report_messages(context), ReportDraft),
            self.settings.ai_timeout_seconds,
        )
        session.add_all(
            build_call_logs(
                AICallContext(
                    user_id=project.user_id,
                    project_id=project.id,
                    research_run_id=run.id,
                ),
                self.provider,
                AIOperation.REPORT_GENERATION,
                REPORT_PROMPT_VERSION,
                outcome,
                outcome.result.usage if outcome.result else None,
            )
        )
        # Rama condicional: se cumple outcome.result is None.
        if outcome.result is None:
            error = outcome.error or AIProviderError()
            report.status = ReportStatus.FAILED
            report.error_code = error.code
            report.completed_at = datetime.now(UTC)
            await session.commit()
            return

        sections = report_sections(outcome.result.data, context)
        session.add_all(
            ReportSection(
                report_id=report.id,
                section_type=section_type,
                position=position,
                title=SECTION_TITLES[section_type],
                content=content,
                verdict=verdict,
            )
            for position, (section_type, content, verdict) in enumerate(sections)
        )
        report.status = ReportStatus.COMPLETED
        report.ai_provider = outcome.result.provider or self.provider.name
        report.ai_model = outcome.result.model or self.provider.model
        report.error_code = None
        report.completed_at = datetime.now(UTC)
        await session.commit()

    async def _mark_failed(self, session: AsyncSession, report_id: uuid.UUID, code: str) -> None:
        """Gestiona failed en informes."""
        report = await session.get(Report, report_id)
        # Rama condicional: se cumple report is None or report.status !=
        # ReportStatus.GENERATING.
        if report is None or report.status != ReportStatus.GENERATING:
            return
        report.status = ReportStatus.FAILED
        report.error_code = code
        report.completed_at = datetime.now(UTC)
        await session.commit()
