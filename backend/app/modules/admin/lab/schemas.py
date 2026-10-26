from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import Priority
from app.modules.geo.schemas import GeoBusiness
from app.modules.projects.models import ProjectStatus

TraceAlgorithm = Literal["bfs", "dfs"]
RouteAlgorithm = Literal["hill_climbing", "genetic", "exact"]
BudgetAlgorithm = Literal["hill_climbing", "exact"]
ShiftName = Literal["matutino", "vespertino", "nocturno"]


class AdminLabProjectOption(BaseModel):
    id: UUID
    title: str
    status: ProjectStatus
    owner_name: str
    geographic_scope: str | None


class AdminLabProjectsResponse(BaseModel):
    projects: list[AdminLabProjectOption]


class TraceGraphNode(BaseModel):
    id: str
    label: str
    kind: Literal[
        "project",
        "attribute",
        "research_run",
        "query",
        "source",
        "evidence",
        "finding",
        "entity",
        "competitor",
        "opportunity",
        "risk",
        "hypothesis",
        "missing_information",
        "report",
        "report_section",
    ]
    details: dict[str, Any] = Field(default_factory=dict)


class TraceGraphEdge(BaseModel):
    source: str
    target: str
    relation: str


class ProjectTraceGraph(BaseModel):
    project_id: UUID
    project_title: str
    root_id: str
    nodes: list[TraceGraphNode]
    edges: list[TraceGraphEdge]
    truncated: bool


class LabTracePathRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    algorithm: TraceAlgorithm
    target_node_id: str = Field(min_length=1, max_length=120)


class LabTracePathResponse(BaseModel):
    algorithm: TraceAlgorithm
    root_id: str
    target_node_id: str
    path: list[TraceGraphNode]
    visited_node_ids: list[str]
    expanded_count: int
    found: bool


class LabPlaceSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)


class LabPlaceSearchResponse(BaseModel):
    project_id: UUID
    latitude: float
    longitude: float
    radius_m: int
    keyword: str
    places: list[GeoBusiness]
    attribution: str = "© OpenStreetMap contributors"
    note: str = (
        "Los lugares son resultados actuales de OpenStreetMap vinculados a la exploración "
        "de este proyecto; no confirman competencia."
    )


class LabRouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)
    selected_place_ids: list[str] = Field(min_length=2, max_length=8)
    algorithm: RouteAlgorithm = "hill_climbing"
    seed: int = Field(default=42, ge=0, le=2_147_483_647)
    population_size: int = Field(default=24, ge=4, le=60)
    generations: int = Field(default=30, ge=1, le=80)

    @model_validator(mode="after")
    def validate_unique_places(self) -> "LabRouteRequest":
        if len(set(self.selected_place_ids)) != len(self.selected_place_ids):
            raise ValueError("No repitas lugares en la ruta.")
        return self


class LabRouteStop(BaseModel):
    osm_type: Literal["node", "way", "relation"]
    osm_id: int
    name: str
    latitude: float
    longitude: float
    distance_from_previous_km: float


class LabRouteResponse(BaseModel):
    project_id: UUID
    keyword: str
    algorithm: RouteAlgorithm
    depot_latitude: float
    depot_longitude: float
    stops: list[LabRouteStop]
    return_distance_km: float
    total_distance_km: float
    optimal_reference_km: float
    evaluations: int
    history_km: list[float]
    distance_note: str = (
        "Distancia euclidiana aproximada en plano local; no representa distancia ni tiempo "
        "por calles."
    )
    persisted: Literal[False] = False


class HypothesisBudgetItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hypothesis_id: UUID
    estimated_cost: int = Field(ge=0, le=1_000_000)
    expected_value: int = Field(ge=0, le=100)


class HypothesisBudgetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    budget: int = Field(ge=0, le=10_000_000)
    algorithm: BudgetAlgorithm = "hill_climbing"
    items: list[HypothesisBudgetItemInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def validate_unique_hypotheses(self) -> "HypothesisBudgetRequest":
        ids = [item.hypothesis_id for item in self.items]
        if len(set(ids)) != len(ids):
            raise ValueError("No repitas hipótesis en el plan de presupuesto.")
        return self


class HypothesisBudgetSelection(BaseModel):
    hypothesis_id: UUID
    statement: str
    priority: Priority
    estimated_cost: int
    expected_value: int


class HypothesisBudgetResponse(BaseModel):
    project_id: UUID
    algorithm: BudgetAlgorithm
    budget: int
    selected: list[HypothesisBudgetSelection]
    total_cost: int
    total_value: int
    exact_reference_value: int
    evaluations: int
    persisted: Literal[False] = False


class ValidationScheduleTaskInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hypothesis_id: UUID
    preferred_shift: ShiftName


class ValidationScheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capacity_per_shift: int = Field(default=4, ge=1, le=8)
    tasks: list[ValidationScheduleTaskInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def validate_tasks(self) -> "ValidationScheduleRequest":
        ids = [task.hypothesis_id for task in self.tasks]
        if len(set(ids)) != len(ids):
            raise ValueError("No repitas hipótesis en el calendario.")
        if len(self.tasks) > self.capacity_per_shift * 3:
            raise ValueError("La capacidad total por turnos no alcanza para todas las hipótesis.")
        return self


class ValidationScheduleAssignment(BaseModel):
    hypothesis_id: UUID
    statement: str
    priority: Priority
    preferred_shift: ShiftName
    assigned_shift: ShiftName


class ValidationScheduleResponse(BaseModel):
    project_id: UUID
    assignments: list[ValidationScheduleAssignment]
    satisfied_preferences: int
    priority_weighted_score: int
    evaluations: int
    persisted: Literal[False] = False


class LabMetricPoint(BaseModel):
    day: date
    calls: int
    success_calls: int
    error_calls: int
    avg_latency_ms: int | None
    input_tokens: int
    output_tokens: int


class LabMetricsResponse(BaseModel):
    days: int
    points: list[LabMetricPoint]


class PropositionDefinition(BaseModel):
    symbol: str
    name: str
    meaning: str


class TruthTableRow(BaseModel):
    values: dict[str, bool]
    result: bool


class PropositionRuleTable(BaseModel):
    id: str
    title: str
    description: str
    source: str
    formula: str
    inputs: list[PropositionDefinition]
    output: PropositionDefinition
    rows: list[TruthTableRow]
    note: str


class PeasDimension(BaseModel):
    symbol: str
    name: str
    description: str


class LabPropositionsResponse(BaseModel):
    rules: list[PropositionRuleTable]
    peas: list[PeasDimension]
