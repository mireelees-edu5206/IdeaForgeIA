from collections.abc import Callable
from datetime import UTC, datetime, time, timedelta
from itertools import product
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AttributeType, Level, ReviewStatus
from app.core.errors import ConflictError
from app.modules.admin.lab.algorithms import (
    find_trace_path,
    optimize_hypothesis_budget,
    optimize_project_place_route,
    schedule_validation_tasks,
)
from app.modules.admin.lab.schemas import (
    AdminLabProjectOption,
    AdminLabProjectsResponse,
    HypothesisBudgetRequest,
    HypothesisBudgetResponse,
    HypothesisBudgetSelection,
    LabMetricPoint,
    LabMetricsResponse,
    LabPlaceSearchResponse,
    LabPropositionsResponse,
    LabRouteRequest,
    LabRouteResponse,
    LabRouteStop,
    LabTracePathResponse,
    PeasDimension,
    ProjectTraceGraph,
    PropositionDefinition,
    PropositionRuleTable,
    TraceAlgorithm,
    TraceGraphEdge,
    TraceGraphNode,
    TruthTableRow,
    ValidationScheduleAssignment,
    ValidationScheduleRequest,
    ValidationScheduleResponse,
)
from app.modules.ai.models import AIApiLog, AICallStatus
from app.modules.analysis.models import (
    HypothesisFinding,
    MissingInformation,
    Opportunity,
    OpportunityFinding,
    Risk,
    RiskFinding,
    ValidationHypothesis,
)
from app.modules.entities.models import Competitor, Entity
from app.modules.findings.confidence import cap_confidence
from app.modules.findings.models import (
    Evidence,
    EvidenceStance,
    Finding,
    FindingEntity,
    FindingEvidence,
)
from app.modules.geo.providers.base import GeoProvider
from app.modules.projects.models import IdeaAttribute, Project
from app.modules.projects.service import ProjectNotFoundError
from app.modules.reports.models import Report, ReportSection
from app.modules.research.models import ResearchQuery, ResearchQuerySource, ResearchRun, Source
from app.modules.users.models import User

MAX_TRACE_NODES = 300
MAX_TRACE_RUNS = 20
MAX_TRACE_QUERIES = 100
MAX_TRACE_SOURCES = 120
MAX_TRACE_EVIDENCE = 150
MAX_TRACE_FINDINGS = 100
MAX_TRACE_ANALYSIS_ITEMS = 50
MAX_LAB_PROJECTS = 100


