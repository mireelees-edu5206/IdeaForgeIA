/**
 * ARCHIVO: frontend/src/lib/formErrors.ts
 *
 * ¿Qué es?
 * Dos funciones que traducen los errores que devuelve el servidor a algo que un formulario puede mostrar.
 *
 * ¿Para qué sirve?
 * Cuando el backend rechaza un formulario, manda una lista de detalles con el campo que falló y el mensaje.
 * - fieldErrorsFrom: convierte esa lista en un objeto { campo: mensaje }, para poner cada mensaje
 *   debajo de su campo.
 * - errorMessageFrom: saca un texto general para mostrar en una alerta cuando no hay un campo específico.
 *
 * ¿Quién lo usa?
 * Los formularios de login, registro, proyectos y atributos de la idea.
 */
import { ApiError } from "./apiClient";

/**
 * Convierte los detalles de error del servidor en un objeto por campo.
 *
 * Ejemplo: si el backend manda [{ field: "email", message: "Ya existe" }], la función devuelve
 * { email: "Ya existe" }.
 *
 * Si el error no viene del servidor (por ejemplo, un error de programación), devuelve un objeto vacío.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  // Solo los errores de la API traen detalles por campo. Cualquier otro error no tiene nada que mostrar.
  if (!(error instanceof ApiError)) return {};
  // Object.fromEntries arma el objeto a partir de pares [campo, mensaje].
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
}

/**
 * Devuelve un texto legible para cualquier error, listo para mostrar en una alerta.
 *
 * Prioridad:
 * 1. Si el error es de la API, usa el mensaje que mandó el servidor.
 * 2. Si es otro error de JavaScript, usa su mensaje.
 * 3. Si no es ninguno de los dos, usa un texto genérico en español.
 */
export function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
