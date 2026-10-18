import { apiRequest } from "../../lib/apiClient";
import type {
  Competitor,
  CompetitorInput,
  CompetitorUpdate,
  Entity,
  Finding,
  FindingFilters,
  FindingInput,
  ReviewStatus,
} from "./types";

export const findingsApi = {
  list: (projectId: string, filters: FindingFilters) => {
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    const search = query.toString();
    return apiRequest<Finding[]>(`/projects/${projectId}/findings${search ? `?${search}` : ""}`);
  },
  create: (projectId: string, data: FindingInput) =>
    apiRequest<Finding>(`/projects/${projectId}/findings`, { method: "POST", body: data }),
  update: (projectId: string, findingId: string, data: Partial<FindingInput> & { review_status?: ReviewStatus }) =>
    apiRequest<Finding>(`/projects/${projectId}/findings/${findingId}`, { method: "PATCH", body: data }),
  remove: (projectId: string, findingId: string) =>
    apiRequest<void>(`/projects/${projectId}/findings/${findingId}`, { method: "DELETE" }),

  entities: (projectId: string) => apiRequest<Entity[]>(`/projects/${projectId}/entities`),
  competitors: (projectId: string) => apiRequest<Competitor[]>(`/projects/${projectId}/competitors`),
  createCompetitor: (projectId: string, data: CompetitorInput) =>
    apiRequest<Competitor>(`/projects/${projectId}/competitors`, { method: "POST", body: data }),
  updateCompetitor: (projectId: string, competitorId: string, data: CompetitorUpdate) =>
    apiRequest<Competitor>(`/projects/${projectId}/competitors/${competitorId}`, { method: "PATCH", body: data }),
  removeCompetitor: (projectId: string, competitorId: string) =>
    apiRequest<void>(`/projects/${projectId}/competitors/${competitorId}`, { method: "DELETE" }),
};
