import { apiRequest } from "../../lib/apiClient";
import type { Report, ReportDetail, ReportListItem } from "./types";

export const reportsApi = {
  create: (projectId: string) =>
    apiRequest<Report>(`/projects/${projectId}/reports`, { method: "POST" }),
  list: (projectId: string) =>
    apiRequest<ReportListItem[]>(`/projects/${projectId}/reports`),
  get: (projectId: string, reportId: string) =>
    apiRequest<ReportDetail>(`/projects/${projectId}/reports/${reportId}`),
};
