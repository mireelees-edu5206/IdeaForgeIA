/**
 * ARCHIVO: admin/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de todo el área de administración: las cuentas, las métricas de IA,
 * el grafo de trazabilidad, los cálculos del laboratorio (rutas, presupuesto, calendario),
 * y las reglas de lógica. Describen la forma de los datos, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo o un valor que no existe
 * (por ejemplo, un algoritmo con otro nombre). Así un error se ve antes de ejecutar la app.
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts, AdminPage.tsx y las pantallas del laboratorio.
 *
 * Nota: los nombres de algoritmos (TraceAlgorithm, RouteAlgorithm, BudgetAlgorithm) deben coincidir
 * con los del backend (backend/app/modules/admin/lab/schemas.py). Si cambias uno, cambia el otro.
 */

/* Rol de la cuenta (administrador o investigador), de la carpeta de autenticación. */
import type { UserRole } from "../auth/types";
/* Ficha de un negocio encontrado en el mapa, de la carpeta de geografía. */
import type { GeoBusiness } from "../geo/types";
/* Estado de un proyecto (borrador, analizado...), de la carpeta de proyectos. */
import type { ProjectStatus } from "../projects/types";
/* Nombre del proveedor de IA (Gemini, Ollama...), de la carpeta de investigación. */
import type { AIProviderName } from "../research/types";

/**
 * AIOperation es para qué se usó la IA en una llamada: estructurar la idea, planear la investigación,
 * buscar en la web, extraer hallazgos, analizar, generar un informe o responder en el chat.
 */
/** Describe el contrato aioperation utilizado por admin. */
export type AIOperation =
  | "idea_structuring"
  | "research_planning"
  | "grounded_search"
  | "extraction"
  | "analysis"
  | "report_generation"
  | "chat";

/** AICallStatus es el resultado de una llamada a la IA: "success" (bien) o "error" (falló). */
/** Describe el contrato aicall status utilizado por admin. */
export type AICallStatus = "success" | "error";

/**
 * ProviderMetrics son los totales de un proveedor de IA (por ejemplo Gemini):
 * - total_calls, success_calls y error_calls: cuántas llamadas hubo y cuántas salieron bien o mal.
 * - avg_latency_ms: tiempo promedio de respuesta en milisegundos (puede ser null si no hay datos).
 * - input_tokens y output_tokens: cuántos "trozos de texto" se enviaron y se recibieron.
 * - search_queries: cuántas búsquedas en la web hizo.
 * - estimated_cost_usd: costo estimado en dólares, guardado como texto para no perder decimales.
 */
/** Describe el contrato provider metrics utilizado por admin. */
export interface ProviderMetrics {
  provider: AIProviderName;
  total_calls: number;
  success_calls: number;
  error_calls: number;
  avg_latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  search_queries: number;
  estimated_cost_usd: string;
}

/**
 * AdminAILog es una línea de la bitácora de llamadas a la IA. Guarda quién la hizo (correo y proyecto),
 * con qué proveedor y modelo, para qué operación, si salió bien, el código de error si falló,
 * cuántos tokens usó, cuántas búsquedas hizo, cuánto tardó, su costo y cuándo fue.
 * Los campos que pueden faltar (null) son los que el sistema no siempre sabe.
 */
/** Describe el contrato admin ailog utilizado por admin. */
export interface AdminAILog {
  id: string;
  user_email: string | null;
  project_title: string | null;
  provider: AIProviderName;
  model: string;
  operation: AIOperation;
  prompt_version: string | null;
  status: AICallStatus;
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  search_queries_count: number;
  latency_ms: number | null;
  estimated_cost_usd: string | null;
  created_at: string;
}

/**
 * AdminOverview es el resumen general de la plataforma que se ve en el panel de admin:
 * totales de cuentas, proyectos, investigaciones, hallazgos, informes y llamadas a la IA;
 * el desglose por proveedor (ai_by_provider) y las últimas llamadas (recent_ai_logs).
 * projects_by_status cuenta cuántos proyectos hay en cada estado.
 */
/** Describe el contrato admin overview utilizado por admin. */
export interface AdminOverview {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_projects: number;
  projects_by_status: Record<ProjectStatus, number>;
  total_research_runs: number;
  completed_research_runs: number;
  failed_research_runs: number;
  total_findings: number;
  total_reports: number;
  total_ai_calls: number;
  ai_by_provider: ProviderMetrics[];
  recent_ai_logs: AdminAILog[];
}

