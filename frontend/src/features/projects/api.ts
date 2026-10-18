import { apiRequest } from "../../lib/apiClient";
import type {
  AttributeType,
  IdeaAttribute,
  Page,
  Project,
  ProjectDetail,
  ProjectInput,
  ProjectListParams,
  ProjectsOverview,
  ProjectSummary,
} from "./types";

export const projectsApi = {
  list: ({ limit, offset, status }: ProjectListParams) => {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) query.set("status", status);
    return apiRequest<Page<ProjectSummary>>(`/projects?${query}`);
  },
  overview: () => apiRequest<ProjectsOverview>("/projects/summary"),
  get: (id: string) => apiRequest<ProjectDetail>(`/projects/${id}`),
  create: (data: ProjectInput) => apiRequest<Project>("/projects", { method: "POST", body: data }),
  update: (id: string, data: Partial<ProjectInput>) =>
    apiRequest<Project>(`/projects/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) => apiRequest<void>(`/projects/${id}`, { method: "DELETE" }),
  confirmStructure: (id: string) =>
    apiRequest<ProjectDetail>(`/projects/${id}/confirm-structure`, { method: "POST" }),

  addAttribute: (id: string, data: { attribute_type: AttributeType; value: string }) =>
    apiRequest<IdeaAttribute>(`/projects/${id}/attributes`, { method: "POST", body: data }),
  updateAttribute: (id: string, attributeId: string, data: { value?: string; is_confirmed?: boolean }) =>
    apiRequest<IdeaAttribute>(`/projects/${id}/attributes/${attributeId}`, { method: "PATCH", body: data }),
  deleteAttribute: (id: string, attributeId: string) =>
    apiRequest<void>(`/projects/${id}/attributes/${attributeId}`, { method: "DELETE" }),
};
