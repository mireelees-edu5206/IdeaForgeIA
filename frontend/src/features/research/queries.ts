import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../projects/queries";
import { researchApi } from "./api";
import { RUN_POLL_INTERVAL_MS, isActiveRun } from "./constants";

// Cuelgan del detalle del proyecto: invalidar el proyecto también refresca su investigación.
export const researchKeys = {
  runs: (projectId: string) => [...projectKeys.detail(projectId), "runs"] as const,
  run: (projectId: string, runId: string) => [...researchKeys.runs(projectId), runId] as const,
  sources: (projectId: string) => [...projectKeys.detail(projectId), "sources"] as const,
};

export function useResearchRuns(projectId: string) {
  return useQuery({
    queryKey: researchKeys.runs(projectId),
    queryFn: () => researchApi.listRuns(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((run) => isActiveRun(run.status)) ? RUN_POLL_INTERVAL_MS : false,
  });
}

export function useResearchRun(projectId: string, runId: string | undefined) {
  return useQuery({
    queryKey: researchKeys.run(projectId, runId ?? ""),
    queryFn: () => researchApi.getRun(projectId, runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => (query.state.data && isActiveRun(query.state.data.status) ? RUN_POLL_INTERVAL_MS : false),
  });
}

export function useSources(projectId: string) {
  return useQuery({ queryKey: researchKeys.sources(projectId), queryFn: () => researchApi.listSources(projectId) });
}

export function useStartResearch(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => researchApi.start(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
