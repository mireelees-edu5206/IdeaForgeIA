/** Simula respuestas HTTP para pruebas de componentes. */
import { vi } from "vitest";

/** Expone la funcion json response para el flujo de shared frontend. */
export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Contrato de datos Handler utilizado por aplicacion. */
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Sustituye fetch por un manejador; devuelve el mock para inspeccionar llamadas. */
export function mockFetch(handler: Handler) {
  const mock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Expone la funcion auth header para el flujo de shared frontend. */
export function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}
