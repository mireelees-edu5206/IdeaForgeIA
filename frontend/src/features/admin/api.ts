import { apiRequest } from "../../lib/apiClient";
import type {
  AdminOverview,
  AdminUser,
  AdminUserUpdate,
  AdminLabProjects,
  LabMetrics,
  LabPlaceSearchRequest,
  LabPlaceSearchResult,
  LabPropositions,
  LabRouteRequest,
  LabRouteResult,
  HypothesisBudgetRequest,
  HypothesisBudgetResult,
  ProjectTraceGraph,
  TraceAlgorithm,
  TracePathResult,
  ValidationScheduleRequest,
  ValidationScheduleResult,
} from "./types";

export const adminApi = {
  overview: () => apiRequest<AdminOverview>("/admin/overview"),
  listUsers: () => apiRequest<AdminUser[]>("/admin/users"),
  updateUser: (userId: string, data: AdminUserUpdate) =>
    apiRequest<AdminUser>(`/admin/users/${userId}`, { method: "PATCH", body: data }),
  deleteUser: (userId: string) =>
    apiRequest<void>(`/admin/users/${userId}`, { method: "DELETE" }),
  labMetrics: (days: number) =>
    apiRequest<LabMetrics>(`/admin/lab/metrics?days=${days}`),
  labPropositions: () => apiRequest<LabPropositions>("/admin/lab/propositions"),
  labProjects: () => apiRequest<AdminLabProjects>("/admin/lab/projects"),
  projectTrace: (projectId: string) =>
    apiRequest<ProjectTraceGraph>(`/admin/lab/projects/${projectId}/trace`),
  projectTracePath: (projectId: string, algorithm: TraceAlgorithm, target_node_id: string) =>
    apiRequest<TracePathResult>(`/admin/lab/projects/${projectId}/trace/path`, {
      method: "POST",
      body: { algorithm, target_node_id },
    }),
  projectPlaces: (projectId: string, data: LabPlaceSearchRequest) =>
    apiRequest<LabPlaceSearchResult>(`/admin/lab/projects/${projectId}/places`, {
      method: "POST",
      body: data,
    }),
  projectRoute: (projectId: string, data: LabRouteRequest) =>
    apiRequest<LabRouteResult>(`/admin/lab/projects/${projectId}/route`, {
      method: "POST",
      body: data,
    }),
  projectBudgetPlan: (projectId: string, data: HypothesisBudgetRequest) =>
    apiRequest<HypothesisBudgetResult>(`/admin/lab/projects/${projectId}/budget-plan`, {
      method: "POST",
      body: data,
    }),
  projectSchedule: (projectId: string, data: ValidationScheduleRequest) =>
    apiRequest<ValidationScheduleResult>(`/admin/lab/projects/${projectId}/schedule`, {
      method: "POST",
      body: data,
    }),
};
