/**
 * ARCHIVO: reports/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" de los informes: sabe qué dirección del servidor usar para crear un informe,
 * listar los del proyecto y leer uno concreto.
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben direcciones a mano. Si el servidor cambia una ruta, solo se toca aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. ReportsTab.tsx no lo usa directamente.
 *
 * Todas las rutas empiezan con /projects/{id}/reports, porque los informes siempre pertenecen a un proyecto.
 */

/* Función central que habla con el backend y agrega la sesión. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de lo que se envía y se recibe. */
import type { GeographicScopeInput, Report, ReportDetail, ReportListItem } from "./types";

/**
 * reportsApi agrupa las tres peticiones de informes.
 */
/** Define reports api como dato o funcion publica de reports. */
export const reportsApi = {
  // Crea un informe nuevo (POST). Manda las zonas dentro de "geographic_scopes". Responde 202 y el informe queda "generando".
  create: (projectId: string, geographicScopes: GeographicScopeInput[]) =>
    apiRequest<Report>(`/projects/${projectId}/reports`, {
      method: "POST",
      body: { geographic_scopes: geographicScopes },
    }),
  // Lista los informes del proyecto, de la versión más nueva a la más vieja (GET).
  list: (projectId: string) =>
    apiRequest<ReportListItem[]>(`/projects/${projectId}/reports`),
  // Pide un informe concreto con todos sus apartados (GET).
  get: (projectId: string, reportId: string) =>
    apiRequest<ReportDetail>(`/projects/${projectId}/reports/${reportId}`),
};
