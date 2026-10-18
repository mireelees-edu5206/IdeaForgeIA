import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../projects/queries";
import { researchKeys } from "../research/queries";
import { analysisApi } from "./api";
import type { AnalysisCreateInput, AnalysisKindKey, AnalysisUpdate } from "./types";

export const analysisKeys = {
  overview: (projectId: string) => [...projectKeys.detail(projectId), "analysis"] as const,
  overviewForRun: (projectId: string, runId?: string) => [...analysisKeys.overview(projectId), runId ?? "all"] as const,
};

export function useAnalysis(projectId: string, runId?: string, polling = false) {
  return useQuery({
    queryKey: analysisKeys.overviewForRun(projectId, runId),
    queryFn: () => analysisApi.overview(projectId, runId),
    refetchInterval: polling ? 2000 : false,
  });
}

function useAnalysisMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: analysisKeys.overview(projectId) }),
        queryClient.invalidateQueries({ queryKey: researchKeys.runs(projectId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
      ]),
  });
}

export const useStartAnalysis = (projectId: string) =>
  useAnalysisMutation(projectId, (runId: string) => analysisApi.start(projectId, runId));

export const useCreateAnalysisItem = (projectId: string) =>
  useAnalysisMutation(projectId, ({ kind, data }: AnalysisCreateInput) => analysisApi.create(projectId, kind, data));

export const useUpdateAnalysisItem = (projectId: string) =>
  useAnalysisMutation(
    projectId,
    ({ kind, itemId, data }: { kind: AnalysisKindKey; itemId: string; data: AnalysisUpdate }) =>
      analysisApi.update(projectId, kind, itemId, data),
  );

export const useDeleteAnalysisItem = (projectId: string) =>
  useAnalysisMutation(
    projectId,
    ({ kind, itemId }: { kind: AnalysisKindKey; itemId: string }) => analysisApi.remove(projectId, kind, itemId),
  );
