import { ApiError } from "./apiClient";

/** Errores de validación del backend indexados por campo. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
}

export function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
