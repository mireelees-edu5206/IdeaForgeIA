"""Ejecución de una investigación en segundo plano: planificación → búsquedas → extracción.

El análisis (Fase 11) lo lanza el usuario después, sobre la misma ejecución (`analysis/runner.py`).
"""

import asyncio
import logging
import uuid
from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.modules.ai.calls import AICallContext, AICallOutcome, build_call_logs, timed_call
from app.modules.ai.errors import AIProviderError
from app.modules.ai.models import AIOperation
from app.modules.ai.providers.base import AIProvider
from app.modules.ai.types import GroundedResult
from app.modules.findings import fake_responses as fake_extraction  # noqa: F401
from app.modules.findings.extraction import (
    EXTRACTION_PROMPT_VERSION,
    ExtractionResult,
    build_evidence_items,
    extraction_messages,
    save_extraction,
)
from app.modules.findings.models import Evidence, EvidenceKind
from app.modules.projects.models import Project, ProjectStatus
from app.modules.projects.repository import IdeaAttributeRepository
from app.modules.research import fake_responses  # noqa: F401 - registra respuestas simuladas
from app.modules.research.models import (
    QueryStatus,
    ResearchQuery,
    ResearchQuerySource,
    ResearchRun,
    RunStatus,
    RunStep,
    Source,
)
from app.modules.research.prompts import (
    PLANNING_PROMPT_VERSION,
    SEARCH_PROMPT_VERSION,
    idea_context,
    planning_messages,
    search_messages,
)
from app.modules.research.repository import ResearchRunRepository, SourceRepository
from app.modules.research.schemas import ResearchPlan
from app.modules.research.urls import guess_source_type, normalize_url

logger = logging.getLogger(__name__)

# Mensajes para el usuario: nunca se guarda el detalle técnico del error.
RUN_ERROR_MESSAGES = {
    "ai_timeout": "El proveedor de IA tardó demasiado en responder.",
    "ai_rate_limited": (
        "Se alcanzó temporalmente el límite de uso de IA. Vuelve a intentarlo más tarde."
    ),
    "ai_unavailable": "El proveedor de IA no está disponible en este momento.",
    "ai_authentication": "La autenticación del proveedor de IA no está configurada correctamente.",
    "ai_grounding_unavailable": (
        "No se pudo obtener una respuesta con búsqueda web; "
        "no se usará una respuesta local como información actual."
    ),
    "ai_invalid_response": "La IA devolvió una respuesta con un formato inesperado.",
    "ai_error": "El proveedor de IA devolvió un error.",
    "empty_plan": "La IA no propuso ninguna pregunta de investigación.",
    "all_searches_failed": "Ninguna de las búsquedas pudo completarse.",
    "interrupted": "La investigación se interrumpió porque el servidor se reinició.",
    "internal_error": "Ocurrió un error interno durante la investigación.",
    # No detiene la investigación: las respuestas y fuentes siguen disponibles.
    "extraction_failed": (
        "Las búsquedas se completaron, pero no se pudieron extraer hallazgos de ellas."
    ),
    "analysis_failed": (
        "No se pudo completar el análisis. La investigación y sus hallazgos siguen disponibles."
    ),
    "analysis_interrupted": "El análisis se interrumpió porque el servidor se reinició.",
}


def _search_failure_code(error_codes: Counter[str]) -> str:
    if not error_codes:
        return "all_searches_failed"
    failures = error_codes.most_common()
    if len(failures) > 1 and failures[0][1] == failures[1][1]:
        return "all_searches_failed"
    code = failures[0][0]
    return code if code in RUN_ERROR_MESSAGES else "all_searches_failed"


PLANNING_PROGRESS = 5
SEARCH_START_PROGRESS = 15
SEARCH_END_PROGRESS = 80


class ResearchFailedError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def _now() -> datetime:
    return datetime.now(UTC)


def mark_run_failed(run: ResearchRun, project: Project | None, code: str) -> None:
    if run.current_step == RunStep.ANALYZING:
        # Falló el análisis (Fase 11): la investigación y sus hallazgos siguen siendo válidos.
        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        run.error_code = (
            "analysis_interrupted"
            if code == "interrupted"
            else code
            if code in RUN_ERROR_MESSAGES
            else "analysis_failed"
        )
        run.error_message = RUN_ERROR_MESSAGES[run.error_code]
        run.finished_at = _now()
        return
    run.status = RunStatus.INTERRUPTED if code == "interrupted" else RunStatus.FAILED
    run.error_code = code
    run.error_message = RUN_ERROR_MESSAGES.get(code, RUN_ERROR_MESSAGES["internal_error"])
    run.finished_at = _now()
    # La idea sigue estructurada: el usuario puede reintentar.
    if project is not None and project.status == ProjectStatus.RESEARCHING:
        project.status = ProjectStatus.STRUCTURED


