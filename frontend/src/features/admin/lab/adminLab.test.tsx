import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLabPage } from "./AdminLabPage";

const hooks = vi.hoisted(() => ({
  tracePathMutate: vi.fn(),
  placesMutate: vi.fn(),
  routeMutate: vi.fn(),
  budgetMutate: vi.fn(),
  scheduleMutate: vi.fn(),
  geocodeMutateAsync: vi.fn(),
}));

const traceGraph = {
  project_id: "p1",
  project_title: "Heladería local",
  root_id: "project:p1",
  truncated: false,
  nodes: [
    { id: "project:p1", label: "Heladería local", kind: "project", details: {} },
    { id: "attribute:a1", label: "problem: Precios altos", kind: "attribute", details: {} },
    {
      id: "hypothesis:h1",
      label: "Los vecinos pagan por el producto.",
      kind: "hypothesis",
      details: { priority: "high", validation_method: "encuesta" },
    },
  ],
  edges: [
    { source: "project:p1", target: "attribute:a1", relation: "contiene atributo" },
    { source: "project:p1", target: "hypothesis:h1", relation: "contiene elemento de análisis" },
  ],
};

vi.mock("../queries", () => ({
  useAdminLabProjects: () => ({
    isPending: false,
    isError: false,
    data: {
      projects: [
        {
          id: "p1",
          title: "Heladería local",
          status: "analyzed",
          owner_name: "Ana Pérez",
          geographic_scope: "Toluca Centro",
        },
      ],
    },
  }),
  useAdminLabMetrics: () => ({
    isPending: false,
    isError: false,
    data: {
      days: 2,
      points: [
        {
          day: "2026-10-18",
          calls: 4,
          success_calls: 3,
          error_calls: 1,
          avg_latency_ms: 1500,
          input_tokens: 800,
          output_tokens: 600,
        },
        {
          day: "2026-10-19",
          calls: 6,
          success_calls: 6,
          error_calls: 0,
          avg_latency_ms: 1200,
          input_tokens: 900,
          output_tokens: 700,
        },
      ],
    },
  }),
  useAdminProjectTrace: () => ({ isFetching: false, isError: false, data: traceGraph }),
  useSearchProjectTrace: () => ({
    mutate: hooks.tracePathMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useSearchProjectPlaces: () => ({
    mutate: hooks.placesMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useOptimizeProjectRoute: () => ({
    mutate: hooks.routeMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
  usePlanHypothesisBudget: () => ({
    mutate: hooks.budgetMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
  useScheduleProjectValidation: () => ({
    mutate: hooks.scheduleMutate,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    data: undefined,
  }),
}));

vi.mock("../../geo/queries", () => ({
  useGeocode: () => ({ mutateAsync: hooks.geocodeMutateAsync, isPending: false, data: [] }),
}));

vi.mock("../../geo/GeoMap", () => ({
  GeoMap: () => <div data-testid="geo-map" />,
}));

describe("Laboratorio aplicado al proyecto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el proyecto real, métricas y el acceso al apartado lógico", async () => {
    render(
      <MemoryRouter>
        <AdminLabPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Análisis del proyecto" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Heladería local").length).toBeGreaterThan(0);
    expect(screen.getByText(/Toluca Centro/)).toBeInTheDocument();
    const callsChart = screen.getByRole("img", { name: "Llamadas y errores de IA por día" });
    const tokensChart = screen.getByRole("img", { name: "Tokens de entrada y salida por día" });
    expect(callsChart.querySelector("rect")).toBeInTheDocument();
    expect(tokensChart.querySelector("polyline")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Proposiciones y tablas" }),
    ).toHaveAttribute("href", "/admin/laboratorio/proposiciones");
  });

  it("envía la búsqueda BFS sobre el grafo de trazabilidad real", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminLabPage />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "Buscar trazabilidad" });
    await user.selectOptions(
      screen.getByLabelText("Buscar camino desde el proyecto hasta"),
      "hypothesis:h1",
    );
    await user.click(screen.getByRole("button", { name: "Buscar trazabilidad" }));

    expect(hooks.tracePathMutate).toHaveBeenCalledWith({
      projectId: "p1",
      algorithm: "bfs",
      targetNodeId: "hypothesis:h1",
    });
  });

  it("usa hipótesis reales del proyecto para el plan de presupuesto", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminLabPage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getAllByRole("checkbox", { name: "Los vecinos pagan por el producto." })[0]!,
    );
    await user.type(await screen.findByRole("spinbutton", { name: /Costo estimado/ }), "400");
    await user.type(await screen.findByRole("spinbutton", { name: /Valor esperado/ }), "80");
    await user.click(screen.getByRole("button", { name: "Priorizar hipótesis" }));

    expect(hooks.budgetMutate).toHaveBeenCalledWith({
      projectId: "p1",
      data: {
        budget: 10000,
        algorithm: "hill_climbing",
        items: [{ hypothesis_id: "h1", estimated_cost: 400, expected_value: 80 }],
      },
    });
  });
});
