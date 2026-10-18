import { apiRequest } from "../../lib/apiClient";
import type { AnalysisCreateInput, AnalysisItem, AnalysisKindKey, AnalysisOverview, AnalysisUpdate } from "./types";
import type { ResearchRun } from "../research/types";

export const analysisApi = {
  overview: (projectId: string, runId?: string) => {
    const query = runId ? `?run_id=${encodeURIComponent(runId)}` : "";
    return apiRequest<AnalysisOverview>(`/projects/${projectId}/analysis${query}`);
  },
  start: (projectId: string, runId: string) =>
    apiRequest<ResearchRun>(`/projects/${projectId}/research-runs/${runId}/analysis`, { method: "POST" }),
  create: (projectId: string, kind: AnalysisCreateInput["kind"], data: AnalysisCreateInput["data"]) =>
    apiRequest<AnalysisItem>(`/projects/${projectId}/${kind}`, { method: "POST", body: data }),
  update: (projectId: string, kind: AnalysisKindKey, itemId: string, data: AnalysisUpdate) =>
    apiRequest<AnalysisItem>(`/projects/${projectId}/${kind}/${itemId}`, { method: "PATCH", body: data }),
  remove: (projectId: string, kind: AnalysisKindKey, itemId: string) =>
    apiRequest<void>(`/projects/${projectId}/${kind}/${itemId}`, { method: "DELETE" }),
};
