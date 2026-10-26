import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../projects/queries";
import { reportsApi } from "./api";
import type { GeographicScopeInput } from "./types";

export const reportKeys = {
  list: (projectId: string) => [...projectKeys.detail(projectId), "reports"] as const,
  detail: (projectId: string, reportId: string) =>
    [...reportKeys.list(projectId), reportId] as const,
};

export function useReports(projectId: string) {
  return useQuery({
    queryKey: reportKeys.list(projectId),
    queryFn: () => reportsApi.list(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === "generating") ? 2000 : false,
  });
}

export function useReport(projectId: string, reportId: string | null) {
  return useQuery({
    queryKey: reportKeys.detail(projectId, reportId ?? ""),
    queryFn: () => reportsApi.get(projectId, reportId!),
    enabled: Boolean(reportId),
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 2000 : false,
  });
}

export function useCreateReport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (geographicScopes: GeographicScopeInput[]) => reportsApi.create(projectId, geographicScopes),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reportKeys.list(projectId) }),
  });
}
