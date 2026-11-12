/**
 * ARCHIVO: admin/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" del área de administración: guarda lo que ya se pidió al servidor (cuentas,
 * métricas, grafos) para no volver a pedirlo sin necesidad, y lo refresca cuando algo cambia.
 *
 * ¿Para qué sirve?
 * - Consultas (useQuery): leen datos. Ejemplos: useAdminOverview, useAdminUsers, useAdminLabMetrics.
 * - Acciones (useMutation): cambian datos o piden un cálculo. Ejemplos: useUpdateAdminUser,
 *   useOptimizeProjectRoute.
 *
 * ¿Quién lo usa?
 * AdminPage.tsx y las pantallas del laboratorio (AdminLabPage.tsx y AdminLabLogicPage.tsx).
 *
 * Palabras clave:
 * - "queryKey" es el nombre con el que se guarda un dato en la memoria.
 * - "invalidate" significa "esto ya está viejo, vuelve a pedirlo".
 * - "mutation" es una acción que cambia datos o pide un cálculo al servidor.
 */

/* "useMutation" maneja acciones. "useQuery" pide y guarda. "useQueryClient" da acceso a la memoria. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* Las peticiones al servidor. */
import { adminApi } from "./api";
/* Las fichas de forma de lo que se pasa a cada función. */
import type {
  AdminUserUpdate,
  HypothesisBudgetRequest,
  LabPlaceSearchRequest,
  LabRouteRequest,
} from "./types";

/**
 * adminKeys son los nombres de la memoria del área de administración. Todos empiezan con "admin",
 * así que refrescar "adminKeys.all" refresca todo el panel de una vez.
 * Las funciones (como labMetrics) reciben datos extra (por ejemplo, los días) y los añaden al nombre,
 * para que cada consulta tenga su propio dato guardado.
 */
/** Define admin keys como dato o funcion publica de admin. */
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

/** useAdminOverview pide el resumen general de la plataforma. */
/** Expone la funcion use admin overview para el flujo de admin. */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: adminApi.overview,
  });
}

/** useAdminUsers pide la lista de cuentas registradas. */
/** Expone la funcion use admin users para el flujo de admin. */
export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: adminApi.listUsers,
  });
}

/**
 * useUpdateAdminUser cambia el rol o el estado de una cuenta. Al terminar bien, refresca TODO el panel
 * (resumen, cuentas, etc.), porque un cambio de cuenta también cambia los totales.
 * Recibe un objeto con el id de la cuenta (userId) y los campos a cambiar (data).
 */
/** Expone la funcion use update admin user para el flujo de admin. */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminUserUpdate }) =>
      adminApi.updateUser(userId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

/**
 * useDeleteAdminUser borra una cuenta de forma permanente. Al terminar bien, refresca todo el panel.
 * Recibe el id de la cuenta.
 */
/** Expone la funcion use delete admin user para el flujo de admin. */
export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

/** useAdminLabMetrics pide las métricas del laboratorio por día. "days" es cuántos días se consultan. */
/** Expone la funcion use admin lab metrics para el flujo de admin. */
export function useAdminLabMetrics(days: number) {
  return useQuery({
    queryKey: adminKeys.labMetrics(days),
    queryFn: () => adminApi.labMetrics(days),
  });
}

/** useAdminLabPropositions pide las reglas de lógica y el marco PEAS. */
/** Expone la funcion use admin lab propositions para el flujo de admin. */
export function useAdminLabPropositions() {
  return useQuery({
    queryKey: adminKeys.labPropositions(),
    queryFn: adminApi.labPropositions,
  });
}

/** useAdminLabProjects pide la lista de proyectos que el laboratorio puede analizar. */
/** Expone la funcion use admin lab projects para el flujo de admin. */
export function useAdminLabProjects() {
  return useQuery({
    queryKey: adminKeys.labProjects(),
    queryFn: adminApi.labProjects,
  });
}

/**
 * useAdminProjectTrace pide el grafo de relaciones de un proyecto.
 * Si projectId es null (no hay proyecto elegido), no hace la petición: "enabled" lo evita.
 * El "!" en projectId! le dice a TypeScript que aquí ya es seguro que no sea null.
 */
/** Expone la funcion use admin project trace para el flujo de admin. */
export function useAdminProjectTrace(projectId: string | null) {
  return useQuery({
    queryKey: adminKeys.projectTrace(projectId),
    queryFn: () => adminApi.projectTrace(projectId!),
    enabled: projectId !== null,
  });
}

/**
 * useSearchProjectTrace busca el camino con menos pasos (BFS) en el grafo. Recibe el proyecto y el
 * nodo de destino. Es una acción (no guarda datos en la memoria), por eso usa useMutation.
 */
/** Expone la funcion use search project trace para el flujo de admin. */
export function useSearchProjectTrace() {
  return useMutation({
    mutationFn: ({ projectId, targetNodeId }: { projectId: string; targetNodeId: string }) =>
      adminApi.projectTracePath(projectId, targetNodeId),
  });
}

/** useSearchProjectPlaces busca lugares reales cerca de una zona. Recibe el proyecto y los datos de la búsqueda. */
/** Expone la funcion use search project places para el flujo de admin. */
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

/** useOptimizeProjectRoute calcula la ruta de visita entre los lugares elegidos. */
/** Expone la funcion use optimize project route para el flujo de admin. */
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

/** usePlanHypothesisBudget calcula qué hipótesis conviene validar con un presupuesto. */
/** Expone la funcion use plan hypothesis budget para el flujo de admin. */
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