/**
 * AdminUser es una cuenta en la lista de administración:
 * su nombre, correo, rol, si está activa (is_active), cuántos proyectos e investigaciones tiene,
 * cuándo fue su último inicio de sesión (puede ser null si nunca entró) y cuándo se registró.
 */
/** Describe el contrato admin user utilizado por admin. */
export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  project_count: number;
  research_run_count: number;
  last_login_at: string | null;
  created_at: string;
}

/**
 * AdminUserUpdate son los campos que se pueden cambiar de una cuenta: el rol y si está activa.
 * El "?" significa que cada campo es opcional: se manda solo el que cambia.
 */
/** Describe el contrato admin user update utilizado por admin. */
export interface AdminUserUpdate {
  role?: UserRole;
  is_active?: boolean;
}

/**
 * TraceAlgorithm son los métodos de búsqueda del camino en el grafo:
 * "bfs" (anchura), "dfs" (profundidad), "greedy" (voraz) y "astar" (A*).
 */
/** Describe el contrato trace algorithm utilizado por admin. */
export type TraceAlgorithm = "bfs" | "dfs" | "greedy" | "astar";
/**
 * RouteAlgorithm son los métodos para ordenar la ruta de visita: "exact" (óptimo exacto, máximo 8 lugares),
 * "nearest_neighbor" (vecino más cercano), "hill_climbing" (búsqueda local por intercambio),
 * "two_opt" (búsqueda local 2-opt) y "genetic" (algoritmo genético).
 */
/** Describe el contrato route algorithm utilizado por admin. */
export type RouteAlgorithm = "exact" | "nearest_neighbor" | "hill_climbing" | "two_opt" | "genetic";
/**
 * BudgetAlgorithm son los métodos para elegir hipótesis con presupuesto: "exact" (óptimo exacto),
 * "hill_climbing" (búsqueda local) y "greedy_ratio" (heurística voraz por valor y costo).
 */
/** Describe el contrato budget algorithm utilizado por admin. */
export type BudgetAlgorithm = "hill_climbing" | "exact" | "greedy_ratio";
/** ValidationShift es un turno para validar: "matutino" (mañana), "vespertino" (tarde) o "nocturno" (noche). */
/** Describe el contrato validation shift utilizado por admin. */
export type ValidationShift = "matutino" | "vespertino" | "nocturno";

/**
 * AdminLabProject es un proyecto que aparece en el selector del laboratorio: su id, título, estado,
 * nombre del dueño y la zona geográfica (puede ser null si no tiene).
 */
/** Describe el contrato admin lab project utilizado por admin. */
export interface AdminLabProject {
  id: string;
  title: string;
  status: ProjectStatus;
  owner_name: string;
  geographic_scope: string | null;
}

/** AdminLabProjects es la lista de proyectos disponibles para el laboratorio. */
/** Describe el contrato admin lab projects utilizado por admin. */
export interface AdminLabProjects {
  projects: AdminLabProject[];
}

/**
 * TraceGraphNode es un punto del grafo de trazabilidad: su id, su texto (label), su tipo (kind) y
 * sus detalles (details, datos extra que cambian según el tipo). El tipo puede ser: proyecto, atributo,
 * investigación, consulta, fuente, evidencia, hallazgo, entidad, competidor, oportunidad, riesgo,
 * hipótesis, información faltante, informe o sección de informe.
 */
/** Describe el contrato trace graph node utilizado por admin. */
export interface TraceGraphNode {
  id: string;
  label: string;
  kind:
    | "project"
    | "attribute"
    | "research_run"
    | "query"
    | "source"
    | "evidence"
    | "finding"
    | "entity"
    | "competitor"
    | "opportunity"
    | "risk"
    | "hypothesis"
    | "missing_information"
    | "report"
    | "report_section";
  details: Record<string, unknown>;
}

/**
 * TraceGraphEdge es una conexión entre dos nodos: de dónde sale (source), a dónde llega (target) y
 * el tipo de relación (relation), por ejemplo "contiene" o "respalda".
 */
/** Describe el contrato trace graph edge utilizado por admin. */
export interface TraceGraphEdge {
  source: string;
  target: string;
  relation: string;
}

/**
 * ProjectTraceGraph es el grafo completo de un proyecto: el proyecto, su nodo raíz (root_id),
 * todos los nodos y conexiones. "truncated" dice si el servidor recortó el grafo por ser muy grande.
 */
/** Describe el contrato project trace graph utilizado por admin. */
export interface ProjectTraceGraph {
  project_id: string;
  project_title: string;
  root_id: string;
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
  truncated: boolean;
}

