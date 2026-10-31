/**
 * ARCHIVO: findings/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" de los resultados, entidades y competidores: sabe qué dirección del servidor
 * usar para listar, crear, cambiar y borrar cada cosa.
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben direcciones a mano. Por ejemplo, para crear un resultado se llama
 * findingsApi.create(proyecto, datos). Si la dirección cambia, solo se modifica aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. Las pantallas no lo usan directamente.
 *
 * Todas las direcciones empiezan con /projects/{id}/..., porque los resultados siempre pertenecen a un proyecto.
 */

/* Función central que habla con el backend. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de lo que se envía y se recibe. */
import type {
  Competitor,
  CompetitorInput,
  CompetitorUpdate,
  Entity,
  Finding,
  FindingFilters,
  FindingInput,
  ReviewStatus,
} from "./types";

/**
 * findingsApi agrupa todas las peticiones de resultados, entidades y competidores.
 */
/** Define findings api como dato o funcion publica de findings. */
export const findingsApi = {
  // Lista los resultados del proyecto, aplicando solo los filtros que tengan valor.
  list: (projectId: string, filters: FindingFilters) => {
    // "Object.entries" convierte los filtros en pares [nombre, valor]. El filtro "entry is [string, string]"
    // descarta los vacíos o no definidos (Boolean(...) los deja fuera).
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    // Convertimos los parámetros en texto ("run_id=abc&review_status=accepted"), o vacío si no hay ninguno.
    const search = query.toString();
    // Si hay texto de búsqueda, lo agregamos con "?". Si no, la dirección queda limpia.
    return apiRequest<Finding[]>(`/projects/${projectId}/findings${search ? `?${search}` : ""}`);
  },
  // Crear un resultado escrito por la persona (POST).
  create: (projectId: string, data: FindingInput) =>
    apiRequest<Finding>(`/projects/${projectId}/findings`, { method: "POST", body: data }),
  // Cambiar un resultado (PATCH): texto, nivel, o su estado de revisión (aceptar, rechazar o volver a proponer).
  update: (projectId: string, findingId: string, data: Partial<FindingInput> & { review_status?: ReviewStatus }) =>
    apiRequest<Finding>(`/projects/${projectId}/findings/${findingId}`, { method: "PATCH", body: data }),
  // Borrar un resultado (DELETE). Solo se permite a los que escribió la persona.
  remove: (projectId: string, findingId: string) =>
    apiRequest<void>(`/projects/${projectId}/findings/${findingId}`, { method: "DELETE" }),

  // Lista los nombres (entidades) que aparecen en los resultados (GET).
  entities: (projectId: string) => apiRequest<Entity[]>(`/projects/${projectId}/entities`),
  // Lista los competidores ya añadidos al proyecto (GET).
  competitors: (projectId: string) => apiRequest<Competitor[]>(`/projects/${projectId}/competitors`),
  // Añadir un competidor (POST), a partir de una entidad existente o de un nombre nuevo.
  createCompetitor: (projectId: string, data: CompetitorInput) =>
    apiRequest<Competitor>(`/projects/${projectId}/competitors`, { method: "POST", body: data }),
  // Cambiar tipo, nivel de amenaza o revisión de un competidor (PATCH).
  updateCompetitor: (projectId: string, competitorId: string, data: CompetitorUpdate) =>
    apiRequest<Competitor>(`/projects/${projectId}/competitors/${competitorId}`, { method: "PATCH", body: data }),
  // Quitar un competidor de la lista (DELETE). Sus resultados y fuentes se conservan.
  removeCompetitor: (projectId: string, competitorId: string) =>
    apiRequest<void>(`/projects/${projectId}/competitors/${competitorId}`, { method: "DELETE" }),
};
