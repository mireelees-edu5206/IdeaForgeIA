import { apiRequest } from "../../lib/apiClient";
import type { ResearchRun, ResearchRunDetail, Source } from "./types";

export const researchApi = {
  start: (projectId: string) => apiRequest<ResearchRun>(`/projects/${projectId}/research-runs`, { method: "POST" }),
  listRuns: (projectId: string) => apiRequest<ResearchRun[]>(`/projects/${projectId}/research-runs`),
  getRun: (projectId: string, runId: string) =>
    apiRequest<ResearchRunDetail>(`/projects/${projectId}/research-runs/${runId}`),
  listSources: (projectId: string) => apiRequest<Source[]>(`/projects/${projectId}/sources`),
};
