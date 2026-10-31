/**
 * ARCHIVO: reports/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" de los informes: guarda la lista y cada informe ya pedidos, y los actualiza
 * solos mientras un informe se está generando.
 *
 * ¿Para qué sirve?
 * - useReports: la lista de informes del proyecto. Se vuelve a pedir cada 2 segundos mientras
 *   algún informe esté "generando".
 * - useReport: un informe concreto con sus apartados. Se vuelve a pedir cada 2 segundos mientras
 *   ese informe esté "generando". Si no hay informe elegido, no pide nada ("enabled").
 * - useCreateReport: pide generar un informe nuevo y, al terminar, refresca la lista.
 *
 * ¿Quién lo usa?
 * ReportsTab.tsx.
 *
 * Palabras clave:
 * - "queryKey" es el nombre con el que se guarda un dato en la memoria.
 * - "refetchInterval" es cada cuántos milisegundos se vuelve a pedir el dato (2000 = 2 segundos).
 */

/* "useMutation" maneja acciones que cambian datos. "useQuery" pide y guarda. "useQueryClient" da acceso a la memoria. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* La memoria del proyecto: los informes cuelgan del detalle del proyecto. */
import { projectKeys } from "../projects/queries";
/* Las peticiones al servidor. */
import { reportsApi } from "./api";
/* El tipo de cada zona que se manda al crear un informe. */
import type { GeographicScopeInput } from "./types";

/**
 * reportKeys son los nombres de la memoria para informes.
 * list es la lista del proyecto. detail es un informe concreto, con su propio nombre (su id al final).
 */
/** Define report keys como dato o funcion publica de reports. */
export const reportKeys = {
  list: (projectId: string) => [...projectKeys.detail(projectId), "reports"] as const,
  detail: (projectId: string, reportId: string) =>
    [...reportKeys.list(projectId), reportId] as const,
};

/**
 * useReports pide la lista de informes del proyecto.
 *
 * "refetchInterval" recibe una función que mira los datos ya guardados: si alguno está "generando",
 * vuelve a pedir la lista cada 2000 milisegundos; si no, no vuelve a pedirla sola.
 * "query.state.data?.some(...)" revisa la lista guardada; el "?" evita errores si todavía no hay datos.
 */
/** Expone la funcion use reports para el flujo de reports. */
export function useReports(projectId: string) {
  return useQuery({
    queryKey: reportKeys.list(projectId),
    queryFn: () => reportsApi.list(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((report) => report.status === "generating") ? 2000 : false,
  });
}

/**
 * useReport pide un informe concreto. Si reportId es null (no hay informe elegido), no hace la petición.
 * El "!" en reportId! le dice a TypeScript que aquí ya es seguro que no sea null, porque "enabled" lo evita.
 */
/** Expone la funcion use report para el flujo de reports. */
export function useReport(projectId: string, reportId: string | null) {
  return useQuery({
    // Si no hay id, usamos texto vacío solo para completar el nombre (no se usa porque "enabled" es false).
    queryKey: reportKeys.detail(projectId, reportId ?? ""),
    queryFn: () => reportsApi.get(projectId, reportId!),
    // Solo pide si hay un id de informe.
    enabled: Boolean(reportId),
    // Mientras este informe esté "generando", vuelve a pedirlo cada 2 segundos.
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 2000 : false,
  });
}

/**
 * useCreateReport pide generar un informe nuevo con las zonas dadas. Al terminar bien, refresca
 * la lista de informes para que aparezca el nuevo (y empiece a actualizarse solo).
 */
/** Expone la funcion use create report para el flujo de reports. */
export function useCreateReport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (geographicScopes: GeographicScopeInput[]) => reportsApi.create(projectId, geographicScopes),
    // Al terminar, marca la lista como vieja para que se vuelva a pedir.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: reportKeys.list(projectId) }),
  });
}
