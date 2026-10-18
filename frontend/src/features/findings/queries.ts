import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../projects/queries";
import { findingsApi } from "./api";
import type { CompetitorInput, CompetitorUpdate, FindingFilters, FindingInput, ReviewStatus } from "./types";

// Cuelgan del detalle del proyecto: al terminar una investigación se refrescan solos.
export const findingKeys = {
  findings: (projectId: string) => [...projectKeys.detail(projectId), "findings"] as const,
  findingList: (projectId: string, filters: FindingFilters) => [...findingKeys.findings(projectId), filters] as const,
  entities: (projectId: string) => [...projectKeys.detail(projectId), "entities"] as const,
  competitors: (projectId: string) => [...projectKeys.detail(projectId), "competitors"] as const,
};

export function useFindings(projectId: string, filters: FindingFilters) {
  return useQuery({
    queryKey: findingKeys.findingList(projectId, filters),
    queryFn: () => findingsApi.list(projectId, filters),
    placeholderData: keepPreviousData,
  });
}

export const useEntities = (projectId: string) =>
  useQuery({ queryKey: findingKeys.entities(projectId), queryFn: () => findingsApi.entities(projectId) });

export const useCompetitors = (projectId: string) =>
  useQuery({ queryKey: findingKeys.competitors(projectId), queryFn: () => findingsApi.competitors(projectId) });

/** Hallazgos, entidades y competidores se relacionan entre sí: se refrescan juntos. */
function useFindingsMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(
        [findingKeys.findings, findingKeys.entities, findingKeys.competitors].map((key) =>
          queryClient.invalidateQueries({ queryKey: key(projectId) }),
        ),
      ),
  });
}

export const useCreateFinding = (projectId: string) =>
  useFindingsMutation(projectId, (data: FindingInput) => findingsApi.create(projectId, data));

export const useUpdateFinding = (projectId: string) =>
  useFindingsMutation(
    projectId,
    ({ findingId, ...data }: Partial<FindingInput> & { findingId: string; review_status?: ReviewStatus }) =>
      findingsApi.update(projectId, findingId, data),
  );

export const useDeleteFinding = (projectId: string) =>
  useFindingsMutation(projectId, (findingId: string) => findingsApi.remove(projectId, findingId));

export const useCreateCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, (data: CompetitorInput) => findingsApi.createCompetitor(projectId, data));

export const useUpdateCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, ({ competitorId, ...data }: CompetitorUpdate & { competitorId: string }) =>
    findingsApi.updateCompetitor(projectId, competitorId, data),
  );

export const useDeleteCompetitor = (projectId: string) =>
  useFindingsMutation(projectId, (competitorId: string) => findingsApi.removeCompetitor(projectId, competitorId));
