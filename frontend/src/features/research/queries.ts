/**
 * ARCHIVO: research/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" de la investigación: guarda las listas de búsquedas, el detalle de cada una y
 * las fuentes, y las actualiza sola mientras una búsqueda está en curso.
 *
 * ¿Para qué sirve?
 * - useResearchRuns: la lista de búsquedas del proyecto. Mientras alguna esté activa, se vuelve a pedir cada 2 segundos.
 * - useResearchRun: el detalle de una búsqueda. También se actualiza cada 2 segundos mientras corre.
 * - useSources: las fuentes del proyecto.
 * - useStartResearch: la acción de iniciar una búsqueda nueva.
 *
 * ¿Quién lo usa?
 * ResearchTab.tsx, SourcesTab.tsx, StartResearchButton.tsx (que usa StructurePanel) y
 * VisualizationsTab.tsx (para contar las fuentes en sus gráficas).
 *
 * Idea clave del "sondeo" (polling): la pantalla pregunta periódicamente "¿cómo va?" hasta que
 * la búsqueda termina. Cuando termina, ya no pregunta más, para no gastar peticiones.
 */

/* "useMutation" maneja acciones que cambian datos. "useQuery" pide y guarda. "useQueryClient" da acceso a la memoria. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* La memoria de proyectos: las búsquedas cuelgan del proyecto, así que se refrescan con él. */
import { projectKeys } from "../projects/queries";
/* Las peticiones al servidor. */
import { researchApi } from "./api";
/* El ritmo de sondeo (2 segundos) y la función que dice si una búsqueda sigue activa. */
import { RUN_POLL_INTERVAL_MS, isActiveRun } from "./constants";

/**
 * researchKeys son los nombres de la memoria para la investigación.
 * Están "dentro" del detalle del proyecto (projectKeys.detail), así que refrescar el proyecto
 * también refresca su investigación. Eso es lo que dice el comentario de la línea de arriba.
 */
// Cuelgan del detalle del proyecto: invalidar el proyecto también refresca su investigación.
export const researchKeys = {
  // Nombre de la lista de búsquedas del proyecto.
  runs: (projectId: string) => [...projectKeys.detail(projectId), "runs"] as const,
  // Nombre de una búsqueda concreta dentro de esa lista.
  run: (projectId: string, runId: string) => [...researchKeys.runs(projectId), runId] as const,
  // Nombre de la lista de fuentes del proyecto.
  sources: (projectId: string) => [...projectKeys.detail(projectId), "sources"] as const,
};

/**
 * useResearchRuns pide la lista de búsquedas del proyecto.
 *
 * "refetchInterval" es la regla de sondeo: si alguna búsqueda sigue activa, vuelve a pedir la lista
 * cada 2 segundos; si no, deja de pedir (devuelve false).
 */
/** Expone la funcion use research runs para el flujo de research. */
export function useResearchRuns(projectId: string) {
  return useQuery({
    queryKey: researchKeys.runs(projectId),
    queryFn: () => researchApi.listRuns(projectId),
    // "query.state.data?.some(...)" revisa si alguna búsqueda de la lista sigue activa.
    refetchInterval: (query) =>
      query.state.data?.some((run) => isActiveRun(run.status)) ? RUN_POLL_INTERVAL_MS : false,
  });
}

/**
 * useResearchRun pide el detalle de una búsqueda concreta.
 * Si todavía no hay búsqueda seleccionada ("runId" vacío), no hace la petición ("enabled: false").
 * Sondea cada 2 segundos mientras la búsqueda esté activa, igual que la lista.
 */
/** Expone la funcion use research run para el flujo de research. */
export function useResearchRun(projectId: string, runId: string | undefined) {
  return useQuery({
    queryKey: researchKeys.run(projectId, runId ?? ""),
    // El "!" le dice a TypeScript que aquí runId ya existe (la petición solo se hace si "enabled" es true).
    queryFn: () => researchApi.getRun(projectId, runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data && isActiveRun(query.state.data.status) ? RUN_POLL_INTERVAL_MS : false),
  });
}

/** useSources pide las fuentes del proyecto. No sondea: las fuentes no cambian por sí solas en pantalla. */
/** Expone la funcion use sources para el flujo de research. */
export function useSources(projectId: string) {
  return useQuery({ queryKey: researchKeys.sources(projectId), queryFn: () => researchApi.listSources(projectId) });
}

/**
 * useStartResearch inicia una búsqueda nueva para el proyecto.
 * Al terminar bien, refresca todo lo de proyectos: la búsqueda nueva cambia el estado del proyecto.
 */
/** Expone la funcion use start research para el flujo de research. */
export function useStartResearch(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => researchApi.start(projectId),
    // Marcamos como viejos todos los datos de proyectos para que se vuelvan a pedir.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
