/** Configura la instancia compartida de TanStack Query. */
import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./apiClient";

/** Expone la funcion create query client para el flujo de shared frontend. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // No reintentar errores del cliente (4xx): repetirlos no cambia el resultado.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}
