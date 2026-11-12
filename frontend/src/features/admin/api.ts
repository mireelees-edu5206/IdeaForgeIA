/**
 * ARCHIVO: admin/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" del área de administración: sabe qué dirección del servidor usar para cada
 * cosa que hace el panel de admin (cuentas, métricas y el laboratorio de algoritmos).
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben direcciones a mano. Si el servidor cambia una ruta, solo se toca aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. Las pantallas no lo usan directamente.
 *
 * Todas las rutas empiezan con /admin. El servidor las protege: solo una cuenta con rol de
 * administrador puede usarlas (si no, responde 403).
 */

/* Función central que habla con el backend y agrega la sesión. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de lo que se envía y se recibe. */
import type {
  AdminOverview,
  AdminUser,
  AdminUserUpdate,
  AdminLabProjects,
  LabMetrics,
  LabPlaceSearchRequest,
  LabPlaceSearchResult,
  LabPropositions,
  LabRouteRequest,
  LabRouteResult,
  HypothesisBudgetRequest,
  HypothesisBudgetResult,
  ProjectTraceGraph,
  TracePathResult,
} from "./types";

/**
 * adminApi agrupa todas las peticiones del área de administración. Se divide en dos partes:
 * - Cuentas y resumen general (overview, users).
 * - Laboratorio de algoritmos (lab/...), que incluye la trazabilidad, las rutas y el presupuesto.
 */
/** Define admin api como dato o funcion publica de admin. */
export const adminApi = {
  // Resumen general de la plataforma (GET). Incluye totales y la bitácora reciente de llamadas a IA.
  overview: () => apiRequest<AdminOverview>("/admin/overview"),
  // Lista todas las cuentas registradas (GET).
  listUsers: () => apiRequest<AdminUser[]>("/admin/users"),
  // Cambia el rol o el estado (activo o suspendido) de una cuenta (PATCH).
  updateUser: (userId: string, data: AdminUserUpdate) =>
    apiRequest<AdminUser>(`/admin/users/${userId}`, { method: "PATCH", body: data }),
  // Elimina una cuenta de forma permanente (DELETE).
  deleteUser: (userId: string) =>
    apiRequest<void>(`/admin/users/${userId}`, { method: "DELETE" }),
  // Métricas del laboratorio por día. "days" es cuántos días hacia atrás se consultan (GET).
  labMetrics: (days: number) =>
    apiRequest<LabMetrics>(`/admin/lab/metrics?days=${days}`),
  // Las reglas de lógica y el marco PEAS, que son textos fijos del sistema (GET).
  labPropositions: () => apiRequest<LabPropositions>("/admin/lab/propositions"),
  // La lista de proyectos que el laboratorio puede analizar (GET).
  labProjects: () => apiRequest<AdminLabProjects>("/admin/lab/projects"),
  // El grafo de relaciones de un proyecto: nodos y conexiones (GET).
  projectTrace: (projectId: string) =>
    apiRequest<ProjectTraceGraph>(`/admin/lab/projects/${projectId}/trace`),
  // Busca el camino con menos pasos (BFS) desde la raíz del proyecto hasta un nodo (POST).
  projectTracePath: (projectId: string, target_node_id: string) =>
    apiRequest<TracePathResult>(`/admin/lab/projects/${projectId}/trace/path`, {
      method: "POST",
      body: { target_node_id },
    }),
  // Busca lugares reales (negocios) cerca de una zona con una palabra clave (POST).
  projectPlaces: (projectId: string, data: LabPlaceSearchRequest) =>
    apiRequest<LabPlaceSearchResult>(`/admin/lab/projects/${projectId}/places`, {
      method: "POST",
      body: data,
    }),
  // Calcula la ruta de visita entre los lugares elegidos (POST). No guarda nada.
  projectRoute: (projectId: string, data: LabRouteRequest) =>
    apiRequest<LabRouteResult>(`/admin/lab/projects/${projectId}/route`, {
      method: "POST",
      body: data,
    }),
  // Elige qué hipótesis validar con un presupuesto (POST). No guarda nada.
  projectBudgetPlan: (projectId: string, data: HypothesisBudgetRequest) =>
    apiRequest<HypothesisBudgetResult>(`/admin/lab/projects/${projectId}/budget-plan`, {
      method: "POST",
      body: data,
    }),
};
