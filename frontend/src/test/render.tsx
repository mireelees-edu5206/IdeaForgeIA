import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { type RouteObject, RouterProvider, createMemoryRouter } from "react-router";

/** Renderiza rutas con React Query (sin reintentos) y un router en memoria. */
export function renderRoutes(routes: RouteObject[], initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

interface Route {
  method?: string;
  path: string | RegExp;
  respond: (init: RequestInit, url: URL) => Response | Promise<Response>;
}

/** Router de fetch para tests: responde según método y ruta; 404 si no hay coincidencia. */
export function apiRoutes(routes: Route[]) {
  return (rawUrl: string, init: RequestInit) => {
    const url = new URL(rawUrl, "http://localhost");
    const method = init.method ?? "GET";
    const route = routes.find(
      (r) =>
        (r.method ?? "GET") === method &&
        (typeof r.path === "string" ? url.pathname === r.path : r.path.test(url.pathname)),
    );
    return route ? route.respond(init, url) : new Response(null, { status: 404 });
  };
}
