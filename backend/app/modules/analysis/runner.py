"""Análisis en segundo plano sobre una ejecución ya completada (lo lanza el usuario).

Mientras analiza, la ejecución vuelve a `running` con el paso `analyzing`: así sigue valiendo la
regla de una sola ejecución activa por proyecto y el frontend reutiliza el mismo progreso.
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
from app.modules.analysis import fake_responses  # noqa: F401 - registra respuestas simuladas
from app.modules.analysis.generation import (
    ANALYSIS_PROMPT_VERSION,
    AnalysisResult,
    analysis_inputs,
    analysis_messages,
    replace_unreviewed_ai_items,
    save_analysis,
)
from app.modules.projects.models import Project, ProjectStatus
from app.modules.projects.repository import IdeaAttributeRepository
from app.modules.research.models import ResearchRun, RunStatus, RunStep
from app.modules.research.orchestrator import mark_run_failed
from app.modules.research.prompts import idea_context

logger = logging.getLogger(__name__)


class AnalysisRunner:
    """Representa analisis runner."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
    ) -> None:
        """Gestiona la inicializacion para analisis."""
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings

    async def run(self, run_id: uuid.UUID) -> None:
        """Tarea en segundo plano: nunca propaga excepciones."""
        # Abre y libera los recursos declarados en este bloque.
        async with self.sessionmaker() as session:
            # Protege la operacion y dirige sus errores a manejadores explicitos.
            try:
                await self._execute(session, run_id)
            # Maneja el error Exception sin detener el flujo esperado.
            except Exception as exc:
                # Rama condicional: se cumple isinstance(exc, AIProviderError).
                if isinstance(exc, AIProviderError):
                    logger.warning("El análisis de %s falló: %s", run_id, exc.code)
                else:
                    logger.exception("Error no controlado en el análisis de %s", run_id)
                await self._fail(
                    session,
                    run_id,
                    exc.code if isinstance(exc, AIProviderError) else "analysis_failed",
                )

    async def _fail(self, session: AsyncSession, run_id: uuid.UUID, code: str) -> None:
        """Gestiona el flujo en analisis."""
        # Protege la operacion y dirige sus errores a manejadores explicitos.
        try:
            await session.rollback()
            run = await session.get(ResearchRun, run_id)
            # Rama condicional: se cumple run is not None.
            if run is not None:
                mark_run_failed(run, None, code)
                await session.commit()
        # Maneja el error Exception sin detener el flujo esperado.
        except Exception:
            logger.exception("No se pudo registrar el fallo del análisis de %s", run_id)

    async def _execute(self, session: AsyncSession, run_id: uuid.UUID) -> None:
        """Gestiona el flujo en analisis."""
        run = await session.get(ResearchRun, run_id)
        # Rama condicional: evalua run is None or run.status != RunStatus.RUNNING or
        # run.current_step != Ru.
        if run is None or run.status != RunStatus.RUNNING or run.current_step != RunStep.ANALYZING:
            return
        project = await session.get(Project, run.project_id)
        # Rama condicional: se cumple project is None.
        if project is None:
            return
        attributes = await IdeaAttributeRepository(session).list_for_project(project.id)
        refs, competitors, queries = await analysis_inputs(session, project.id, run.id)
        ctx = AICallContext(user_id=project.user_id, project_id=project.id, research_run_id=run.id)

        outcome = await timed_call(
            self.provider.generate_structured(
                analysis_messages(idea_context(project, attributes), refs, competitors, queries),
                AnalysisResult,
            ),
            self.settings.ai_timeout_seconds,
        )
        session.add_all(
            build_call_logs(
                ctx,
                self.provider,
                AIOperation.ANALYSIS,
                ANALYSIS_PROMPT_VERSION,
                outcome,
                outcome.result.usage if outcome.result else None,
            )
        )
        # Rama condicional: se cumple outcome.result is None.
        if outcome.result is None:
            await session.commit()  # conserva el registro de consumo del intento fallido
            raise outcome.error or AIProviderError()

        await replace_unreviewed_ai_items(session, project.id, run.id)
        stats = await save_analysis(session, project.id, run.id, outcome.result.data, refs)
        # Rama condicional: se cumple stats.discarded.
        if stats.discarded:
            logger.info(
                "Análisis %s: %d elementos descartados sin respaldo", run.id, stats.discarded
            )
        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        run.finished_at = datetime.now(UTC)
        project.status = ProjectStatus.ANALYZED
        await session.commit()
