/**
 * ARCHIVO: frontend/src/test/render.tsx
 *
 * ¿Qué es?
 * Dos herramientas para las pruebas de pantallas:
 * - renderRoutes: dibuja una pantalla con su router y su caché, como si estuviera dentro de la app real.
 * - apiRoutes: simula el backend. Recibe una lista de rutas falsas y responde según el método y la dirección.
 *
 * ¿Para qué sirve?
 * Para probar componentes sin depender del servidor real. Así las pruebas son rápidas y siempre
 * producen el mismo resultado.
 *
 * ¿Quién lo usa?
 * Los archivos *.test.tsx de cada feature (por ejemplo, las pruebas de proyectos o de administración).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { type RouteObject, RouterProvider, createMemoryRouter } from "react-router";

/**
 * Dibuja una pantalla de prueba con un router "en memoria" (no cambia la barra del navegador real).
 *
 * Diferencias con la app real:
 * - La caché no reintenta nunca: si una petición falla, la prueba ve el error al instante.
 * - initialPath indica la dirección con la que arranca la prueba, por ejemplo "/proyectos/123".
 *
 * Devuelve el router para que la prueba pueda revisar a qué dirección navegó.
 */
export function renderRoutes(routes: RouteObject[], initialPath: string) {
  // Caché nueva para esta prueba. "retry: false" evita que una prueba espere reintentos.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Router en memoria con la dirección inicial indicada.
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  // render() dibuja el árbol dentro de un contenedor virtual del DOM de la prueba.
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/**
 * Describe una ruta falsa del backend.
 *
 * - method: el método HTTP que debe coincidir ("GET" si no se indica).
 * - path: la dirección exacta (texto) o un patrón (expresión regular) que debe coincidir.
 * - respond: la función que devuelve la respuesta falsa. Recibe la petición y la URL ya analizada.
 */
interface Route {
  method?: string;
  path: string | RegExp;
  respond: (init: RequestInit, url: URL) => Response | Promise<Response>;
}

/**
 * Crea una función que hace el papel de fetch en las pruebas.
 *
 * Busca la primera ruta cuyo método y dirección coincidan. Si ninguna coincide, responde 404,
 * igual que un backend que no conoce esa dirección.
 *
 * Uso: vi.stubGlobal("fetch", apiRoutes([...])).
 */
export function apiRoutes(routes: Route[]) {
  return (rawUrl: string, init: RequestInit) => {
    // Si la dirección es relativa (por ejemplo "/api/v1/projects"), se le pone un dominio falso para poder analizarla.
    const url = new URL(rawUrl, "http://localhost");
    const method = init.method ?? "GET";
    // Busca la primera ruta que coincida en método y en dirección.
    const route = routes.find(
      (r) =>
        (r.method ?? "GET") === method &&
        (typeof r.path === "string" ? url.pathname === r.path : r.path.test(url.pathname)),
    );
    return route ? route.respond(init, url) : new Response(null, { status: 404 });
  };
}
