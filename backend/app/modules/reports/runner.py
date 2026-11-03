"""Genera reportes en segundo plano y conserva el consumo de IA y su estado final.

ARCHIVO: backend/app/modules/reports/runner.py

¿Qué es?
El trabajador que escribe el informe. Reúne el contexto del proyecto, le pide a la IA el borrador
(ReportDraft), lo convierte en secciones y guarda el resultado.

¿Para qué sirve?
Para que la persona no tenga que esperar: el informe se escribe después de responder la petición.

¿Quién lo usa?
router.py lo lanza en segundo plano. main.py lo crea al arrancar.

Si algo falla, el informe queda marcado como fallido con su código de error.
Nada se propaga al servidor.
"""

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

# Registro de mensajes del backend (aparecen en la consola del servidor).
logger = logging.getLogger(__name__)


class ReportRunner:
    """Escribe un informe en segundo plano, con su contexto y las llamadas a la IA."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
        geo_provider: GeoProvider | None = None,
    ) -> None:
        """Guarda la fábrica de sesiones, el proveedor de IA, la configuración y el de mapas."""
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings
        # El proveedor de mapas es opcional: sirve para buscar lugares de las zonas del informe.
        self.geo_provider = geo_provider

    async def run(self, report_id: uuid.UUID) -> None:
        """Tarea de fondo: registra los fallos sin propagar excepciones al servidor."""
        # Cada informe usa su propia sesión de base de datos.
        async with self.sessionmaker() as session:
            try:
                await self._execute(session, report_id)
            except Exception as exc:
                code = exc.code if isinstance(exc, AIProviderError) else "report_generation_failed"
                if isinstance(exc, AIProviderError):
                    logger.warning("El informe %s falló: %s", report_id, code)
                else:
                    logger.exception("Error no controlado al generar el informe %s", report_id)
                # Se deshace lo que quedó a medias y se marca el informe como fallido.
                try:
                    await session.rollback()
                    await self._mark_failed(session, report_id, code)
                except Exception:
                    logger.exception("No se pudo registrar el fallo del informe %s", report_id)

    async def _execute(self, session: AsyncSession, report_id: uuid.UUID) -> None:
        """Genera el informe: arma el contexto, pide el borrador a la IA y guarda las secciones."""
        report = await session.get(Report, report_id)
        # Solo se genera si el informe todavía está en estado "generando".
        if report is None or report.status != ReportStatus.GENERATING:
            return
        project = await session.get(Project, report.project_id)
        run = await session.get(ResearchRun, report.run_id) if report.run_id else None
        # Sin proyecto o sin investigación de origen, el informe no se puede generar.
        if project is None or run is None:
            await self._mark_failed(session, report.id, "report_context_missing")
            return

        # Reúne la información del proyecto que se le mandará a la IA.
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
        # Se guarda la bitácora de la llamada, bien o mal.
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
        if outcome.result is None:
            # La IA no respondió: el informe queda fallido con el código del error.
            error = outcome.error or AIProviderError()
            report.status = ReportStatus.FAILED
            report.error_code = error.code
            report.completed_at = datetime.now(UTC)
            await session.commit()
            return

        # Convierte el borrador en secciones, cada una con su tipo, posición y título.
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
        # El informe queda completado y guarda qué proveedor y modelo lo escribieron.
        report.status = ReportStatus.COMPLETED
        report.ai_provider = outcome.result.provider or self.provider.name
        report.ai_model = outcome.result.model or self.provider.model
        report.error_code = None
        report.completed_at = datetime.now(UTC)
        await session.commit()

    async def _mark_failed(self, session: AsyncSession, report_id: uuid.UUID, code: str) -> None:
        """Marca el informe como fallido con su código, solo si todavía se estaba generando."""
        report = await session.get(Report, report_id)
        if report is None or report.status != ReportStatus.GENERATING:
            return
        report.status = ReportStatus.FAILED
        report.error_code = code
        report.completed_at = datetime.now(UTC)
        await session.commit()
