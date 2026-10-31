/**
 * ARCHIVO: projects/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" de los proyectos: sabe qué dirección del servidor usar para cada acción
 * (listar, crear, editar, borrar, confirmar la estructura y manejar los atributos).
 *
 * ¿Para qué sirve?
 * Cada función aquí manda una petición al backend y devuelve la respuesta ya convertida.
 * Así las pantallas no escriben direcciones a mano: solo llaman, por ejemplo, projectsApi.create(...).
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché, y de ahí lo usan las pantallas.
 *
 * Todas las peticiones pasan por apiRequest (lib/apiClient.ts), que agrega la sesión y convierte
 * los errores en mensajes claros.
 */

/* "apiRequest" es la función central que habla con el backend. */
import { apiRequest } from "../../lib/apiClient";
/* Las fichas de forma de los datos que devuelve y recibe cada petición. */
import type {
  AttributeType,
  IdeaAttribute,
  Page,
  Project,
  ProjectDetail,
  ProjectInput,
  ProjectListParams,
  ProjectsOverview,
  ProjectSummary,
} from "./types";

/**
 * projectsApi agrupa todas las peticiones de proyectos. Cada línea es una acción:
 */
/** Define projects api como dato o funcion publica de projects. */
export const projectsApi = {
  // Lista de proyectos con paginación y filtro opcional por etapa.
  list: ({ limit, offset, status }: ProjectListParams) => {
    // "URLSearchParams" arma el texto de la dirección con los parámetros: ?limit=10&offset=0...
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    // Si hay una etapa elegida, la agregamos al final de la dirección.
    /** Rama condicional: status. */
    if (status) query.set("status", status);
    // Pedimos GET /projects?... y esperamos una "página" de resúmenes.
    return apiRequest<Page<ProjectSummary>>(`/projects?${query}`);
  },
  // Resumen de cuántos proyectos hay en cada etapa (para el panel de inicio).
  overview: () => apiRequest<ProjectsOverview>("/projects/summary"),
  // Un proyecto completo con sus atributos (GET /projects/{id}).
  get: (id: string) => apiRequest<ProjectDetail>(`/projects/${id}`),
  // Crear un proyecto nuevo (POST /projects). El cuerpo lleva el título y la idea.
  create: (data: ProjectInput) => apiRequest<Project>("/projects", { method: "POST", body: data }),
  // Editar un proyecto (PATCH): solo se mandan los campos que cambian. "Partial" significa "algunos de ellos".
  update: (id: string, data: Partial<ProjectInput>) =>
    apiRequest<Project>(`/projects/${id}`, { method: "PATCH", body: data }),
  // Borrar un proyecto (DELETE). No devuelve contenido, por eso el tipo es "void" (vacío).
  remove: (id: string) => apiRequest<void>(`/projects/${id}`, { method: "DELETE" }),
  // Confirmar la estructura: pasa el proyecto de "borrador" a "lista para investigar" (si ya tiene los datos obligatorios).
  confirmStructure: (id: string) =>
    apiRequest<ProjectDetail>(`/projects/${id}/confirm-structure`, { method: "POST" }),

  // Agregar un atributo (por ejemplo, un problema) a la idea.
  addAttribute: (id: string, data: { attribute_type: AttributeType; value: string }) =>
    apiRequest<IdeaAttribute>(`/projects/${id}/attributes`, { method: "POST", body: data }),
  // Cambiar el texto de un atributo o confirmarlo (is_confirmed).
  updateAttribute: (id: string, attributeId: string, data: { value?: string; is_confirmed?: boolean }) =>
    apiRequest<IdeaAttribute>(`/projects/${id}/attributes/${attributeId}`, { method: "PATCH", body: data }),
  // Borrar un atributo de la idea.
  deleteAttribute: (id: string, attributeId: string) =>
    apiRequest<void>(`/projects/${id}/attributes/${attributeId}`, { method: "DELETE" }),
};