class AdminLabService:
    def __init__(self, session: AsyncSession, geo_provider: GeoProvider) -> None:
        self.session = session
        self.geo_provider = geo_provider

    async def list_projects(self) -> AdminLabProjectsResponse:
        rows = await self.session.execute(
            select(Project, User.full_name)
            .join(User, User.id == Project.user_id)
            .order_by(Project.updated_at.desc(), Project.id)
            .limit(MAX_LAB_PROJECTS)
        )
        projects = list(rows.tuples())
        project_ids = [project.id for project, _ in projects]
        scopes: dict[UUID, str] = {}
        if project_ids:
            attributes = await self.session.scalars(
                select(IdeaAttribute)
                .where(
                    IdeaAttribute.project_id.in_(project_ids),
                    IdeaAttribute.attribute_type == AttributeType.GEOGRAPHIC_SCOPE,
                    IdeaAttribute.is_confirmed.is_(True),
                )
                .order_by(IdeaAttribute.position)
            )
            for attribute in attributes:
                scopes.setdefault(attribute.project_id, attribute.value)
        return AdminLabProjectsResponse(
            projects=[
                AdminLabProjectOption(
                    id=project.id,
                    title=project.title,
                    status=project.status,
                    owner_name=owner_name,
                    geographic_scope=scopes.get(project.id),
                )
                for project, owner_name in projects
            ]
        )

    async def metrics(self, days: int) -> LabMetricsResponse:
        today = datetime.now(UTC).date()
        start = today - timedelta(days=days - 1)
        rows = await self.session.execute(
            select(
                func.date(AIApiLog.created_at),
                func.count(AIApiLog.id),
                func.count(case((AIApiLog.status == AICallStatus.SUCCESS, 1))),
                func.count(case((AIApiLog.status == AICallStatus.ERROR, 1))),
                func.avg(AIApiLog.latency_ms),
                func.coalesce(func.sum(AIApiLog.input_tokens), 0),
                func.coalesce(func.sum(AIApiLog.output_tokens), 0),
            )
            .where(AIApiLog.created_at >= datetime.combine(start, time.min, tzinfo=UTC))
            .group_by(func.date(AIApiLog.created_at))
        )
        by_day = {
            day: (calls, success, errors, latency, tokens_in, tokens_out)
            for day, calls, success, errors, latency, tokens_in, tokens_out in rows.tuples()
        }
        points = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            calls, success, errors, latency, tokens_in, tokens_out = by_day.get(
                day, (0, 0, 0, None, 0, 0)
            )
            points.append(
                LabMetricPoint(
                    day=day,
                    calls=calls,
                    success_calls=success,
                    error_calls=errors,
                    avg_latency_ms=int(latency) if latency is not None else None,
                    input_tokens=int(tokens_in),
                    output_tokens=int(tokens_out),
                )
            )
        return LabMetricsResponse(days=days, points=points)

    @staticmethod
    def propositions() -> LabPropositionsResponse:
        def prop(symbol: str, name: str, meaning: str) -> PropositionDefinition:
            return PropositionDefinition(symbol=symbol, name=name, meaning=meaning)

        def build_table(
            rule_id: str,
            title: str,
            description: str,
            source: str,
            formula: str,
            inputs: list[PropositionDefinition],
            output: PropositionDefinition,
            evaluate: Callable[[dict[str, bool]], bool],
            note: str,
        ) -> PropositionRuleTable:
            symbols = [item.symbol for item in inputs]
            rows = []
            for combination in product((False, True), repeat=len(symbols)):
                values = dict(zip(symbols, combination, strict=True))
                rows.append(
                    TruthTableRow(
                        values=values,
                        result=evaluate(values),
                    )
                )
            return PropositionRuleTable(
                id=rule_id,
                title=title,
                description=description,
                source=source,
                formula=formula,
                inputs=inputs,
                output=output,
                rows=rows,
                note=note,
            )

        p1 = prop("P1", "Problema confirmado", "Existe al menos un problema confirmado.")
        p2 = prop("P2", "Solución confirmada", "Existe al menos una solución confirmada.")
        p3 = prop("P3", "Segmento confirmado", "Existe al menos un segmento de cliente confirmado.")
        p4 = prop("P4", "Sugerencia pendiente", "Hay una sugerencia de IA aún sin confirmar.")
        p5 = prop("P5", "Estructura lista", "El proyecto puede pasar al estado structured.")

        r1 = prop(
            "R1",
            "Estado investigable",
            "El estado es structured, researching o analyzed.",
        )
        r2 = prop("R2", "Sin investigación activa", "No hay otra investigación activa.")
        r3 = prop("R3", "Dentro del límite", "El usuario no alcanzó el límite de 24 horas.")
        r4 = prop("R4", "Puede iniciar investigación", "La solicitud pasa las reglas de inicio.")

        a1 = prop(
            "A1",
            "Proyecto investigado",
            "El estado es researching o analyzed.",
        )
        a2 = prop("A2", "Investigación completada", "La ejecución seleccionada está completed.")
        a3 = prop("A3", "Ejecución más reciente", "La ejecución seleccionada es la más reciente.")
        a4 = prop(
            "A4",
            "Hay hallazgos utilizables",
            "Existe un hallazgo del run o uno aportado por el usuario, no rechazado.",
        )
        a5 = prop("A5", "Puede analizar", "La ejecucion pasa las reglas de analisis.")

        e1 = prop(
            "E1",
            "Referencia válida",
            "Al menos una referencia corresponde a evidencia existente.",
        )
        e2 = prop(
            "E2",
            "Evidencia de soporte",
            "Al menos una evidencia válida tiene postura supports.",
        )
        e3 = prop("E3", "Hallazgo conservado", "El extractor guarda el hallazgo.")

        c1 = prop("C1", "IA propone alta", "El nivel propuesto para el hallazgo es high.")
        c2 = prop(
            "C2",
            "Dos dominios de soporte",
            "Al menos dos dominios independientes respaldan el hallazgo.",
        )
        c3 = prop(
            "C3",
            "Hay contradicción",
            "Existe evidencia con postura contradicts.",
        )
        c4 = prop("C4", "Puede ser alta", "La regla de confianza permite conservar high.")

        d1 = prop("D1", "Proyecto analizado", "El proyecto está en estado analyzed.")
        d2 = prop(
            "D2",
            "Investigación completada",
            "Existe una investigación completed para el proyecto.",
        )
        d3 = prop("D3", "Sin informe en curso", "No existe un informe generating.")
        d4 = prop("D4", "Puede generar informe", "La solicitud pasa las reglas del informe.")

        confidence_input = [c1, c2, c3]

        def confidence_allows_high(values: dict[str, bool]) -> bool:
            domains = {"dominio-a", "dominio-b"} if values["C2"] else {"dominio-a"}
            stances = {EvidenceStance.CONTRADICTS} if values["C3"] else set()
            proposed = Level.HIGH if values["C1"] else Level.MEDIUM
            return cap_confidence(proposed, domains, stances).level == Level.HIGH

        rules = [
            build_table(
                "structure",
                "Estructuración de una idea",
                "Reproduce check_structure: los tres atributos requeridos deben estar confirmados "
                "y no puede quedar una sugerencia de IA pendiente.",
                "backend/app/modules/projects/service.py - check_structure",
                "P5 ↔ P1 ∧ P2 ∧ P3 ∧ ¬P4",
                [p1, p2, p3, p4],
                p5,
                lambda values: values["P1"] and values["P2"] and values["P3"] and not values["P4"],
                "La tabla enumera las 16 combinaciones de los cuatro requisitos.",
            ),
            build_table(
                "research_start",
                "Inicio de investigación",
                "Resume las condiciones del servicio para crear una ejecución de investigación.",
                "backend/app/modules/research/service.py - ResearchService.start_run",
                "R4 ↔ R1 ∧ R2 ∧ R3",
                [r1, r2, r3],
                r4,
                lambda values: values["R1"] and values["R2"] and values["R3"],
                "La propiedad del proyecto y la autenticación se validan aparte; el límite "
                "diario es configurable.",
            ),
            build_table(
                "analysis_start",
                "Inicio del análisis",
                "Reproduce las comprobaciones para analizar una ejecución de investigación.",
                "backend/app/modules/analysis/service.py - AnalysisService.start",
                "A5 ↔ A1 ∧ A2 ∧ A3 ∧ A4",
                [a1, a2, a3, a4],
                a5,
                lambda values: values["A1"] and values["A2"] and values["A3"] and values["A4"],
                "La ejecución debe pertenecer al proyecto y ser la más reciente.",
            ),
            build_table(
                "finding_extraction",
                "Conservación de hallazgos",
                "El extractor descarta afirmaciones que no tengan evidencia válida "
                "que las respalde.",
                "backend/app/modules/findings/extraction.py - save_extraction",
                "E3 ↔ E1 ∧ E2",
                [e1, e2],
                e3,
                lambda values: values["E1"] and values["E2"],
                "Una referencia de soporte solo cuenta si corresponde a evidencia existente.",
            ),
            build_table(
                "confidence_cap",
                "Tope de confianza alta",
                "La confianza alta requiere respaldo independiente suficiente y ausencia de "
                "evidencia contradictoria.",
                "backend/app/modules/findings/confidence.py - cap_confidence",
                "C4 = C1 AND C2 AND NOT C3",
                confidence_input,
                c4,
                confidence_allows_high,
                "Cuando hay menos de dos dominios o existe contradicción, una propuesta alta "
                "se limita a media.",
            ),
            build_table(
                "report_start",
                "Generación de informes",
                "El informe solo inicia para un proyecto analizado, con investigación completada "
                "y sin otro informe en proceso.",
                "backend/app/modules/reports/service.py - ReportService.start",
                "D4 ↔ D1 ∧ D2 ∧ D3",
                [d1, d2, d3],
                d4,
                lambda values: values["D1"] and values["D2"] and values["D3"],
                "El servicio documenta la investigacion completada mas reciente.",
            ),
        ]
        return LabPropositionsResponse(
            rules=rules,
            peas=[
                PeasDimension(
                    symbol="P",
                    name="Performance",
                    description=(
                        "Conclusiones trazables hasta fuente y evidencia; precision de extraccion; "
                        "latencia y costo por llamada de IA."
                    ),
                ),
                PeasDimension(
                    symbol="E",
                    name="Environment",
                    description=(
                        "Proyectos y usuarios en PostgreSQL, proveedores de IA (Gemini/Ollama) "
                        "y servicios web publicos (OSM, Nominatim, Overpass)."
                    ),
                ),
                PeasDimension(
                    symbol="A",
                    name="Actuators",
                    description=(
                        "Endpoints que estructuran ideas, ejecutan investigaciones, extraen "
                        "hallazgos, responden chat y generan informes."
                    ),
                ),
                PeasDimension(
                    symbol="S",
                    name="Sensors",
                    description=(
                        "Entradas del usuario, respuestas estructuradas de IA, fuentes web "
                        "con fragmentos citados y registros de ai_api_logs."
                    ),
                ),
            ],
        )

    async def project_trace(self, project_id: UUID) -> ProjectTraceGraph:
        project = await self.session.get(Project, project_id)
        if project is None:
            raise ProjectNotFoundError()

        nodes: dict[str, TraceGraphNode] = {}
        edges: dict[tuple[str, str, str], TraceGraphEdge] = {}
        truncated = False
        root_id = f"project:{project.id}"

        def add_node(node_id: str, label: str, kind: str, **details: object) -> bool:
            nonlocal truncated
            if node_id in nodes:
                return True
            if len(nodes) >= MAX_TRACE_NODES:
                truncated = True
                return False
            nodes[node_id] = TraceGraphNode(
                id=node_id,
                label=label[:180],
                kind=kind,
                details={key: value for key, value in details.items() if value is not None},
            )
            return True

        def add_edge(source: str, target: str, relation: str) -> None:
            if source in nodes and target in nodes and len(edges) < MAX_TRACE_NODES * 3:
                key = (source, target, relation)
                edges.setdefault(
                    key, TraceGraphEdge(source=source, target=target, relation=relation)
                )

        add_node(
            root_id,
            project.title,
            "project",
            status=project.status.value,
            idea=project.raw_idea[:400],
        )

        attributes = await self.session.scalars(
            select(IdeaAttribute)
            .where(IdeaAttribute.project_id == project_id)
            .order_by(IdeaAttribute.attribute_type, IdeaAttribute.position)
            .limit(20)
        )
        for attribute in attributes:
            node_id = f"attribute:{attribute.id}"
            add_node(
                node_id,
                f"{attribute.attribute_type.value}: {attribute.value[:90]}",
                "attribute",
                confirmed=attribute.is_confirmed,
                origin=attribute.origin.value,
            )
            add_edge(root_id, node_id, "contiene atributo")

        runs = list(
            await self.session.scalars(
                select(ResearchRun)
                .where(ResearchRun.project_id == project_id)
                .order_by(ResearchRun.created_at.desc())
                .limit(MAX_TRACE_RUNS)
            )
        )
        run_ids = [run.id for run in runs]
        for run in runs:
            node_id = f"run:{run.id}"
            add_node(
                node_id,
                f"Investigación {run.status.value} · {run.progress_pct}%",
                "research_run",
                status=run.status.value,
                provider=run.ai_provider.value,
                model=run.ai_model,
            )
            add_edge(root_id, node_id, "tiene ejecución")

        queries: list[ResearchQuery] = []
        if run_ids:
            queries = list(
                await self.session.scalars(
                    select(ResearchQuery)
                    .where(ResearchQuery.run_id.in_(run_ids))
                    .order_by(ResearchQuery.created_at)
                    .limit(MAX_TRACE_QUERIES)
                )
            )
        query_ids = [query.id for query in queries]
        for query in queries:
            node_id = f"query:{query.id}"
            add_node(
                node_id,
                f"{query.category.value}: {query.question[:110]}",
                "query",
                status=query.status.value,
                answer=(query.response_text or "")[:300],
            )
            add_edge(f"run:{query.run_id}", node_id, "pregunta de investigación")

        if query_ids:
            source_links = await self.session.execute(
                select(ResearchQuerySource, Source)
                .join(Source, Source.id == ResearchQuerySource.source_id)
                .where(ResearchQuerySource.query_id.in_(query_ids))
                .order_by(ResearchQuerySource.rank)
                .limit(MAX_TRACE_SOURCES)
            )
            for link, source in source_links.tuples():
                source_node = f"source:{source.id}"
                add_node(
                    source_node,
                    source.title or source.domain,
                    "source",
                    domain=source.domain,
                    url=source.url,
                )
                add_edge(f"query:{link.query_id}", source_node, "consultó fuente")

        evidence_rows = await self.session.execute(
            select(Evidence, Source)
            .join(Source, Source.id == Evidence.source_id)
            .where(Evidence.project_id == project_id)
            .order_by(Evidence.created_at)
            .limit(MAX_TRACE_EVIDENCE)
        )
        for evidence, source in evidence_rows.tuples():
            source_node = f"source:{source.id}"
            add_node(
                source_node,
                source.title or source.domain,
                "source",
                domain=source.domain,
                url=source.url,
            )
            evidence_node = f"evidence:{evidence.id}"
            add_node(
                evidence_node,
                evidence.content[:120],
                "evidence",
                evidence_kind=evidence.evidence_kind.value,
                query_id=str(evidence.query_id) if evidence.query_id else None,
            )
            add_edge(source_node, evidence_node, "contiene evidencia")
            if evidence.query_id:
                add_edge(f"query:{evidence.query_id}", evidence_node, "cita en respuesta")

        findings = list(
            await self.session.scalars(
                select(Finding)
                .where(
                    Finding.project_id == project_id,
                    Finding.review_status != ReviewStatus.REJECTED,
                )
                .order_by(Finding.created_at)
                .limit(MAX_TRACE_FINDINGS)
            )
        )
        finding_ids = [finding.id for finding in findings]
        for finding in findings:
            finding_node = f"finding:{finding.id}"
            add_node(
                finding_node,
                finding.statement,
                "finding",
                category=finding.finding_type.value,
                confidence=finding.confidence_level.value,
                origin=finding.origin.value,
                review_status=finding.review_status.value,
            )
            add_edge(root_id, finding_node, "contiene hallazgo")

        if finding_ids:
            finding_evidence_rows = await self.session.scalars(
                select(FindingEvidence).where(FindingEvidence.finding_id.in_(finding_ids))
            )
            for link in finding_evidence_rows:
                add_edge(
                    f"evidence:{link.evidence_id}",
                    f"finding:{link.finding_id}",
                    f"evidencia {link.stance.value}",
                )

            finding_entities = await self.session.execute(
                select(FindingEntity, Entity)
                .join(Entity, Entity.id == FindingEntity.entity_id)
                .where(
                    FindingEntity.finding_id.in_(finding_ids),
                    Entity.project_id == project_id,
                )
            )
            for link, entity in finding_entities.tuples():
                entity_node = f"entity:{entity.id}"
                add_node(
                    entity_node,
                    entity.name,
                    "entity",
                    entity_type=entity.entity_type.value,
                    website=entity.website,
                )
                add_edge(f"finding:{link.finding_id}", entity_node, "menciona entidad")

        competitor_rows = await self.session.execute(
            select(Competitor, Entity)
            .join(Entity, Entity.id == Competitor.entity_id)
            .where(
                Competitor.project_id == project_id,
                Competitor.review_status != ReviewStatus.REJECTED,
            )
            .order_by(Entity.name)
            .limit(MAX_TRACE_ANALYSIS_ITEMS)
        )
        for competitor, entity in competitor_rows.tuples():
            entity_node = f"entity:{entity.id}"
            competitor_node = f"competitor:{competitor.id}"
            add_node(
                entity_node,
                entity.name,
                "entity",
                entity_type=entity.entity_type.value,
                website=entity.website,
            )
            add_node(
                competitor_node,
                f"Competidor: {entity.name}",
                "competitor",
                competitor_type=competitor.competitor_type.value,
                threat=competitor.threat_level.value,
                review_status=competitor.review_status.value,
            )
            add_edge(entity_node, competitor_node, "clasificado como")

        await self._add_analysis_nodes(
            project_id, root_id, finding_ids, nodes, edges, add_node, add_edge
        )
        await self._add_report_nodes(project_id, root_id, nodes, edges, add_node, add_edge)

        return ProjectTraceGraph(
            project_id=project.id,
            project_title=project.title,
            root_id=root_id,
            nodes=list(nodes.values()),
            edges=list(edges.values()),
            truncated=truncated,
        )

    async def trace_path(
        self, project_id: UUID, algorithm: TraceAlgorithm, target_node_id: str
    ) -> LabTracePathResponse:
        graph = await self.project_trace(project_id)
        nodes = {node.id: node for node in graph.nodes}
        if target_node_id not in nodes:
            return LabTracePathResponse(
                algorithm=algorithm,
                root_id=graph.root_id,
                target_node_id=target_node_id,
                path=[],
                visited_node_ids=[],
                expanded_count=0,
                found=False,
            )
        path_ids, visited_ids = find_trace_path(
            graph.root_id,
            target_node_id,
            [(edge.source, edge.target) for edge in graph.edges],
            algorithm,
        )
        return LabTracePathResponse(
            algorithm=algorithm,
            root_id=graph.root_id,
            target_node_id=target_node_id,
            path=[nodes[node_id] for node_id in path_ids if node_id in nodes],
            visited_node_ids=visited_ids,
            expanded_count=len(visited_ids),
            found=bool(path_ids),
        )

    async def places(
        self, project_id: UUID, latitude: float, longitude: float, radius_m: int, keyword: str
    ) -> LabPlaceSearchResponse:
        project = await self._get_project(project_id)
        results = await self.geo_provider.find_places(latitude, longitude, radius_m, "all", keyword)
        return LabPlaceSearchResponse(
            project_id=project.id,
            latitude=latitude,
            longitude=longitude,
            radius_m=radius_m,
            keyword=keyword,
            places=results,
        )

    async def route(self, project_id: UUID, request: LabRouteRequest) -> LabRouteResponse:
        project = await self._get_project(project_id)
        current_places = await self.geo_provider.find_places(
            request.latitude,
            request.longitude,
            request.radius_m,
            "all",
            request.keyword,
        )
        by_id = {f"{place.osm_type}:{place.osm_id}": place for place in current_places}
        if any(place_id not in by_id for place_id in request.selected_place_ids):
            raise ConflictError(
                "Los lugares seleccionados cambiaron. Vuelve a buscar y selecciona "
                "los resultados actuales.",
                code="geo_places_changed",
            )
        selected = [by_id[place_id] for place_id in request.selected_place_ids]
        algorithm_result = optimize_project_place_route(
            request.latitude,
            request.longitude,
            [
                {
                    "place_id": f"{place.osm_type}:{place.osm_id}",
                    "name": place.name,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                }
                for place in selected
            ],
            request.algorithm,
            request.seed,
            request.population_size,
            request.generations,
        )
        selected_by_id = {f"{place.osm_type}:{place.osm_id}": place for place in selected}
        stops = [
            LabRouteStop(
                osm_type=selected_by_id[leg["place_id"]].osm_type,
                osm_id=selected_by_id[leg["place_id"]].osm_id,
                name=leg["name"],
                latitude=selected_by_id[leg["place_id"]].latitude,
                longitude=selected_by_id[leg["place_id"]].longitude,
                distance_from_previous_km=leg["distance_from_previous_km"],
            )
            for leg in algorithm_result["legs"]
            if leg["place_id"] != "project-location"
        ]
        return LabRouteResponse(
            project_id=project.id,
            keyword=request.keyword,
            algorithm=request.algorithm,
            depot_latitude=request.latitude,
            depot_longitude=request.longitude,
            stops=stops,
            return_distance_km=algorithm_result["legs"][-1]["distance_from_previous_km"],
            total_distance_km=algorithm_result["total_distance_km"],
            optimal_reference_km=algorithm_result["optimal_reference_km"],
            evaluations=algorithm_result["evaluations"],
            history_km=algorithm_result["history_km"],
        )

    async def budget_plan(
        self, project_id: UUID, request: HypothesisBudgetRequest
    ) -> HypothesisBudgetResponse:
        project = await self._get_project(project_id)
        ids = [item.hypothesis_id for item in request.items]
        rows = await self.session.scalars(
            select(ValidationHypothesis).where(
                ValidationHypothesis.project_id == project.id,
                ValidationHypothesis.id.in_(ids),
                ValidationHypothesis.review_status != ReviewStatus.REJECTED,
            )
        )
        hypotheses = {hypothesis.id: hypothesis for hypothesis in rows}
        if set(hypotheses) != set(ids):
            raise ConflictError(
                "Una o más hipótesis ya no pertenecen al proyecto o fueron rechazadas.",
                code="lab_hypotheses_changed",
            )
        input_by_id = {item.hypothesis_id: item for item in request.items}
        items = [
            {
                "id": str(hypothesis.id),
                "statement": hypothesis.statement,
                "priority": hypothesis.priority.value,
                "estimated_cost": input_by_id[hypothesis.id].estimated_cost,
                "expected_value": input_by_id[hypothesis.id].expected_value,
            }
            for hypothesis in hypotheses.values()
        ]
        result = optimize_hypothesis_budget(items, request.budget, request.algorithm)
        return HypothesisBudgetResponse(
            project_id=project.id,
            algorithm=request.algorithm,
            budget=request.budget,
            selected=[
                HypothesisBudgetSelection(
                    hypothesis_id=UUID(items[index]["id"]),
                    statement=items[index]["statement"],
                    priority=items[index]["priority"],
                    estimated_cost=items[index]["estimated_cost"],
                    expected_value=items[index]["expected_value"],
                )
                for index in result["selected_indices"]
            ],
            total_cost=result["total_cost"],
            total_value=result["total_value"],
            exact_reference_value=result["exact_reference_value"],
            evaluations=result["evaluations"],
        )

    async def schedule(
        self, project_id: UUID, request: ValidationScheduleRequest
    ) -> ValidationScheduleResponse:
        project = await self._get_project(project_id)
        ids = [task.hypothesis_id for task in request.tasks]
        rows = await self.session.scalars(
            select(ValidationHypothesis).where(
                ValidationHypothesis.project_id == project.id,
                ValidationHypothesis.id.in_(ids),
                ValidationHypothesis.review_status != ReviewStatus.REJECTED,
            )
        )
        hypotheses = {hypothesis.id: hypothesis for hypothesis in rows}
        if set(hypotheses) != set(ids):
            raise ConflictError(
                "Una o más hipótesis ya no pertenecen al proyecto o fueron rechazadas.",
                code="lab_hypotheses_changed",
            )
        request_by_id = {task.hypothesis_id: task for task in request.tasks}
        tasks = [
            {
                "id": str(hypothesis.id),
                "statement": hypothesis.statement,
                "priority": hypothesis.priority.value,
                "preferred_shift": request_by_id[hypothesis.id].preferred_shift,
            }
            for hypothesis in hypotheses.values()
        ]
        result = schedule_validation_tasks(tasks, request.capacity_per_shift)
        assignments = [
            ValidationScheduleAssignment(
                hypothesis_id=UUID(task["id"]),
                statement=task["statement"],
                priority=task["priority"],
                preferred_shift=task["preferred_shift"],
                assigned_shift=assigned_shift,
            )
            for task, assigned_shift in zip(tasks, result["assignments"], strict=True)
        ]
        return ValidationScheduleResponse(
            project_id=project.id,
            assignments=assignments,
            satisfied_preferences=result["satisfied_preferences"],
            priority_weighted_score=result["priority_weighted_score"],
            evaluations=result["evaluations"],
        )

    async def _get_project(self, project_id: UUID) -> Project:
        project = await self.session.get(Project, project_id)
        if project is None:
            raise ProjectNotFoundError()
        return project

    async def _add_analysis_nodes(
        self, project_id, root_id, finding_ids, nodes, edges, add_node, add_edge
    ) -> None:
        definitions = (
            (Opportunity, OpportunityFinding, "opportunity_id", "opportunity", "title"),
            (Risk, RiskFinding, "risk_id", "risk", "title"),
            (
                ValidationHypothesis,
                HypothesisFinding,
                "hypothesis_id",
                "hypothesis",
                "statement",
            ),
            (MissingInformation, None, None, "missing_information", "question"),
        )
        for model, link_model, item_field, kind, label_field in definitions:
            items = list(
                await self.session.scalars(
                    select(model)
                    .where(
                        model.project_id == project_id,
                        model.review_status != ReviewStatus.REJECTED,
                    )
                    .order_by(model.created_at.desc())
                    .limit(MAX_TRACE_ANALYSIS_ITEMS)
                )
            )
            for item in items:
                node_id = f"{kind}:{item.id}"
                details = {
                    "origin": item.origin.value,
                    "review_status": item.review_status.value,
                    "priority": getattr(item, "priority", None),
                    "validation_method": getattr(item, "validation_method", None),
                    "success_criteria": getattr(item, "success_criteria", None),
                }
                add_node(node_id, getattr(item, label_field), kind, **details)
                add_edge(root_id, node_id, "contiene elemento de análisis")
            if link_model is not None and item_field and finding_ids and items:
                links = await self.session.execute(
                    select(getattr(link_model, item_field), link_model.finding_id)
                    .join(model, getattr(link_model, item_field) == model.id)
                    .where(model.project_id == project_id, link_model.finding_id.in_(finding_ids))
                )
                for item_id, finding_id in links.tuples():
                    add_edge(
                        f"finding:{finding_id}",
                        f"{kind}:{item_id}",
                        "sustenta interpretación",
                    )

    async def _add_report_nodes(
        self, project_id, root_id, nodes, edges, add_node, add_edge
    ) -> None:
        reports = list(
            await self.session.scalars(
                select(Report)
                .where(Report.project_id == project_id)
                .order_by(Report.version.desc())
                .limit(10)
            )
        )
        for report in reports:
            report_node = f"report:{report.id}"
            add_node(
                report_node,
                f"Informe v{report.version}: {report.title}",
                "report",
                status=report.status.value,
                provider=report.ai_provider.value,
                model=report.ai_model,
            )
            add_edge(root_id, report_node, "genera informe")
            sections = await self.session.scalars(
                select(ReportSection)
                .where(ReportSection.report_id == report.id)
                .order_by(ReportSection.position)
                .limit(10)
            )
            for section in sections:
                section_node = f"report-section:{section.id}"
                add_node(
                    section_node,
                    section.title,
                    "report_section",
                    section_type=section.section_type.value,
                    content=section.content[:250],
                )
                add_edge(report_node, section_node, "contiene sección")
