/**
 * ARCHIVO: projects/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" de los proyectos. Guarda las listas y los detalles que ya se pidieron al servidor,
 * para no volver a pedir lo mismo cada vez que la persona cambia de pantalla.
 * Y cuando algo cambia (crear, editar, borrar), avisa a la memoria para que vuelva a pedir lo nuevo.
 *
 * ¿Para qué sirve?
 * - useProjectList: la lista de proyectos (con paginación).
 * - useProjectsOverview: el resumen por etapas.
 * - useProject: el detalle de un proyecto.
 * - use...: las acciones que cambian datos (crear, editar, borrar, confirmar, atributos).
 *
 * ¿Quién lo usa?
 * ProjectsPage, NewProjectPage, ProjectDetailPage, ProjectCard, StructurePanel, AttributeSection...
 *
 * Palabras clave de la caché (para quien no sabe):
 * - "queryKey" es el nombre con el que se guarda un dato en la memoria.
 * - "invalidate" significa "esto ya está viejo, vuelve a pedirlo".
 * - "mutation" es una acción que cambia datos en el servidor (crear, borrar...).
 */

/* "keepPreviousData" mantiene la lista anterior en pantalla mientras llega la nueva (evita parpadeos).
   "useMutation" maneja acciones que cambian datos. "useQuery" pide y guarda datos. "useQueryClient" da acceso a la memoria. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* Las peticiones al servidor (api.ts). */
import { projectsApi } from "./api";
/* Las fichas de forma de los datos que se pasan a las funciones. */
import type { AttributeType, ProjectInput, ProjectListParams } from "./types";

/**
 * projectKeys son los nombres de la memoria para los proyectos. Siempre empiezan con "projects":
 * así, si se invalida "projects", se refrescan todas las listas, resúmenes y detalles de una vez.
 */
/** Define project keys como dato o funcion publica de projects. */
export const projectKeys = {
  // Nombre base de todo lo de proyectos.
  all: ["projects"] as const,
  // Nombre de una lista concreta, según sus filtros (página, etapa).
  list: (params: ProjectListParams) => [...projectKeys.all, "list", params] as const,
  // Nombre del resumen por etapas.
  overview: () => [...projectKeys.all, "overview"] as const,
  // Nombre del detalle de un proyecto concreto (por su id).
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

/**
 * useProjectList pide la lista de proyectos con los filtros dados.
 * Recibe los filtros (página, etapa) y devuelve el estado de la petición (cargando, datos o error).
 */
/** Expone la funcion use project list para el flujo de projects. */
export function useProjectList(params: ProjectListParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.list(params),
    // Mientras llega una página nueva, seguimos mostrando la anterior para que no parpadee la pantalla.
    placeholderData: keepPreviousData,
  });
}

/** useProjectsOverview pide el resumen por etapas (cuántos proyectos hay en cada una). */
/** Expone la funcion use projects overview para el flujo de projects. */
export function useProjectsOverview() {
  return useQuery({ queryKey: projectKeys.overview(), queryFn: projectsApi.overview });
}

/** useProject pide el detalle de un proyecto por su id. */
/** Expone la funcion use project para el flujo de projects. */
export function useProject(id: string) {
  return useQuery({ queryKey: projectKeys.detail(id), queryFn: () => projectsApi.get(id) });
}

/**
 * useProjectMutation es una plantilla para todas las acciones que cambian datos de proyectos.
 * Recibe la función que hace el cambio (mutationFn). Cuando esa acción termina bien, avisa a la
 * memoria que TODO lo de proyectos cambió, porque listas, resúmenes y detalles dependen de los mismos datos.
 */
/** Cualquier cambio invalida listas, resumen y detalle: todo depende de los mismos datos. */
function useProjectMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Al terminar bien, marcamos como viejos todos los datos de "projects". La pantalla los vuelve a pedir.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

/** useCreateProject crea un proyecto nuevo con su título y su idea. */
/** Define use create project como dato o funcion publica de projects. */
export const useCreateProject = () => useProjectMutation((data: ProjectInput) => projectsApi.create(data));

/** useUpdateProject cambia el título o la idea de un proyecto concreto (por su id). */
/** Define use update project como dato o funcion publica de projects. */
export const useUpdateProject = (id: string) =>
  useProjectMutation((data: Partial<ProjectInput>) => projectsApi.update(id, data));

/**
 * useDeleteProject borra el proyecto indicado.
 * Al terminar: quita su detalle de la memoria (ya no existe) y refresca las listas.
 */
/** Expone la funcion use delete project para el flujo de projects. */
export function useDeleteProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      // Borramos de la memoria el detalle del proyecto que ya no existe.
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      // Y pedimos de nuevo todo lo demás (listas y resumen).
      return queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/** useConfirmStructure confirma la estructura de la idea para pasarla a "lista para investigar". */
/** Define use confirm structure como dato o funcion publica de projects. */
export const useConfirmStructure = (id: string) => useProjectMutation(() => projectsApi.confirmStructure(id));

/** useAddAttribute agrega un dato (por ejemplo, un problema) a la idea. */
/** Define use add attribute como dato o funcion publica de projects. */
export const useAddAttribute = (id: string) =>
  useProjectMutation((data: { attribute_type: AttributeType; value: string }) => projectsApi.addAttribute(id, data));

/**
 * useUpdateAttribute cambia el texto de un dato o lo confirma.
 * Recibe el id del atributo dentro de "attributeId" y los campos nuevos en "data".
 * La sintaxis "{ attributeId, ...data }" separa el id del resto de los datos.
 */
/** Define use update attribute como dato o funcion publica de projects. */
export const useUpdateAttribute = (id: string) =>
  useProjectMutation(({ attributeId, ...data }: { attributeId: string; value?: string; is_confirmed?: boolean }) =>
    projectsApi.updateAttribute(id, attributeId, data),
  );

/** useDeleteAttribute borra un dato de la idea (recibe el id del atributo). */
/** Define use delete attribute como dato o funcion publica de projects. */
export const useDeleteAttribute = (id: string) =>
  useProjectMutation((attributeId: string) => projectsApi.deleteAttribute(id, attributeId));
