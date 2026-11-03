/**
 * ARCHIVO: frontend/src/lib/queryClient.ts
 *
 * ¿Qué es?
 * La configuración de la caché de datos de la aplicación (TanStack Query). La caché guarda lo que
 * llega del servidor (proyectos, hallazgos, informes...) para no volver a pedirlo a cada rato.
 *
 * ¿Para qué sirve?
 * Define tres reglas generales que aplican a TODAS las consultas de la app:
 * 1. staleTime: 30 segundos. Durante ese tiempo, un dato se considera fresco y no se vuelve a pedir.
 * 2. retry: cuántas veces reintentar una consulta que falló.
 * 3. Los errores 4xx (que el cliente hizo algo mal, por ejemplo un formulario inválido) no se reintentan,
 *    porque repetir la misma petición daría el mismo error.
 *
 * ¿Quién lo usa?
 * app/App.tsx crea la instancia con createQueryClient() y la entrega a QueryClientProvider.
 */
import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./apiClient";

/**
 * Crea y devuelve una caché nueva con las reglas de la app.
 *
 * Se llama una sola vez (desde App.tsx), así que hay una caché por cada vez que se abre la página.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Solo aplica a las consultas de lectura (queries), no a las escrituras (mutations).
      queries: {
        // 30_000 milisegundos = 30 segundos. El guion bajo solo hace más legible el número.
        staleTime: 30_000,
        // No reintentar errores del cliente (4xx): repetirlos no cambia el resultado.
        // Sí reintentar otros fallos (red, servidor caído), pero como máximo 2 veces (failureCount < 2).
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}
