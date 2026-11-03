"""Ejecución de una investigación en segundo plano: planificación → búsquedas → extracción.

ARCHIVO: backend/app/modules/research/orchestrator.py

¿Qué es?
El motor de la investigación. Corre en segundo plano, después de que la persona pide investigar,
y hace los pasos en orden:
1. Planear: la IA propone una lista de preguntas (por ejemplo, sobre mercado o competencia).
2. Buscar: cada pregunta se manda a la IA con búsqueda en internet, en paralelo, y se guardan
   las respuestas, las fuentes y los fragmentos citados.
3. Extraer: la IA lee esas respuestas y saca hallazgos, siempre con evidencia.

¿Para qué sirve?
Es lo que convierte una idea en datos con fuentes. Cada paso actualiza el avance (progress_pct)
y el paso actual, para que la pantalla pueda mostrar el progreso.

¿Quién lo usa?
- router.py: lanza run() en segundo plano cuando la persona pide investigar.
- main.py: crea el orquestador al arrancar y llama a recover_interrupted_runs.

Reglas de seguridad y de calidad:
- Si una búsqueda falla, se marca esa pregunta como fallida y se sigue con las demás.
- Si ninguna búsqueda sale bien, la investigación falla con un mensaje claro.
- Una fuente o cita sin evidencia válida no se guarda: se descarta en lugar de inventar.
- Los errores técnicos se guardan solo como código.
  El mensaje para la persona está en RUN_ERROR_MESSAGES.

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

# Registro de mensajes del backend (aparecen en la consola del servidor).
logger = logging.getLogger(__name__)

# Mensajes para el usuario: nunca se guarda el detalle técnico del error.
# Cada clave es un código de error; el valor es el texto que ve la persona.
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
    """Elige el código de error que representa a todas las búsquedas fallidas.

    Si ningún error se repite más que otro, o el código no tiene mensaje, se usa "todas fallaron".
    """
    if not error_codes:
        return "all_searches_failed"
    # most_common ordena los errores del más frecuente al menos frecuente.
    failures = error_codes.most_common()
    # Si dos errores empataron en frecuencia, no hay una causa clara.
    if len(failures) > 1 and failures[0][1] == failures[1][1]:
        return "all_searches_failed"
    code = failures[0][0]
    return code if code in RUN_ERROR_MESSAGES else "all_searches_failed"


# Porcentajes de avance de la barra de progreso (0 a 100).
PLANNING_PROGRESS = 5  # Empieza la planeación.
SEARCH_START_PROGRESS = 15  # Empiezan las búsquedas.
SEARCH_END_PROGRESS = 80  # Terminan las búsquedas; empieza la extracción.


class ResearchFailedError(Exception):
    """Error interno que indica por qué falló la investigación. Lleva el código de
    RUN_ERROR_MESSAGES."""

    def __init__(self, code: str) -> None:
        """Guarda el código de error para que quede registrado en la investigación."""
        self.code = code
        super().__init__(code)


def _now() -> datetime:
    """Devuelve la hora actual en UTC (la base de datos siempre guarda la hora en UTC)."""
    return datetime.now(UTC)


def mark_run_failed(run: ResearchRun, project: Project | None, code: str) -> None:
    """Marca la investigación como fallida o interrumpida.

    También devuelve el proyecto a un estado seguro.

    Si el error ocurrió durante el análisis, la investigación sigue siendo válida: no se marca
    como fallida, solo se anota el error del análisis.
    """
    if run.current_step == RunStep.ANALYZING:
        # Falló el análisis (Fase 11): la investigación y sus hallazgos siguen siendo válidos.
        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        # Si la interrupción fue del servidor, se usa su código específico de análisis.
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
    # Interrupción del servidor: "interrupted". Cualquier otro error: "failed".
    run.status = RunStatus.INTERRUPTED if code == "interrupted" else RunStatus.FAILED
    run.error_code = code
    run.error_message = RUN_ERROR_MESSAGES.get(code, RUN_ERROR_MESSAGES["internal_error"])
    run.finished_at = _now()
    # La idea sigue estructurada: el usuario puede reintentar.
    if project is not None and project.status == ProjectStatus.RESEARCHING:
        project.status = ProjectStatus.STRUCTURED


class ResearchOrchestrator:
    """Dirige los pasos de una investigación: planear, buscar y extraer."""

    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        settings: Settings,
    ) -> None:
        """Guarda el proveedor de IA y la configuración, y crea el límite de búsquedas en
        paralelo."""
        self.sessionmaker = sessionmaker
        self.provider = provider
        self.settings = settings
        # El semáforo deja pasar solo "ai_max_concurrency" búsquedas a la vez. Así no se satura la
        # IA.
        self._semaphore = asyncio.Semaphore(settings.ai_max_concurrency)

    async def run(self, run_id: uuid.UUID) -> None:
        """Punto de entrada de la tarea en segundo plano: nunca propaga excepciones.

        Si algo falla, lo registra y marca la investigación como fallida. Así el servidor no se cae.
        """
        # Cada investigación usa su propia sesión de base de datos, separada de la petición
        # original.
        async with self.sessionmaker() as session:
            try:
                await self._execute(session, run_id)
            except Exception as exc:
                # Si el error ya tiene código (de la investigación o de la IA), se usa ese código.
                code = exc.code if isinstance(exc, ResearchFailedError | AIProviderError) else None
                if code is None:
                    logger.exception("Error no controlado en la investigación %s", run_id)
                else:
                    logger.warning("La investigación %s falló: %s", run_id, code)
                await self._fail(session, run_id, code or "internal_error")

    async def _fail(self, session: AsyncSession, run_id: uuid.UUID, code: str) -> None:
        """Registra el fallo en la base de datos. Si tampoco se puede registrar, lo anota en el
        log."""
        try:
            # Se deshace cualquier cambio a medias antes de marcar el fallo.
            await session.rollback()
            run = await session.get(ResearchRun, run_id)
            if run is None:  # el proyecto se borró mientras tanto
                return
            mark_run_failed(run, await session.get(Project, run.project_id), code)
            await session.commit()
        except Exception:
            logger.exception("No se pudo registrar el fallo de la investigación %s", run_id)

    async def _execute(self, session: AsyncSession, run_id: uuid.UUID) -> None:
        """Ejecuta los tres pasos en orden y marca la investigación como completada al final."""
        run = await session.get(ResearchRun, run_id)
        # Si la investigación ya no existe, o ya no está pendiente, no hay nada que hacer.
        if run is None or run.status != RunStatus.PENDING:
            return
        project = await session.get(Project, run.project_id)
        if project is None:
            return
        # Se leen las partes confirmadas de la idea, que son lo que la IA usará para investigar.
        attributes = await IdeaAttributeRepository(session).list_for_project(project.id)
        context = idea_context(project, attributes)
        # Quién y para qué: se guarda en cada registro de la bitácora de IA.
        ctx = AICallContext(user_id=project.user_id, project_id=project.id, research_run_id=run.id)

        # La investigación pasa a "corriendo" y guarda el primer paso y su avance.
        run.status = RunStatus.RUNNING
        run.started_at = _now()
        run.current_step = RunStep.PLANNING
        run.progress_pct = PLANNING_PROGRESS
        await session.commit()

        queries = await self._plan(session, ctx, run, context)
        await self._search(session, ctx, run, project, queries, context)
        await self._extract(session, ctx, run, queries, context)

        # Si llegamos aquí, todos los pasos terminaron: la investigación queda completada al 100%.
        run.status = RunStatus.COMPLETED
        run.current_step = None
        run.progress_pct = 100
        run.finished_at = _now()
        await session.commit()

    async def _plan(
        self, session: AsyncSession, ctx: AICallContext, run: ResearchRun, context: str
    ) -> list[ResearchQuery]:
        """Paso 1: pide a la IA el plan de preguntas y lo guarda, sin repetidas."""
        max_questions = self.settings.research_max_questions
        outcome = await timed_call(
            self.provider.generate_structured(
                planning_messages(context, max_questions), ResearchPlan
            ),
            self.settings.ai_timeout_seconds,
        )
        # Se guarda el registro de la llamada (bien o mal) en la bitácora de IA.
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
        # Si la IA falló, se guarda el registro y se detiene la investigación con ese error.
        if outcome.error or outcome.result is None:
            await session.commit()  # conserva el registro de consumo del intento fallido
            raise outcome.error or ResearchFailedError("ai_error")

        # Se quitan preguntas repetidas (sin importar mayúsculas) y se respeta el máximo.
        seen: set[str] = set()
        queries: list[ResearchQuery] = []
        for planned in outcome.result.data.questions:
            # casefold compara sin mayúsculas ni acentos especiales.
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
        # Si no quedó ninguna pregunta útil, la investigación no puede seguir.
        if not queries:
            await session.commit()
            raise ResearchFailedError("empty_plan")

        session.add_all(queries)
        # Avanza al paso de búsqueda.
        run.current_step = RunStep.SEARCHING
        run.progress_pct = SEARCH_START_PROGRESS
        await session.commit()
        return queries

    async def _grounded(
        self, query: ResearchQuery, context: str
    ) -> tuple[ResearchQuery, AICallOutcome[GroundedResult]]:
        """Hace la búsqueda de una sola pregunta, respetando el límite de búsquedas en paralelo."""
        # El semáforo espera su turno si ya hay demasiadas búsquedas corriendo.
        async with self._semaphore:
            outcome = await timed_call(
                self.provider.generate_grounded(
                    search_messages(context, query.category, query.question)
                ),
                self.settings.ai_timeout_seconds,
            )
        # Se devuelve también la pregunta, para saber a cuál pertenece el resultado.
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
        """Ejecuta búsquedas concurrentes y persiste cada resultado en una sola sesion."""
        # Las llamadas a la IA van en paralelo; la sesión de BD se usa solo desde este bucle.
        tasks = [asyncio.create_task(self._grounded(q, context)) for q in queries]
        completed = 0
        # Cuenta cuántas veces apareció cada tipo de error, para elegir el código final.
        failure_codes: Counter[str] = Counter()
        try:
            # as_completed devuelve cada búsqueda en cuanto termina, sin importar el orden.
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
                    # La búsqueda salió bien: se guarda la respuesta, las fuentes y las citas.
                    await self._save_grounded(session, project.id, query, outcome.result)
                    completed += 1
                else:
                    # La búsqueda falló: la pregunta queda marcada y se anota el código del error.
                    query.status = QueryStatus.FAILED
                    failure_codes[outcome.error.code if outcome.error else "ai_error"] += 1
                # El avance sube según cuántas preguntas ya no están pendientes.
                done = sum(q.status != QueryStatus.PENDING for q in queries)
                run.progress_pct = SEARCH_START_PROGRESS + round(
                    (SEARCH_END_PROGRESS - SEARCH_START_PROGRESS) * done / len(queries)
                )
                await session.commit()
        finally:
            # Si algo se interrumpe, se cancelan las búsquedas que todavía no terminaron.
            for task in tasks:
                task.cancel()
        # Si ninguna búsqueda salió bien, la investigación falla con el error más probable.
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
        """Paso 3: la IA lee la evidencia citada y saca hallazgos con sus referencias."""
        run.current_step = RunStep.EXTRACTING
        run.progress_pct = SEARCH_END_PROGRESS
        await session.commit()

        # Se juntan todas las evidencias de esta investigación, con su pregunta y su fuente.
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
        # Solo las preguntas que sí se respondieron se mandan a la extracción.
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
        # Si la extracción falla, la investigación no se marca como fallida: las búsquedas siguen
        # disponibles.
        if outcome.result is None:
            logger.warning("Extracción fallida en %s: %s", run.id, outcome.error)
            run.error_code = "extraction_failed"
            run.error_message = RUN_ERROR_MESSAGES["extraction_failed"]
            await session.commit()
            return
        # Se guardan solo los hallazgos que tienen evidencia válida (ver findings/extraction.py).
        stats = await save_extraction(
            session, run.project_id, run.id, outcome.result.data, items, answered
        )
        # Solo se registra en el log un resumen, para saber cuántos hallazgos se descartaron.
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
        """Guarda una respuesta de búsqueda: el texto, las fuentes, los vínculos y las citas."""
        text = result.text
        query.response_text = text
        # Se guardan como máximo 20 búsquedas, sin vacías.
        query.executed_queries = [q for q in result.executed_queries if q][:20]
        query.search_suggestions_html = result.search_suggestions_html
        query.status = QueryStatus.COMPLETED
        query.completed_at = _now()

        sources = SourceRepository(session)
        # Relaciona el número de la fuente en la respuesta con su id en la base de datos.
        source_ids: dict[int, uuid.UUID] = {}
        for index, grounded in enumerate(result.sources):
            # Se limpia la dirección. Si no es válida, la fuente se salta.
            url = normalize_url(grounded.url)
            if url is None:
                continue
            # El título se recorta a 500 letras; si queda vacío, se guarda como nulo.
            title = (grounded.title or "").strip()[:500] or None
            # Se guarda la fuente, o se reutiliza si ya existía en el proyecto.
            source_ids[index] = await sources.upsert(
                project_id, url, title, guess_source_type(url.domain)
            )

        # Las fuentes citadas son las que aparecen en alguna cita, o las marcadas como citadas.
        cited = {i for c in result.citations for i in c.source_indexes}
        cited |= {i for i, s in enumerate(result.sources) if s.cited}
        # Dos URLs distintas pueden normalizarse a la misma fuente: se fusionan.
        links: dict[uuid.UUID, ResearchQuerySource] = {}
        for index, source_id in source_ids.items():
            link = links.get(source_id)
            if link is None:
                # Primer vínculo para esta fuente: se guarda su posición de ranking.
                links[source_id] = ResearchQuerySource(
                    query_id=query.id, source_id=source_id, was_cited=index in cited, rank=index
                )
            else:
                # Si la fuente ya estaba, basta con que una de sus URL haya sido citada.
                link.was_cited = link.was_cited or index in cited
        session.add_all(links.values())

        # Evitamos guardar dos veces la misma evidencia: (fuente, inicio, fin).
        seen: set[tuple[uuid.UUID, int, int]] = set()
        for citation in result.citations:
            start, end = citation.start, citation.end
            # Se descarta una cita si sus posiciones están fuera del texto o si está vacía.
            if not 0 <= start < end <= len(text) or not text[start:end].strip():
                continue  # span fuera del texto: se descarta en lugar de guardar evidencia falsa
            for index in citation.source_indexes:
                source_id = source_ids.get(index)
                if source_id is None or (source_id, start, end) in seen:
                    continue
                seen.add((source_id, start, end))
                # La evidencia guarda el fragmento exacto de la respuesta y de dónde sale.
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
    """Al arrancar el servidor, marca como interrumpidas las investigaciones que quedaron activas.

    Al arrancar no hay tareas en curso: las ejecuciones activas quedaron huérfanas.
    Devuelve cuántas investigaciones se marcaron.
    """
    async with sessionmaker() as session:
        runs = await ResearchRunRepository(session).list_active()
        for run in runs:
            mark_run_failed(run, await session.get(Project, run.project_id), "interrupted")
        await session.commit()
        return len(runs)