/**
 * TracePathResult es el resultado de buscar un camino:
 * - path: los nodos del camino encontrado (en orden).
 * - visited_node_ids: los nodos que revisó el método, en orden de revisión.
 * - expanded_count: cuántos nodos "abrió" para revisar sus vecinos.
 * - found: si encontró un camino o no.
 * - shortest_path_steps: los pasos del camino más corto según BFS, que sirven de referencia (puede ser null).
 */
/** Describe el contrato trace path result utilizado por admin. */
export interface TracePathResult {
  algorithm: TraceAlgorithm;
  root_id: string;
  target_node_id: string;
  path: TraceGraphNode[];
  visited_node_ids: string[];
  expanded_count: number;
  found: boolean;
  /** Pasos del camino más corto según BFS; sirve como referencia para comparar. */
  shortest_path_steps: number | null;
}

/**
 * LabPlaceSearchRequest son los datos para buscar negocios cerca de una zona:
 * latitud y longitud del centro, radio en metros (el servidor acepta de 100 a 5000) y la palabra clave (el giro).
 */
/** Describe el contrato lab place search request utilizado por admin. */
export interface LabPlaceSearchRequest {
  latitude: number;
  longitude: number;
  radius_m: number;
  keyword: string;
}

/**
 * LabPlaceSearchResult es la respuesta de la búsqueda de lugares: los datos de la búsqueda,
 * los lugares encontrados, el texto de atribución (de dónde vienen los datos del mapa) y una nota.
 */
/** Describe el contrato lab place search result utilizado por admin. */
export interface LabPlaceSearchResult {
  project_id: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  keyword: string;
  places: GeoBusiness[];
  attribution: string;
  note: string;
}

/**
 * LabRouteRequest son los datos para calcular una ruta: la búsqueda de lugares (lo que hereda de
 * LabPlaceSearchRequest), los lugares elegidos (selected_place_ids, entre 2 y 8), el método,
 * y los parámetros del algoritmo genético: seed (semilla), population_size y generations.
 * La "extends" significa que incluye todos los campos de LabPlaceSearchRequest además de estos.
 */
/** Describe el contrato lab route request utilizado por admin. */
export interface LabRouteRequest extends LabPlaceSearchRequest {
  selected_place_ids: string[];
  algorithm: RouteAlgorithm;
  seed: number;
  population_size: number;
  generations: number;
}

/**
 * LabRouteStop es una parada de la ruta: su identificador en el mapa (osm_type y osm_id), su nombre,
 * sus coordenadas y la distancia desde la parada anterior en kilómetros.
 */
/** Describe el contrato lab route stop utilizado por admin. */
export interface LabRouteStop {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_from_previous_km: number;
}

/**
 * LabRouteResult es el resultado de la ruta:
 * - stops: las paradas en orden. Desde el punto de partida (depot) hasta la última.
 * - return_distance_km: la distancia de regreso al punto de partida.
 * - total_distance_km: la distancia total de la ruta, en kilómetros.
 * - optimal_reference_km: la distancia de la mejor ruta posible (la referencia exacta), para comparar.
 * - evaluations: cuántas rutas se revisaron.
 * - history_km: cómo fue bajando la distancia en cada paso del algoritmo.
 * - distance_note: aclaración sobre cómo se midió la distancia.
 * - persisted: siempre false. Esta ruta no se guarda en la base de datos.
 */
/** Describe el contrato lab route result utilizado por admin. */
export interface LabRouteResult {
  project_id: string;
  keyword: string;
  algorithm: RouteAlgorithm;
  depot_latitude: number;
  depot_longitude: number;
  stops: LabRouteStop[];
  return_distance_km: number;
  total_distance_km: number;
  optimal_reference_km: number;
  evaluations: number;
  history_km: number[];
  distance_note: string;
  persisted: false;
}

/**
 * HypothesisBudgetRequest son los datos para elegir hipótesis con presupuesto: el tope de dinero
 * (budget), el método y la lista de hipótesis con su costo estimado y su valor esperado.
 */
/** Describe el contrato hypothesis budget request utilizado por admin. */
export interface HypothesisBudgetRequest {
  budget: number;
  algorithm: BudgetAlgorithm;
  items: Array<{
    hypothesis_id: string;
    estimated_cost: number;
    expected_value: number;
  }>;
}

/**
 * HypothesisBudgetResult es la selección de hipótesis con presupuesto:
 * - selected: las hipótesis elegidas (con su prioridad, costo y valor).
 * - total_cost y total_value: la suma de costos y de valores de lo elegido.
 * - exact_reference_value: el mejor valor posible (referencia exacta), para comparar.
 * - evaluations: cuántas combinaciones se revisaron.
 * - persisted: siempre false. No se guarda en la base de datos.
 */
