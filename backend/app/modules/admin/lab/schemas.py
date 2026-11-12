"""Valida contratos de entrada/salida. Area: laboratorio administrativo."""

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import Priority
from app.modules.geo.schemas import GeoBusiness
from app.modules.projects.models import ProjectStatus

RouteAlgorithm = Literal["exact", "nearest_neighbor"]
BudgetAlgorithm = Literal["exact", "greedy_ratio"]


class AdminLabProjectOption(BaseModel):
    """Representa administrador lab proyecto option."""

    id: UUID
    title: str
    status: ProjectStatus
    owner_name: str
    geographic_scope: str | None


class AdminLabProjectsResponse(BaseModel):
    """Representa administrador lab proyectos respuesta."""

    projects: list[AdminLabProjectOption]


class TraceGraphNode(BaseModel):
    """Representa trace graph node."""

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
    """Representa trace graph edge."""

    source: str
    target: str
    relation: str


class ProjectTraceGraph(BaseModel):
    """Representa proyecto trace graph."""

    project_id: UUID
    project_title: str
    root_id: str
    nodes: list[TraceGraphNode]
    edges: list[TraceGraphEdge]
    truncated: bool


class LabTracePathRequest(BaseModel):
    """Representa lab trace path solicitud."""

    model_config = ConfigDict(extra="forbid")

    target_node_id: str = Field(min_length=1, max_length=120)


class LabTracePathResponse(BaseModel):
    """Representa lab trace path respuesta."""

    root_id: str
    target_node_id: str
    path: list[TraceGraphNode]
    visited_node_ids: list[str]
    expanded_count: int
    found: bool


class LabPlaceSearchRequest(BaseModel):
    """Representa lab lugar busqueda solicitud."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)


class LabPlaceSearchResponse(BaseModel):
    """Representa lab lugar busqueda respuesta."""

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
    """Representa lab ruta solicitud."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)
    selected_place_ids: list[str] = Field(min_length=2, max_length=8)
    algorithm: RouteAlgorithm = "exact"

    @model_validator(mode="after")
    def validate_unique_places(self) -> "LabRouteRequest":
        """Valida unique places en laboratorio admin."""
        # Rama condicional: evalua len(set(self.selected_place_ids)) !=
        # len(self.selected_place_ids).
        if len(set(self.selected_place_ids)) != len(self.selected_place_ids):
            raise ValueError("No repitas lugares en la ruta.")
        return self


class LabRouteStop(BaseModel):
    """Representa lab ruta stop."""

    osm_type: Literal["node", "way", "relation"]
    osm_id: int
    name: str
    latitude: float
    longitude: float
    distance_from_previous_km: float


class LabRouteResponse(BaseModel):
    """Representa lab ruta respuesta."""

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
        "Distancia en línea recta sobre la superficie de la Tierra (Haversine). No es la "
        "distancia por calles ni incluye tiempo de traslado."
    )
    persisted: Literal[False] = False


class HypothesisBudgetItemInput(BaseModel):
    """Contrato de datos para hipotesis presupuesto elemento entrada."""

    model_config = ConfigDict(extra="forbid")

    hypothesis_id: UUID
    estimated_cost: int = Field(ge=0, le=1_000_000)
    expected_value: int = Field(ge=0, le=100)


class HypothesisBudgetRequest(BaseModel):
    """Representa hipotesis presupuesto solicitud."""

    model_config = ConfigDict(extra="forbid")

    budget: int = Field(ge=0, le=10_000_000)
    algorithm: BudgetAlgorithm = "exact"
    items: list[HypothesisBudgetItemInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def validate_unique_hypotheses(self) -> "HypothesisBudgetRequest":
        """Valida unique hypotheses en laboratorio admin."""
        ids = [item.hypothesis_id for item in self.items]
        # Rama condicional: se cumple len(set(ids)) != len(ids).
        if len(set(ids)) != len(ids):
            raise ValueError("No repitas hipótesis en el plan de presupuesto.")
        return self


class HypothesisBudgetSelection(BaseModel):
    """Representa hipotesis presupuesto selection."""

    hypothesis_id: UUID
    statement: str
    priority: Priority
    estimated_cost: int
    expected_value: int


class HypothesisBudgetResponse(BaseModel):
    """Representa hipotesis presupuesto respuesta."""

    project_id: UUID
    algorithm: BudgetAlgorithm
    budget: int
    selected: list[HypothesisBudgetSelection]
    total_cost: int
    total_value: int
    exact_reference_value: int
    evaluations: int
    persisted: Literal[False] = False


class LabMetricPoint(BaseModel):
    """Representa lab metric point."""

    day: date
    calls: int
    success_calls: int
    error_calls: int
    avg_latency_ms: int | None
    input_tokens: int
    output_tokens: int


class LabMetricsResponse(BaseModel):
    """Representa lab metrics respuesta."""

    days: int
    points: list[LabMetricPoint]


class PropositionDefinition(BaseModel):
    """Representa proposition definition."""

    symbol: str
    name: str
    meaning: str


class TruthTableRow(BaseModel):
    """Representa truth table row."""

    values: dict[str, bool]
    result: bool


class PropositionRuleTable(BaseModel):
    """Representa proposition rule table."""

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
    """Representa peas dimension."""

    symbol: str
    name: str
    description: str


class LabPropositionsResponse(BaseModel):
    """Representa lab propositions respuesta."""

    rules: list[PropositionRuleTable]
    peas: list[PeasDimension]


class LabLearningReadiness(BaseModel):
    """Cuántos hallazgos de la IA ya revisó una persona y si alcanzan para entrenar el árbol."""

    positive_examples: int
    negative_examples: int
    min_per_class: int
    trainable: bool
    message: str


class LabLearningModel(BaseModel):
    """Árbol entrenado y su evaluación en validación y en prueba."""

    max_depth: int
    train_size: int
    validation_metrics: dict[str, Any]
    test_metrics: dict[str, Any]
    rules: list[str]


class LabLearningResponse(BaseModel):
    """Estado del aprendizaje del motor. El árbol todavía no cambia lo que ve la persona."""

    target: Literal["finding_acceptance"]
    features: list[str]
    readiness: LabLearningReadiness
    model: LabLearningModel | None
    note: str = (
        "El árbol aprende solo de hallazgos generados por la IA y revisados por una persona. "
        "Mientras no haya suficientes ejemplos de ambas clases, no se entrena ni se usa."
    )
