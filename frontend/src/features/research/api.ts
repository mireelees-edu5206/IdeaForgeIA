/**
 * ARCHIVO: research/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" de la investigación: sabe qué dirección del servidor usar para iniciar una
 * búsqueda, leer sus resultados y pedir las fuentes del proyecto.
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben direcciones a mano; llaman, por ejemplo, researchApi.start(id).
 * Si la dirección del servidor cambia, solo se modifica aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. Las pantallas nunca lo usan directamente.
 *
 * Todas las peticiones pasan por apiRequest (lib/apiClient.ts), que agrega la sesión y convierte errores.
 * Las direcciones empiezan con /projects/{id}/..., porque la investigación siempre pertenece a un proyecto.
 */

/* Función central que habla con el backend. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de lo que devuelve cada petición. */
import type { ResearchRun, ResearchRunDetail, Source } from "./types";

/**
 * researchApi agrupa las cuatro peticiones de investigación:
 */
/** Define research api como dato o funcion publica de research. */
export const researchApi = {
  // Inicia una investigación nueva para el proyecto (POST). Devuelve la ficha de la búsqueda creada.
  start: (projectId: string) => apiRequest<ResearchRun>(`/projects/${projectId}/research-runs`, { method: "POST" }),
  // Lista todas las investigaciones del proyecto (GET). ResearchTab toma la primera como "la más reciente".
  listRuns: (projectId: string) => apiRequest<ResearchRun[]>(`/projects/${projectId}/research-runs`),
  // Pide una investigación completa con sus preguntas, fuentes y evidencias (GET).
  getRun: (projectId: string, runId: string) =>
    apiRequest<ResearchRunDetail>(`/projects/${projectId}/research-runs/${runId}`),
  // Lista las fuentes del proyecto, sin duplicados (GET).
  listSources: (projectId: string) => apiRequest<Source[]>(`/projects/${projectId}/sources`),
};
