import { apiRequest } from "../../lib/apiClient";
import type { GeographicScopeInput, Report, ReportDetail, ReportListItem } from "./types";

export const reportsApi = {
  create: (projectId: string, geographicScopes: GeographicScopeInput[]) =>
    apiRequest<Report>(`/projects/${projectId}/reports`, {
      method: "POST",
      body: { geographic_scopes: geographicScopes },
    }),
  list: (projectId: string) =>
    apiRequest<ReportListItem[]>(`/projects/${projectId}/reports`),
  get: (projectId: string, reportId: string) =>
    apiRequest<ReportDetail>(`/projects/${projectId}/reports/${reportId}`),
};
