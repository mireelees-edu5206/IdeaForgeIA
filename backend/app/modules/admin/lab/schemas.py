"""Define los contratos de entrada y salida del laboratorio. Area: laboratorio administrativo.

ARCHIVO: backend/app/modules/admin/lab/schemas.py

¿Qué es?
Los modelos Pydantic que describen cada petición y respuesta del laboratorio: proyectos disponibles,
grafo de trazabilidad, lugares, rutas, presupuesto, métricas, proposiciones y aprendizaje.

¿Para qué sirve?
Para validar lo que llega del navegador (coordenadas, radios, listas sin repetir) y para dar
forma fija a lo que sale, de modo que la documentación automática (/docs) sea exacta.

¿Quién lo usa?
`router.py` (entrada y salida de cada endpoint) y `service.py` (construye las respuestas).

Importante: los modelos de entrada usan `extra="forbid"`: un campo desconocido responde 422.
"""

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
    """Proyecto del laboratorio: id, título, etapa, dueño y zona geográfica confirmada."""

    id: UUID
    title: str
    status: ProjectStatus
    owner_name: str
    geographic_scope: str | None


class AdminLabProjectsResponse(BaseModel):
    """Lista de proyectos que el laboratorio puede usar."""

    projects: list[AdminLabProjectOption]


class TraceGraphNode(BaseModel):
    """Nodo del grafo de trazabilidad: id, etiqueta, tipo (`kind`) y detalles opcionales."""

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
    """Conexión dirigida entre dos nodos del grafo, con su relación en texto."""

    source: str
    target: str
    relation: str


class ProjectTraceGraph(BaseModel):
    """Grafo completo de trazabilidad de un proyecto. `truncated` indica que se alcanzó un tope."""

    project_id: UUID
    project_title: str
    root_id: str
    nodes: list[TraceGraphNode]
    edges: list[TraceGraphEdge]
    truncated: bool


class LabTracePathRequest(BaseModel):
    """Solicitud para buscar el camino desde la raíz del grafo hasta un nodo destino."""

    model_config = ConfigDict(extra="forbid")

    target_node_id: str = Field(min_length=1, max_length=120)


class LabTracePathResponse(BaseModel):
    """Resultado del BFS: camino, nodos revisados y si se encontró el destino (`found`)."""

    root_id: str
    target_node_id: str
    path: list[TraceGraphNode]
    visited_node_ids: list[str]
    expanded_count: int
    found: bool


class LabPlaceSearchRequest(BaseModel):
    """Búsqueda de lugares: coordenadas, radio (100 a 5000 m, por defecto 1000) y palabra clave."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)


class LabPlaceSearchResponse(BaseModel):
    """Lugares de OpenStreetMap, con atribución y la advertencia de que no prueban competencia."""

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
    """Solicitud de ruta: zona, palabra clave, de 2 a 8 lugares distintos y el algoritmo."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: int = Field(ge=100, le=5000)
    keyword: str = Field(min_length=2, max_length=80)
    selected_place_ids: list[str] = Field(min_length=2, max_length=8)
    algorithm: RouteAlgorithm = "exact"

    @model_validator(mode="after")
    def validate_unique_places(self) -> "LabRouteRequest":
        """Rechaza la ruta si el mismo lugar aparece dos veces en `selected_place_ids`."""
        # Rama condicional: evalua len(set(self.selected_place_ids)) !=
        # len(self.selected_place_ids).
        if len(set(self.selected_place_ids)) != len(self.selected_place_ids):
            raise ValueError("No repitas lugares en la ruta.")
        return self


class LabRouteStop(BaseModel):
    """Parada de la ruta, con su distancia en línea recta desde la parada anterior."""

    osm_type: Literal["node", "way", "relation"]
    osm_id: int
    name: str
    latitude: float
    longitude: float
    distance_from_previous_km: float


class LabRouteResponse(BaseModel):
    """Ruta calculada. `persisted` es siempre falso: el laboratorio no guarda resultados."""

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
    """Hipótesis con su costo estimado (0 a 1 000 000) y su valor esperado (0 a 100)."""

    model_config = ConfigDict(extra="forbid")

    hypothesis_id: UUID
    estimated_cost: int = Field(ge=0, le=1_000_000)
    expected_value: int = Field(ge=0, le=100)


class HypothesisBudgetRequest(BaseModel):
    """Plan de presupuesto: tope, algoritmo y de 1 a 16 hipótesis sin repetir."""

    model_config = ConfigDict(extra="forbid")

    budget: int = Field(ge=0, le=10_000_000)
    algorithm: BudgetAlgorithm = "exact"
    items: list[HypothesisBudgetItemInput] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def validate_unique_hypotheses(self) -> "HypothesisBudgetRequest":
        """Rechaza el plan si la misma hipótesis aparece dos veces en `items`."""
        ids = [item.hypothesis_id for item in self.items]
        # Rama condicional: se cumple len(set(ids)) != len(ids).
        if len(set(ids)) != len(ids):
            raise ValueError("No repitas hipótesis en el plan de presupuesto.")
        return self


class HypothesisBudgetSelection(BaseModel):
    """Hipótesis elegida dentro del plan de presupuesto."""

    hypothesis_id: UUID
    statement: str
    priority: Priority
    estimated_cost: int
    expected_value: int


class HypothesisBudgetResponse(BaseModel):
    """Plan de presupuesto calculado. `persisted` es siempre falso: no se guarda."""

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
    """Métricas de un día: llamadas, éxitos, errores, latencia promedio y tokens."""

    day: date
    calls: int
    success_calls: int
    error_calls: int
    avg_latency_ms: int | None
    input_tokens: int
    output_tokens: int


class LabMetricsResponse(BaseModel):
    """Serie diaria de métricas de la IA, con un punto por cada día del periodo."""

    days: int
    points: list[LabMetricPoint]


class PropositionDefinition(BaseModel):
    """Una proposición lógica: símbolo (P1, R2...), nombre y su significado en lenguaje claro."""

    symbol: str
    name: str
    meaning: str


class TruthTableRow(BaseModel):
    """Una fila de la tabla de verdad: el valor de cada entrada y el resultado de la regla."""

    values: dict[str, bool]
    result: bool


class PropositionRuleTable(BaseModel):
    """Regla del sistema como tabla de verdad, con la función del código que la aplica."""

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
    """Una dimensión del marco PEAS del agente: medida, entorno, actuadores o sensores."""

    symbol: str
    name: str
    description: str


class LabPropositionsResponse(BaseModel):
    """Reglas en forma de tabla de verdad y marco PEAS del sistema."""

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
