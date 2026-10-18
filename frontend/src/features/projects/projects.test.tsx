import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { NewProjectPage } from "./NewProjectPage";
import { projectDetailRoute } from "./routes";
import { ProjectsPage } from "./ProjectsPage";
import type { IdeaAttribute, ProjectDetail } from "./types";

const NOW = "2026-09-24T10:00:00Z";

function attribute(overrides: Partial<IdeaAttribute>): IdeaAttribute {
  return {
    id: crypto.randomUUID(),
    attribute_type: "problem",
    value: "Valor",
    position: 0,
    origin: "user",
    is_confirmed: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "p1",
    title: "Agro Conecta",
    raw_idea: "Plataforma que conecta agricultores con restaurantes.",
    status: "draft",
    created_at: NOW,
    updated_at: NOW,
    attributes: [],
    structure: { ready: false, missing: ["problem", "solution", "customer_segment"], pending_suggestions: 0 },
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Nuevo proyecto", () => {
  it("valida en el cliente y, al crear, abre el detalle del proyecto", async () => {
    const fetchMock = mockFetch(
      apiRoutes([
        { method: "POST", path: "/api/v1/projects", respond: () => jsonResponse(201, project()) },
        { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, project()) },
      ]),
    );
    const router = renderRoutes(
      [
        { path: "/proyectos/nuevo", element: <NewProjectPage /> },
        projectDetailRoute,
      ],
      "/proyectos/nuevo",
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nombre del proyecto"), "  Agro Conecta ");
    await user.type(screen.getByLabelText("Tu idea"), "Muy corta");
    await user.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(screen.getByText("Describe tu idea con al menos 20 caracteres.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Tu idea"), " pero ahora ya es suficiente");
    await user.click(screen.getByRole("button", { name: "Crear proyecto" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/proyectos/p1"));
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, string>;
    expect(body.title).toBe("Agro Conecta");
  });
});

describe("Lista de proyectos", () => {
  it("el filtro por estado se refleja en la URL y en la consulta a la API", async () => {
    const fetchMock = mockFetch(
      apiRoutes([
        { path: "/api/v1/projects", respond: () => jsonResponse(200, { items: [], total: 0, limit: 12, offset: 0 }) },
      ]),
    );
    const router = renderRoutes([{ path: "/proyectos", element: <ProjectsPage /> }], "/proyectos");
    const user = userEvent.setup();

    await screen.findByText("Todavía no tienes proyectos");
    await user.click(screen.getByRole("button", { name: "Borrador" }));

    await waitFor(() => expect(router.state.location.search).toBe("?estado=draft"));
    expect(screen.getByRole("button", { name: "Borrador" })).toHaveAttribute("aria-pressed", "true");
    const lastUrl = String(fetchMock.mock.calls.at(-1)![0]);
    expect(lastUrl).toContain("status=draft");
  });
});

describe("Detalle del proyecto", () => {
  function renderDetail(detail: ProjectDetail, extraRoutes: Parameters<typeof apiRoutes>[0] = []) {
    const fetchMock = mockFetch(
      apiRoutes([{ path: "/api/v1/projects/p1", respond: () => jsonResponse(200, detail) }, ...extraRoutes]),
    );
    renderRoutes([projectDetailRoute], "/proyectos/p1");
    return fetchMock;
  }

  it("muestra qué falta y no deja confirmar la estructura incompleta", async () => {
    renderDetail(
      project({
        attributes: [attribute({ attribute_type: "problem", value: "Intermediarios caros" })],
        structure: { ready: false, missing: ["solution", "customer_segment"], pending_suggestions: 0 },
      }),
    );

    expect(await screen.findByText("Intermediarios caros")).toBeInTheDocument();
    const required = screen.getByRole("list", { name: "Atributos obligatorios" });
    expect(within(required).getByText("(confirmado)")).toBeInTheDocument();
    expect(within(required).getAllByText("(pendiente)")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Confirmar estructura" })).toBeDisabled();
  });

  it("confirma la estructura cuando está lista", async () => {
    const ready = project({ structure: { ready: true, missing: [], pending_suggestions: 0 } });
    const fetchMock = renderDetail(ready, [
      {
        method: "POST",
        path: "/api/v1/projects/p1/confirm-structure",
        respond: () => jsonResponse(200, { ...ready, status: "structured" }),
      },
    ]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Confirmar estructura" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/confirm-structure") && init?.method === "POST")).toBe(true),
    );
  });

  it("distingue las sugerencias de IA y permite confirmarlas", async () => {
    const suggestion = attribute({ id: "a1", attribute_type: "channels", value: "Redes sociales", origin: "ai", is_confirmed: false });
    const fetchMock = renderDetail(project({ attributes: [suggestion] }), [
      {
        method: "PATCH",
        path: "/api/v1/projects/p1/attributes/a1",
        respond: () => jsonResponse(200, { ...suggestion, is_confirmed: true }),
      },
    ]);
    const user = userEvent.setup();

    const channels = await screen.findByRole("region", { name: "Canales" });
    expect(within(channels).getByText("Sugerencia de IA · pendiente")).toBeInTheDocument();
    await user.click(within(channels).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(JSON.parse(patch![1]!.body as string)).toEqual({ is_confirmed: true });
    });
  });

  it("muestra 'no encontrado' si el proyecto no existe o es de otro usuario", async () => {
    mockFetch(() => jsonResponse(404, { error: { code: "project_not_found", message: "El proyecto no existe." } }));
    renderRoutes([projectDetailRoute], "/proyectos/p1");
    expect(await screen.findByText("Proyecto no encontrado")).toBeInTheDocument();
  });
});
