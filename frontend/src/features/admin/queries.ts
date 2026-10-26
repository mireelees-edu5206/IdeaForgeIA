import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminApi } from "./api";
import type {
  AdminUserUpdate,
  HypothesisBudgetRequest,
  LabPlaceSearchRequest,
  LabRouteRequest,
  TraceAlgorithm,
  ValidationScheduleRequest,
} from "./types";

export const adminKeys = {
  all: ["admin"] as const,
  overview: () => [...adminKeys.all, "overview"] as const,
  users: () => [...adminKeys.all, "users"] as const,
  labMetrics: (days: number) => [...adminKeys.all, "lab", "metrics", days] as const,
  labPropositions: () => [...adminKeys.all, "lab", "propositions"] as const,
  labProjects: () => [...adminKeys.all, "lab", "projects"] as const,
  projectTrace: (projectId: string | null) =>
    [...adminKeys.all, "lab", "trace", projectId] as const,
};

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: adminApi.overview,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: adminApi.listUsers,
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminUserUpdate }) =>
      adminApi.updateUser(userId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useAdminLabMetrics(days: number) {
  return useQuery({
    queryKey: adminKeys.labMetrics(days),
    queryFn: () => adminApi.labMetrics(days),
  });
}

export function useAdminLabPropositions() {
  return useQuery({
    queryKey: adminKeys.labPropositions(),
    queryFn: adminApi.labPropositions,
  });
}

export function useAdminLabProjects() {
  return useQuery({
    queryKey: adminKeys.labProjects(),
    queryFn: adminApi.labProjects,
  });
}

export function useAdminProjectTrace(projectId: string | null) {
  return useQuery({
    queryKey: adminKeys.projectTrace(projectId),
    queryFn: () => adminApi.projectTrace(projectId!),
    enabled: projectId !== null,
  });
}

export function useSearchProjectTrace() {
  return useMutation({
    mutationFn: ({
      projectId,
      algorithm,
      targetNodeId,
    }: {
      projectId: string;
      algorithm: TraceAlgorithm;
      targetNodeId: string;
    }) => adminApi.projectTracePath(projectId, algorithm, targetNodeId),
  });
}

export function useSearchProjectPlaces() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: LabPlaceSearchRequest;
    }) => adminApi.projectPlaces(projectId, data),
  });
}

export function useOptimizeProjectRoute() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: LabRouteRequest;
    }) => adminApi.projectRoute(projectId, data),
  });
}

export function usePlanHypothesisBudget() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: HypothesisBudgetRequest;
    }) => adminApi.projectBudgetPlan(projectId, data),
  });
}

export function useScheduleProjectValidation() {
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: ValidationScheduleRequest;
    }) => adminApi.projectSchedule(projectId, data),
  });
}
