import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { ResearchRun } from "../research/types";
import type { Competitor, Entity, Finding } from "./types";

const NOW = "2026-09-24T10:00:00Z";

const PROJECT: ProjectDetail = {
  id: "p1",
  title: "Agro Conecta",
  raw_idea: "Plataforma que conecta agricultores con restaurantes.",
  status: "researching",
  created_at: NOW,
  updated_at: NOW,
  attributes: [],
  structure: { ready: true, missing: [], pending_suggestions: 0 },
};

const RUN: ResearchRun = {
  id: "r1",
  status: "completed",
  current_step: null,
  progress_pct: 100,
  ai_provider: "gemini",
  ai_model: "gemini-x",
  error_code: null,
  error_message: null,
  started_at: NOW,
  finished_at: NOW,
  created_at: NOW,
};

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    run_id: "r1",
    origin: "ai",
    review_status: "proposed",
    finding_type: "competition",
    statement: "Existen tres marketplaces agrícolas en la ciudad.",
    confidence_level: "medium",
    confidence_rationale: "Nivel limitado a 'media' por reglas: solo una fuente independiente la respalda.",
    created_at: NOW,
    updated_at: NOW,
    evidence: [
      {
        evidence_id: "e1",
        stance: "supports",
        content: "Hay tres plataformas activas",
        source: { id: "s1", url: "https://example.com/a", domain: "example.com", title: "Informe", source_type: "news" },
      },
    ],
    entities: [{ id: "n1", name: "AgroYa", entity_type: "company" }],
    ...overrides,
  };
}

function competitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: "c1",
    entity: { id: "n1", entity_type: "company", name: "AgroYa", website: "javascript:alert(1)", description: null },
    competitor_type: "direct",
    threat_level: "medium",
    rationale: "Vende a los mismos restaurantes.",
    origin: "ai",
    review_status: "proposed",
    run_id: "r1",
    finding_count: 2,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function render(path: string, routes: Parameters<typeof apiRoutes>[0]) {
  const fetchMock = mockFetch(
    apiRoutes([
      { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
      { path: "/api/v1/projects/p1/research-runs", respond: () => jsonResponse(200, [RUN]) },
      ...routes,
    ]),
  );
  renderRoutes([projectDetailRoute], path);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, method: string) =>
  JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === method)![1]!.body as string) as unknown;

afterEach(() => vi.unstubAllGlobals());

describe("Pestaña de hallazgos", () => {
  it("muestra los hallazgos de la última investigación con su evidencia y permite aceptarlos", async () => {
    const fetchMock = render("/proyectos/p1/hallazgos", [
      { path: "/api/v1/projects/p1/findings", respond: () => jsonResponse(200, [finding()]) },
      {
        method: "PATCH",
        path: "/api/v1/projects/p1/findings/f1",
        respond: () => jsonResponse(200, finding({ review_status: "accepted" })),
      },
    ]);
    const user = userEvent.setup();

    const card = await screen.findByRole("article", { name: "Existen tres marketplaces agrícolas en la ciudad." });
    expect(within(card).getByText("Confianza media")).toBeInTheDocument();
    expect(within(card).getByText("Propuesto por la IA · sin revisar")).toBeInTheDocument();
    expect(within(card).getByText(/limitado a 'media'/)).toBeInTheDocument();
    expect(within(card).getByText("«Hay tres plataformas activas»")).toBeInTheDocument();
    expect(within(card).getByText("Respalda")).toBeInTheDocument();
    // Los hallazgos de la IA no se borran (solo se rechazan).
    expect(within(card).queryByRole("button", { name: "Eliminar hallazgo" })).not.toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("findings?run_id=r1"))).toBe(true),
    );
    await user.click(within(card).getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(bodyOf(fetchMock, "PATCH")).toEqual({ review_status: "accepted" }));
  });

  it("crea un hallazgo propio validando el formulario", async () => {
    const fetchMock = render("/proyectos/p1/hallazgos", [
      { path: "/api/v1/projects/p1/findings", respond: () => jsonResponse(200, []) },
      {
        method: "POST",
        path: "/api/v1/projects/p1/findings",
        respond: () => jsonResponse(201, finding({ id: "f2", origin: "user", review_status: "accepted", evidence: [] })),
      },
    ]);
    const user = userEvent.setup();

    expect(await screen.findByText("No hay hallazgos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuevo hallazgo" }));
    await user.click(screen.getByRole("button", { name: "Guardar hallazgo" }));
    expect(screen.getByText("Escribe el hallazgo.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Categoría", { selector: "form select" }), "pricing");
    await user.type(screen.getByLabelText("Hallazgo"), "  Pagan 20 % más a intermediarios ");
    await user.click(screen.getByRole("button", { name: "Guardar hallazgo" }));

    await waitFor(() =>
      expect(bodyOf(fetchMock, "POST")).toEqual({
        finding_type: "pricing",
        statement: "Pagan 20 % más a intermediarios",
        confidence_level: "undetermined",
        confidence_rationale: "",
      }),
    );
  });

  it("los hallazgos del usuario se identifican y se pueden eliminar", async () => {
    render("/proyectos/p1/hallazgos", [
      {
        path: "/api/v1/projects/p1/findings",
        respond: () => jsonResponse(200, [finding({ origin: "user", review_status: "accepted", evidence: [] })]),
      },
    ]);
    const card = await screen.findByRole("article");
    expect(within(card).getByText("Aportado por el usuario")).toBeInTheDocument();
    expect(within(card).getByText("Sin evidencia vinculada.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Eliminar hallazgo" })).toBeInTheDocument();
  });
});

describe("Pestaña de competidores", () => {
  it("agrupa por tipo, marca el análisis de la IA y permite reclasificar", async () => {
    const entities: Entity[] = [
      { id: "n1", entity_type: "company", name: "AgroYa", website: null, description: null, finding_count: 2, competitor_id: "c1" },
      { id: "n2", entity_type: "organization", name: "Cámara Agrícola", website: null, description: null, finding_count: 1, competitor_id: null },
    ];
    const fetchMock = render("/proyectos/p1/competidores", [
      { path: "/api/v1/projects/p1/competitors", respond: () => jsonResponse(200, [competitor()]) },
      { path: "/api/v1/projects/p1/entities", respond: () => jsonResponse(200, entities) },
      {
        method: "PATCH",
        path: "/api/v1/projects/p1/competitors/c1",
        respond: () => jsonResponse(200, competitor({ threat_level: "high", origin: "user" })),
      },
      {
        method: "POST",
        path: "/api/v1/projects/p1/competitors",
        respond: () => jsonResponse(201, competitor({ id: "c2" })),
      },
    ]);
    const user = userEvent.setup();

    const group = await screen.findByRole("region", { name: /Competidores directos/ });
    const card = within(group).getByRole("article", { name: "AgroYa" });
    expect(within(card).getByText("Análisis de la IA (interpretación, no un hecho)")).toBeInTheDocument();
    // Una URL no http(s) nunca se muestra como enlace.
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();

    await user.selectOptions(within(card).getByLabelText("Nivel de amenaza de AgroYa"), "high");
    await waitFor(() => expect(bodyOf(fetchMock, "PATCH")).toEqual({ threat_level: "high" }));

    const others = screen.getByRole("region", { name: "Otras entidades mencionadas" });
    await user.selectOptions(within(others).getByLabelText("Tipo de competidor para Cámara Agrícola"), "indirect");
    await user.click(within(others).getByRole("button", { name: "Marcar como competidor" }));
    await waitFor(() => expect(bodyOf(fetchMock, "POST")).toEqual({ entity_id: "n2", competitor_type: "indirect" }));
  });
});
