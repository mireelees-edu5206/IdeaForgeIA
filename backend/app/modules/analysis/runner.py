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
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
    ) -> None:
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings

    async def run(self, run_id: uuid.UUID) -> None:
        """Tarea en segundo plano: nunca propaga excepciones."""
        async with self.sessionmaker() as session:
            try:
                await self._execute(session, run_id)
            except Exception as exc:
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
        try:
            await session.rollback()
            run = await session.get(ResearchRun, run_id)
            if run is not None:
                mark_run_failed(run, None, code)
                await session.commit()
        except Exception:
            logger.exception("No se pudo registrar el fallo del análisis de %s", run_id)

    async def _execute(self, session: AsyncSession, run_id: uuid.UUID) -> None:
        run = await session.get(ResearchRun, run_id)
        if run is None or run.status != RunStatus.RUNNING or run.current_step != RunStep.ANALYZING:
            return
        project = await session.get(Project, run.project_id)
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
        if outcome.result is None:
            await session.commit()  # conserva el registro de consumo del intento fallido
            raise outcome.error or AIProviderError()

        await replace_unreviewed_ai_items(session, project.id, run.id)
        stats = await save_analysis(session, project.id, run.id, outcome.result.data, refs)
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
