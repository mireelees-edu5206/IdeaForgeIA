"""Análisis en segundo plano sobre una ejecución ya completada (lo lanza el usuario).

ARCHIVO: backend/app/modules/analysis/runner.py

¿Qué es?
El trabajador que arma el análisis. Toma una investigación ya terminada, le pide a la IA que
proponga oportunidades, riesgos, hipótesis y datos faltantes, y guarda el resultado.

¿Para qué sirve?
Para convertir los hallazgos en un plan de acción: qué aprovechar, qué cuidar, qué comprobar y
qué falta saber.

¿Quién lo usa?
router.py lo lanza en segundo plano (POST /research-runs/{run_id}/analysis).
main.py lo crea al arrancar.

Cómo sigue el progreso:
Mientras analiza, la investigación vuelve a "running" con el paso "analyzing". Así sigue valiendo
la regla de una sola actividad por proyecto, y el frontend reutiliza la misma barra de progreso.

Si algo falla, la investigación no se marca como fallida: sus hallazgos siguen siendo válidos.
Solo se anota el error del análisis (ver mark_run_failed en research/orchestrator.py).
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

# Registro de mensajes del backend (aparecen en la consola del servidor).
logger = logging.getLogger(__name__)


class AnalysisRunner:
    """Hace el análisis de una investigación terminada, en segundo plano."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
    ) -> None:
        """Guarda la fábrica de sesiones, el proveedor de IA y la configuración."""
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings

    async def run(self, run_id: uuid.UUID) -> None:
        """Tarea en segundo plano: nunca propaga excepciones.

        Si algo falla, lo registra y deja la investigación con el error del análisis.
        """
        # Cada análisis usa su propia sesión de base de datos.
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
        """Registra el error del análisis en la investigación.

        Si no se puede registrar, lo anota en el log.
        """
        try:
            # Se deshace lo que quedó a medias antes de anotar el error.
            await session.rollback()
            run = await session.get(ResearchRun, run_id)
            if run is not None:
                # Pasar None como proyecto: el análisis no debe devolver el proyecto a "structured".
                mark_run_failed(run, None, code)
                await session.commit()
        except Exception:
            logger.exception("No se pudo registrar el fallo del análisis de %s", run_id)

    async def _execute(self, session: AsyncSession, run_id: uuid.UUID) -> None:
        """Arma el análisis: pide la propuesta a la IA, la revisa y la guarda."""
        run = await session.get(ResearchRun, run_id)
        # Solo se analiza si la investigación está corriendo en el paso de análisis.
        if run is None or run.status != RunStatus.RUNNING or run.current_step != RunStep.ANALYZING:
            return
        project = await session.get(Project, run.project_id)
        if project is None:
            return
        attributes = await IdeaAttributeRepository(session).list_for_project(project.id)
        # Reúne los hallazgos, competidores y preguntas que servirán de base para el análisis.
        refs, competitors, queries = await analysis_inputs(session, project.id, run.id)
        ctx = AICallContext(user_id=project.user_id, project_id=project.id, research_run_id=run.id)

        # Le pide a la IA la propuesta completa del análisis, con el tiempo máximo de espera.
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

        # Antes de guardar lo nuevo, se borran las propuestas de la IA que nadie revisó.
        # Lo que ya fue aceptado o cambiado por la persona se conserva.
        await replace_unreviewed_ai_items(session, project.id, run.id)
        stats = await save_analysis(session, project.id, run.id, outcome.result.data, refs)
        # Solo se anota en el log cuántos elementos se descartaron por no tener respaldo.
        if stats.discarded:
            logger.info(
                "Análisis %s: %d elementos descartados sin respaldo", run.id, stats.discarded
            )
        # El análisis terminó: la investigación queda completada y el proyecto, analizado.
        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        run.finished_at = datetime.now(UTC)
        project.status = ProjectStatus.ANALYZED
        await session.commit()