/** Describe el contrato hypothesis budget result utilizado por admin. */
export interface HypothesisBudgetResult {
  project_id: string;
  algorithm: BudgetAlgorithm;
  budget: number;
  selected: Array<{
    hypothesis_id: string;
    statement: string;
    priority: "low" | "medium" | "high";
    estimated_cost: number;
    expected_value: number;
  }>;
  total_cost: number;
  total_value: number;
  exact_reference_value: number;
  evaluations: number;
  persisted: false;
}

/**
 * ValidationScheduleRequest son los datos para repartir validaciones en turnos: cuántas tareas caben
 * por turno (capacity_per_shift) y la lista de tareas con su turno preferido.
 */
/** Describe el contrato validation schedule request utilizado por admin. */
export interface ValidationScheduleRequest {
  capacity_per_shift: number;
  tasks: Array<{ hypothesis_id: string; preferred_shift: ValidationShift }>;
}

/**
 * ValidationScheduleResult es el reparto de tareas en turnos:
 * - assignments: cada tarea con su turno preferido y el turno que se le asignó.
 * - satisfied_preferences: cuántas tareas quedaron en su turno preferido.
 * - priority_weighted_score: calificación que pondera la prioridad de cada tarea.
 * - evaluations y persisted: cuántas opciones se revisaron, y que no se guarda nada.
 */
/** Describe el contrato validation schedule result utilizado por admin. */
export interface ValidationScheduleResult {
  project_id: string;
  assignments: Array<{
    hypothesis_id: string;
    statement: string;
    priority: "low" | "medium" | "high";
    preferred_shift: ValidationShift;
    assigned_shift: ValidationShift;
  }>;
  satisfied_preferences: number;
  priority_weighted_score: number;
  evaluations: number;
  persisted: false;
}

/**
 * LabMetricPoint son los datos de un solo día en la gráfica de métricas: las llamadas, las que salieron
 * bien o mal, la latencia promedio y los tokens de entrada y salida.
 */
/** Describe el contrato lab metric point utilizado por admin. */
export interface LabMetricPoint {
  day: string;
  calls: number;
  success_calls: number;
  error_calls: number;
  avg_latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
}

/** LabMetrics son las métricas de varios días: cuántos días se consultaron y la lista de un punto por día. */
/** Describe el contrato lab metrics utilizado por admin. */
export interface LabMetrics {
  days: number;
  points: LabMetricPoint[];
}

/**
 * PropositionDefinition describe una proposición lógica: su símbolo (por ejemplo "P"), su nombre,
 * y su significado en una frase.
 */
/** Describe el contrato proposition definition utilizado por admin. */
export interface PropositionDefinition {
  symbol: string;
  name: string;
  meaning: string;
}

/**
 * TruthTableRow es una fila de la tabla de verdad: un diccionario de valores (cada proposición
 * con true o false) y el resultado de la regla para esa combinación.
 * Un diccionario se lee así: values["P"] te da el valor de P en esa fila.
 */
/** Describe el contrato truth table row utilizado por admin. */
export interface TruthTableRow {
  values: Record<string, boolean>;
  result: boolean;
}

/**
 * PropositionRuleTable es una regla completa con su tabla de verdad:
 * - id, title y description: nombre y explicación de la regla.
 * - source: de qué parte del código sale la regla.
 * - formula: la fórmula escrita con símbolos.
 * - inputs y output: las proposiciones de entrada y la de salida.
 * - rows: todas las combinaciones posibles.
 * - note: una nota sobre cómo la aplica IdeaForge.
 */
/** Describe el contrato proposition rule table utilizado por admin. */
export interface PropositionRuleTable {
  id: string;
  title: string;
  description: string;
  source: string;
  formula: string;
  inputs: PropositionDefinition[];
  output: PropositionDefinition;
  rows: TruthTableRow[];
  note: string;
}

/**
 * PeasDimension es una de las cuatro partes del modelo PEAS (desempeño, entorno, actuadores y sensores):
 * su símbolo, su nombre y su descripción.
 */
/** Describe el contrato peas dimension utilizado por admin. */
export interface PeasDimension {
  symbol: string;
  name: string;
  description: string;
}

/** LabPropositions son las reglas (rules) y las cuatro partes PEAS (peas) que muestra la página de lógica. */
/** Describe el contrato lab propositions utilizado por admin. */
export interface LabPropositions {
  rules: PropositionRuleTable[];
  peas: PeasDimension[];
}
