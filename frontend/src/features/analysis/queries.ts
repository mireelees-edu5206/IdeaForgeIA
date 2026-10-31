/**
 * ARCHIVO: analysis/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" del análisis: guarda el análisis que ya se pidió, para no volver a pedirlo sin
 * necesidad, y lo refresca cuando algo cambia.
 *
 * ¿Para qué sirve?
 * - useAnalysis: el análisis completo, opcionalmente de una sola búsqueda. Puede actualizarse solo
 *   cada 2 segundos mientras el análisis se está generando ("polling").
 * - useStartAnalysis: pide generar el análisis de una búsqueda.
 * - useCreateAnalysisItem, useUpdateAnalysisItem, useDeleteAnalysisItem: cambian elementos.
 *
 * ¿Quién lo usa?
 * AnalysisTab.tsx, AnalysisItemCard.tsx y AnalysisItemForm.tsx.
 *
 * Detalle: cuando cambia el análisis, también se refrescan las búsquedas y el proyecto,
 * porque generar el análisis cambia el estado del proyecto (por ejemplo, a "analizado").
 */

/* "useMutation" maneja acciones que cambian datos. "useQuery" pide y guarda. "useQueryClient" da acceso a la memoria. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* Memorias de proyectos y de investigación, que también se refrescan al cambiar el análisis. */
import { projectKeys } from "../projects/queries";
import { researchKeys } from "../research/queries";
/* Las peticiones al servidor y las fichas de forma. */
import { analysisApi } from "./api";
import type { AnalysisCreateInput, AnalysisKindKey, AnalysisUpdate } from "./types";

/**
 * analysisKeys son los nombres de la memoria para el análisis. Están dentro del detalle del proyecto,
 * igual que las demás piezas. overviewForRun añade la búsqueda al nombre, así cada búsqueda tiene su propio dato.
 * "runId ?? 'all'" usa la palabra "all" cuando no hay búsqueda elegida.
 */
/** Define analysis keys como dato o funcion publica de analysis. */
export const analysisKeys = {
  overview: (projectId: string) => [...projectKeys.detail(projectId), "analysis"] as const,
  overviewForRun: (projectId: string, runId?: string) => [...analysisKeys.overview(projectId), runId ?? "all"] as const,
};

/**
 * useAnalysis pide el análisis.
 *
 * Recibe:
 * - projectId: el proyecto.
 * - runId (opcional): la búsqueda a mostrar.
 * - polling (por defecto false): si es true, vuelve a pedir el análisis cada 2 segundos (2000 milisegundos)
 *   mientras se genera. Si es false, no vuelve a pedirlo solo.
 */
/** Expone la funcion use analysis para el flujo de analysis. */
export function useAnalysis(projectId: string, runId?: string, polling = false) {
  return useQuery({
    queryKey: analysisKeys.overviewForRun(projectId, runId),
    queryFn: () => analysisApi.overview(projectId, runId),
    // "polling ? 2000 : false": 2 segundos si está generándose; false (sin sondeo) si no.
    refetchInterval: polling ? 2000 : false,
  });
}

/**
 * useAnalysisMutation es la plantilla de las acciones del análisis. Al terminar bien, refresca
 * el análisis, las búsquedas y el proyecto, porque todos dependen de los mismos datos.
 */
/** Coordina use analysis mutation de analisis. */
function useAnalysisMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // "Promise.all" espera a que terminen los tres refrescos a la vez.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: analysisKeys.overview(projectId) }),
        queryClient.invalidateQueries({ queryKey: researchKeys.runs(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
      ]),
  });
}

/** useStartAnalysis pide generar el análisis de una búsqueda (recibe el id de la búsqueda). */
/** Define use start analysis como dato o funcion publica de analysis. */
export const useStartAnalysis = (projectId: string) =>
  useAnalysisMutation(projectId, (runId: string) => analysisApi.start(projectId, runId));

/** useCreateAnalysisItem crea un elemento manual. Recibe el tipo y sus datos juntos. */
/** Define use create analysis item como dato o funcion publica de analysis. */
export const useCreateAnalysisItem = (projectId: string) =>
  useAnalysisMutation(projectId, ({ kind, data }: AnalysisCreateInput) => analysisApi.create(projectId, kind, data));

/** useUpdateAnalysisItem cambia un elemento. Recibe el tipo, el id del elemento y los campos nuevos. */
/** Define use update analysis item como dato o funcion publica de analysis. */
export const useUpdateAnalysisItem = (projectId: string) =>
  useAnalysisMutation(
    projectId,
    ({ kind, itemId, data }: { kind: AnalysisKindKey; itemId: string; data: AnalysisUpdate }) =>
      analysisApi.update(projectId, kind, itemId, data),
  );

/** useDeleteAnalysisItem borra un elemento. Recibe el tipo y el id del elemento. */
/** Define use delete analysis item como dato o funcion publica de analysis. */
export const useDeleteAnalysisItem = (projectId: string) =>
  useAnalysisMutation(
    projectId,
    ({ kind, itemId }: { kind: AnalysisKindKey; itemId: string }) => analysisApi.remove(projectId, kind, itemId),
  );
