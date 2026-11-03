/**
 * ARCHIVO: frontend/src/test/fetchMock.ts
 *
 * ¿Qué es?
 * Herramientas para simular las respuestas HTTP en las pruebas de componentes.
 *
 * ¿Para qué sirve?
 * - jsonResponse: crea una respuesta falsa con un código de estado y un cuerpo en JSON.
 * - mockFetch: reemplaza fetch (la función del navegador que hace peticiones) por una función de prueba.
 *   Así la prueba controla qué responde "el servidor" y puede revisar cuántas veces se llamó.
 * - authHeader: lee el encabezado de autorización de una petición, para comprobar que se envió el token.
 *
 * ¿Quién lo usa?
 * Las pruebas de pantallas que hacen peticiones (formularios, listas, acciones).
 */
import { vi } from "vitest";

/**
 * Crea una respuesta HTTP falsa.
 *
 * @param status Código HTTP, por ejemplo 200 (ok), 404 (no existe) o 422 (datos inválidos).
 * @param body Datos que se devuelven como JSON. Si no se indica, la respuesta no tiene cuerpo.
 */
export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Función que recibe la dirección y las opciones de una petición, y devuelve una respuesta. */
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/**
 * Sustituye fetch global por una función de prueba.
 *
 * Devuelve un mock (un espía de Vitest) que registra cada llamada. La prueba puede usarlo para
 * comprobar, por ejemplo, que se mandó un POST con los datos correctos.
 *
 * Nota: hay que restaurar el fetch real al terminar la prueba (vi.unstubAllGlobals).
 */
export function mockFetch(handler: Handler) {
  const mock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    // Convierte la dirección a texto y envuelve la respuesta en una promesa, como hace fetch de verdad.
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

/**
 * Lee el encabezado Authorization de una petición (por ejemplo, "Bearer abc...").
 * Sirve para comprobar que la app envía el token de sesión. Si no hay encabezado, devuelve undefined.
 */
export function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}
