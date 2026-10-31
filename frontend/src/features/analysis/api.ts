/**
 * ARCHIVO: analysis/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" del análisis: sabe qué dirección del servidor usar para leer el análisis,
 * iniciarlo, crear, cambiar y borrar elementos.
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben direcciones a mano. Si el servidor cambia una dirección, solo se toca aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. Las pantallas no lo usan directamente.
 *
 * Todas las peticiones pasan por apiRequest (lib/apiClient.ts), que agrega la sesión y convierte errores.
 */

/* Función central que habla con el backend. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de lo que se envía y se recibe. */
import type { AnalysisCreateInput, AnalysisItem, AnalysisKindKey, AnalysisOverview, AnalysisUpdate } from "./types";
/* Ficha de una búsqueda de investigación (la respuesta de "iniciar análisis" la devuelve). */
import type { ResearchRun } from "../research/types";

/**
 * analysisApi agrupa las peticiones del análisis.
 */
/** Define analysis api como dato o funcion publica de analysis. */
export const analysisApi = {
  // Pide el análisis completo del proyecto (GET). Si viene "runId", lo limita a esa búsqueda.
  overview: (projectId: string, runId?: string) => {
    // "encodeURIComponent" convierte el id en texto seguro para la dirección (quita caracteres raros).
    const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
    return apiRequest<AnalysisOverview>(`/projects/${projectId}/analysis${query}`);
  },
  // Pide al servidor que genere el análisis a partir de una búsqueda (POST). Esto corre en segundo plano.
  start: (projectId: string, runId: string) =>
    apiRequest<ResearchRun>(`/projects/${projectId}/research-runs/${runId}/analysis`, { method: "POST" }),
  // Crea un elemento manual. La dirección cambia según el tipo: /projects/{id}/opportunities, /risks, etc.
  create: (projectId: string, kind: AnalysisCreateInput["kind"], data: AnalysisCreateInput["data"]) =>
    apiRequest<AnalysisItem>(`/projects/${projectId}/${kind}`, { method: "POST", body: data }),
  // Cambia un elemento existente (PATCH) según su tipo.
  update: (projectId: string, kind: AnalysisKindKey, itemId: string, data: AnalysisUpdate) =>
    apiRequest<AnalysisItem>(`/projects/${projectId}/${kind}/${itemId}`, { method: "PATCH", body: data }),
  // Borra un elemento (DELETE). Solo se permite a los que escribió la persona.
  remove: (projectId: string, kind: AnalysisKindKey, itemId: string) =>
    apiRequest<void>(`/projects/${projectId}/${kind}/${itemId}`, { method: "DELETE" }),
};
