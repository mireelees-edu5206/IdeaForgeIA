/**
 * ARCHIVO: findings/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" de los resultados, nombres y competidores. Guarda lo que ya se pidió al servidor
 * para no volver a pedirlo sin necesidad, y avisa para refrescar cuando algo cambia.
 *
 * ¿Para qué sirve?
 * - useFindings: la lista de resultados, con filtros (búsqueda, tema, revisión).
 * - useEntities y useCompetitors: los nombres y los competidores del proyecto.
 * - use...Finding y use...Competitor: las acciones que cambian datos (crear, editar, borrar, revisar).
 *
 * ¿Quién lo usa?
 * FindingsTab, FindingCard, FindingForm, CompetitorsTab, CompetitorCard y CompetitorForm.
 *
 * Palabras clave:
 * - "queryKey" es el nombre con el que se guarda un dato en la memoria.
 * - "invalidate" significa "esto está viejo, vuelve a pedirlo".
 * - "mutation" es una acción que cambia datos en el servidor.
 */

/* "keepPreviousData" mantiene la lista anterior mientras llega la nueva (sin parpadeos).
   "useMutation" maneja acciones que cambian datos. "useQuery" pide y guarda. "useQueryClient" da acceso a la memoria. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* La memoria de proyectos: los resultados cuelgan del detalle del proyecto. */
import { projectKeys } from "../projects/queries";
/* Las peticiones al servidor. */
import { findingsApi } from "./api";
/* Las fichas de forma de lo que se pasa a cada función. */
import type { CompetitorInput, CompetitorUpdate, FindingFilters, FindingInput, ReviewStatus } from "./types";

/**
 * findingKeys son los nombres de la memoria para resultados, nombres y competidores.
 * Cuelgan del detalle del proyecto: al refrescar el proyecto, también se refrescan estos datos.
 */
// Cuelgan del detalle del proyecto: al terminar una investigación se refrescan solos.
export const findingKeys = {
  // Nombre base de los resultados del proyecto.
  findings: (projectId: string) => [...projectKeys.detail(projectId), "findings"] as const,
  // Nombre de una lista de resultados concreta, según sus filtros.
  findingList: (projectId: string, filters: FindingFilters) => [...findingKeys.findings(projectId), filters] as const,
  // Nombre de la lista de nombres (entidades).
  entities: (projectId: string) => [...projectKeys.detail(projectId), "entities"] as const,
  // Nombre de la lista de competidores.
  competitors: (projectId: string) => [...projectKeys.detail(projectId), "competitors"] as const,
};

/**
 * useFindings pide los resultados con los filtros dados.
 * "keepPreviousData" evita que la lista desaparezca mientras cambian los filtros.
 */
/** Expone la funcion use findings para el flujo de findings. */
export function useFindings(projectId: string, filters: FindingFilters) {
  return useQuery({
    queryKey: findingKeys.findingList(projectId, filters),
    queryFn: () => findingsApi.list(projectId, filters),
    placeholderData: keepPreviousData,
  });
}

/** useEntities pide los nombres que aparecen en los resultados. */
/** Define use entities como dato o funcion publica de findings. */
export const useEntities = (projectId: string) =>
  useQuery({ queryKey: findingKeys.entities(projectId), queryFn: () => findingsApi.entities(projectId) });

/** useCompetitors pide los competidores ya añadidos al proyecto. */
/** Define use competitors como dato o funcion publica de findings. */
export const useCompetitors = (projectId: string) =>
  useQuery({ queryKey: findingKeys.competitors(projectId), queryFn: () => findingsApi.competitors(projectId) });

/**
 * useFindingsMutation es la plantilla para las acciones de resultados, nombres y competidores.
 * Como están relacionados (un resultado menciona nombres, un competidor sale de un nombre),
 * al terminar bien se refrescan los tres a la vez.
 */
/** Hallazgos, entidades y competidores se relacionan entre sí: se refrescan juntos. */
function useFindingsMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // "Promise.all" espera a que los tres refrescos terminen. Cada key es una función que construye el nombre del dato.
    onSuccess: () =>
      Promise.all(
        [findingKeys.findings, findingKeys.entities, findingKeys.competitors].map((key) =>
          queryClient.invalidateQueries({ queryKey: key(projectId) }),
        ),
      ),
  });
}

/** useCreateFinding crea un resultado escrito por la persona. */
/** Define use create finding como dato o funcion publica de findings. */
export const useCreateFinding = (projectId: string) =>
  useFindingsMutation(projectId, (data: FindingInput) => findingsApi.create(projectId, data));

/**
 * useUpdateFinding cambia un resultado. Recibe el id dentro de "findingId" y el resto de los datos
 * (texto, nivel o revisión). La sintaxis "{ findingId, ...data }" separa el id del resto.
 */
/** Define use update finding como dato o funcion publica de findings. */
export const useUpdateFinding = (projectId: string) =>
  useFindingsMutation(
    projectId,
    ({ findingId, ...data }: Partial<FindingInput> & { findingId: string; review_status?: ReviewStatus }) =>
      findingsApi.update(projectId, findingId, data),
  );

/** useDeleteFinding borra un resultado (recibe su id). */
/** Define use delete finding como dato o funcion publica de findings. */
export const useDeleteFinding = (projectId: string) =>
  useFindingsMutation(projectId, (findingId: string) => findingsApi.remove(projectId, findingId));

/** useCreateCompetitor añade un competidor al proyecto. */
/** Define use create competitor como dato o funcion publica de findings. */
export const useCreateCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, (data: CompetitorInput) => findingsApi.createCompetitor(projectId, data));

/** useUpdateCompetitor cambia tipo, amenaza o revisión de un competidor (recibe su id en "competitorId"). */
/** Define use update competitor como dato o funcion publica de findings. */
export const useUpdateCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, ({ competitorId, ...data }: CompetitorUpdate & { competitorId: string }) =>
    findingsApi.updateCompetitor(projectId, competitorId, data),
  );

/** useDeleteCompetitor quita un competidor de la lista (recibe su id). */
/** Define use delete competitor como dato o funcion publica de findings. */
export const useDeleteCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, (competitorId: string) => findingsApi.removeCompetitor(projectId, competitorId));