class ResearchOrchestrator:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
    ) -> None:
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings
        self._semaphore = asyncio.Semaphore(settings.ai_max_concurrency)

    async def run(self, run_id: uuid.UUID) -> None:
        """Punto de entrada de la tarea en segundo plano: nunca propaga excepciones."""
        async with self.sessionmaker() as session:
            try:
                await self._execute(session, run_id)
            except Exception as exc:
                code = exc.code if isinstance(exc, ResearchFailedError | AIProviderError) else None
                if code is None:
                    logger.exception("Error no controlado en la investigación %s", run_id)
                else:
                    logger.warning("La investigación %s falló: %s", run_id, code)
                await self._fail(session, run_id, code or "internal_error")

    async def _fail(self, session: AsyncSession, run_id: uuid.UUID, code: str) -> None:
        try:
            await session.rollback()
            run = await session.get(ResearchRun, run_id)
            if run is None:  # el proyecto se borró mientras tanto
                return
            mark_run_failed(run, await session.get(Project, run.project_id), code)
            await session.commit()
        except Exception:
            logger.exception("No se pudo registrar el fallo de la investigación %s", run_id)

    async def _execute(self, session: AsyncSession, run_id: uuid.UUID) -> None:
        run = await session.get(ResearchRun, run_id)
        if run is None or run.status != RunStatus.PENDING:
            return
        project = await session.get(Project, run.project_id)
        if project is None:
            return
        attributes = await IdeaAttributeRepository(session).list_for_project(project.id)
        context = idea_context(project, attributes)
        ctx = AICallContext(user_id=project.user_id, project_id=project.id, research_run_id=run.id)

        run.status = RunStatus.RUNNING
        run.started_at = _now()
        run.current_step = RunStep.PLANNING
        run.progress_pct = PLANNING_PROGRESS
        await session.commit()

        queries = await self._plan(session, ctx, run, context)
        await self._search(session, ctx, run, project, queries, context)
        await self._extract(session, ctx, run, queries, context)

        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        run.finished_at = _now()
        await session.commit()

    async def _plan(
        self, session: AsyncSession, ctx: AICallContext, run: ResearchRun, context: str
    ) -> list[ResearchQuery]:
        max_questions = self.settings.research_max_questions
        outcome = await timed_call(
            self.provider.generate_structured(
                planning_messages(context, max_questions), ResearchPlan
            ),
            self.settings.ai_timeout_seconds,
        )
        session.add_all(
            build_call_logs(
                ctx,
                self.provider,
                AIOperation.RESEARCH_PLANNING,
                PLANNING_PROMPT_VERSION,
                outcome,
                outcome.result.usage if outcome.result else None,
            )
        )
        if outcome.error or outcome.result is None:
            await session.commit()  # conserva el registro de consumo del intento fallido
            raise outcome.error or ResearchFailedError("ai_error")

        seen: set[str] = set()
        queries: list[ResearchQuery] = []
        for planned in outcome.result.data.questions:
            key = planned.question.casefold()
            if key in seen:
                continue
            seen.add(key)
            queries.append(
                ResearchQuery(
                    run_id=run.id,
                    position=len(queries),
                    category=planned.category,
                    question=planned.question,
                )
            )
            if len(queries) == max_questions:
                break
        if not queries:
            await session.commit()
            raise ResearchFailedError("empty_plan")

        session.add_all(queries)
        run.current_step = RunStep.SEARCHING
        run.progress_pct = SEARCH_START_PROGRESS
        await session.commit()
        return queries

    async def _grounded(
        self, query: ResearchQuery, context: str
    ) -> tuple[ResearchQuery, AICallOutcome[GroundedResult]]:
        async with self._semaphore:
            outcome = await timed_call(
                self.provider.generate_grounded(
                    search_messages(context, query.category, query.question)
                ),
                self.settings.ai_timeout_seconds,
            )
        return query, outcome

    async def _search(
        self,
        session: AsyncSession,
        ctx: AICallContext,
        run: ResearchRun,
        project: Project,
        queries: list[ResearchQuery],
        context: str,
    ) -> None:
        # Las llamadas a la IA van en paralelo; la sesión de BD se usa solo desde este bucle.
        tasks = [asyncio.create_task(self._grounded(q, context)) for q in queries]
        completed = 0
        failure_codes: Counter[str] = Counter()
        try:
            for next_done in asyncio.as_completed(tasks):
                query, outcome = await next_done
                session.add_all(
                    build_call_logs(
                        ctx,
                        self.provider,
                        AIOperation.GROUNDED_SEARCH,
                        SEARCH_PROMPT_VERSION,
                        outcome,
                        outcome.result.usage if outcome.result else None,
                    )
                )
                if outcome.result is not None:
                    await self._save_grounded(session, project.id, query, outcome.result)
                    completed += 1
                else:
                    query.status = QueryStatus.FAILED
                    failure_codes[outcome.error.code if outcome.error else "ai_error"] += 1
                done = sum(q.status != QueryStatus.PENDING for q in queries)
                run.progress_pct = SEARCH_START_PROGRESS + round(
                    (SEARCH_END_PROGRESS - SEARCH_START_PROGRESS) * done / len(queries)
                )
                await session.commit()
        finally:
            for task in tasks:
                task.cancel()
        if completed == 0:
            raise ResearchFailedError(_search_failure_code(failure_codes))

    async def _extract(
        self,
        session: AsyncSession,
        ctx: AICallContext,
        run: ResearchRun,
        queries: list[ResearchQuery],
        context: str,
    ) -> None:
        run.current_step = RunStep.EXTRACTING
        run.progress_pct = SEARCH_END_PROGRESS
        await session.commit()

        rows = await session.execute(
            select(Evidence, ResearchQuery, Source)
            .join(ResearchQuery, ResearchQuery.id == Evidence.query_id)
            .join(Source, Source.id == Evidence.source_id)
            .where(ResearchQuery.run_id == run.id)
            .order_by(ResearchQuery.position, Evidence.span_start, Evidence.id)
        )
        items = build_evidence_items(list(rows.tuples()))
        if not items:  # sin evidencia citada no puede haber hallazgos
            return
        answered = [q for q in queries if q.status == QueryStatus.COMPLETED]
        outcome = await timed_call(
            self.provider.generate_structured(
                extraction_messages(context, items, answered), ExtractionResult
            ),
            self.settings.ai_timeout_seconds,
        )
        session.add_all(
            build_call_logs(
                ctx,
                self.provider,
                AIOperation.EXTRACTION,
                EXTRACTION_PROMPT_VERSION,
                outcome,
                outcome.result.usage if outcome.result else None,
            )
        )
        if outcome.result is None:
            logger.warning("Extracción fallida en %s: %s", run.id, outcome.error)
            run.error_code = "extraction_failed"
            run.error_message = RUN_ERROR_MESSAGES["extraction_failed"]
            await session.commit()
            return
        stats = await save_extraction(
            session, run.project_id, run.id, outcome.result.data, items, answered
        )
        if stats.discarded_findings or stats.dropped_entities:
            logger.info(
                "Extracción %s: %d hallazgos descartados sin evidencia, %d entidades no halladas",
                run.id,
                stats.discarded_findings,
                len(stats.dropped_entities),
            )
        await session.commit()

    async def _save_grounded(
        self,
        session: AsyncSession,
        project_id: uuid.UUID,
        query: ResearchQuery,
        result: GroundedResult,
    ) -> None:
        text = result.text
        query.response_text = text
        query.executed_queries = [q for q in result.executed_queries if q][:20]
        query.search_suggestions_html = result.search_suggestions_html
        query.status = QueryStatus.COMPLETED
        query.completed_at = _now()

        sources = SourceRepository(session)
        source_ids: dict[int, uuid.UUID] = {}
        for index, grounded in enumerate(result.sources):
            url = normalize_url(grounded.url)
            if url is None:
                continue
            title = (grounded.title or "").strip()[:500] or None
            source_ids[index] = await sources.upsert(
                project_id, url, title, guess_source_type(url.domain)
            )

        cited = {i for c in result.citations for i in c.source_indexes}
        cited |= {i for i, s in enumerate(result.sources) if s.cited}
        # Dos URLs distintas pueden normalizarse a la misma fuente: se fusionan.
        links: dict[uuid.UUID, ResearchQuerySource] = {}
        for index, source_id in source_ids.items():
            link = links.get(source_id)
            if link is None:
                links[source_id] = ResearchQuerySource(
                    query_id=query.id, source_id=source_id, was_cited=index in cited, rank=index
                )
            else:
                link.was_cited = link.was_cited or index in cited
        session.add_all(links.values())

        seen: set[tuple[uuid.UUID, int, int]] = set()
        for citation in result.citations:
            start, end = citation.start, citation.end
            if not 0 <= start < end <= len(text) or not text[start:end].strip():
                continue  # span fuera del texto: se descarta en lugar de guardar evidencia falsa
            for index in citation.source_indexes:
                source_id = source_ids.get(index)
                if source_id is None or (source_id, start, end) in seen:
                    continue
                seen.add((source_id, start, end))
                session.add(
                    Evidence(
                        project_id=project_id,
                        source_id=source_id,
                        query_id=query.id,
                        evidence_kind=EvidenceKind.CITED_CLAIM,
                        content=text[start:end],
                        span_start=start,
                        span_end=end,
                    )
                )


async def recover_interrupted_runs(sessionmaker: async_sessionmaker[AsyncSession]) -> int:
    """Al arrancar no hay tareas en curso: las ejecuciones activas quedaron huérfanas."""
    async with sessionmaker() as session:
        runs = await ResearchRunRepository(session).list_active()
        for run in runs:
            mark_run_failed(run, await session.get(Project, run.project_id), "interrupted")
        await session.commit()
        return len(runs)
