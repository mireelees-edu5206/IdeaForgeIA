/** Pruebas de regresion para el flujo de graficas. */
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import type { Competitor, Finding } from "../findings/types";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { Source } from "../research/types";

/** Define NOW para el bloque de graficas. */
const NOW = "2026-10-01T10:00:00Z";
/** Define PROJECT para el bloque de graficas. */
const PROJECT: ProjectDetail = {
  id: "p1",
  title: "La Michoacana",
  raw_idea: "Una propuesta de negocio local para clientes de Michoacán.",
  status: "researching",
  created_at: NOW,
  updated_at: NOW,
  attributes: [],
  structure: { ready: true, missing: [], pending_suggestions: 0 },
};

/** Gestiona finding de graficas. */
function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    run_id: "r1",
    origin: "ai",
    review_status: "accepted",
    finding_type: "market",
    statement: "Existe demanda local.",
    confidence_level: "medium",
    confidence_rationale: null,
    created_at: NOW,
    updated_at: NOW,
    evidence: [],
    entities: [],
    ...overrides,
  };
}

/** Gestiona competitor de graficas. */
function competitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: "c1",
    entity: { id: "e1", entity_type: "company", name: "Dulces La Plaza", website: null, description: null },
    competitor_type: "direct",
    threat_level: "medium",
    rationale: null,
    origin: "user",
    review_status: "accepted",
    run_id: null,
    finding_count: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

/** Define SOURCE para el bloque de graficas. */
const SOURCE: Source = {
  id: "s1",
  url: "https://ejemplo.test/noticia",
  domain: "ejemplo.test",
  title: "Nota del sector",
  source_type: "news",
  created_at: NOW,
  citation_count: 1,
  evidence_count: 1,
};
/** Define SOURCE_AUGUST para el bloque de graficas. */
const SOURCE_AUGUST: Source = {
  ...SOURCE,
  id: "s2",
  url: "https://ejemplo.test/estudio",
  domain: "ejemplo.test",
  title: "Estudio del sector",
  source_type: "academic",
  created_at: "2026-08-15T10:00:00Z",
};

/** Renderiza render de graficas. */
function render(findings: Finding[], competitors: Competitor[] = [], sources: Source[] = []) {
  mockFetch(
    apiRoutes([
      { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
      { path: "/api/v1/projects/p1/findings", respond: () => jsonResponse(200, findings) },
      { path: "/api/v1/projects/p1/competitors", respond: () => jsonResponse(200, competitors) },
      { path: "/api/v1/projects/p1/sources", respond: () => jsonResponse(200, sources) },
    ]),
  );
  renderRoutes([projectDetailRoute], "/proyectos/p1/visualizaciones");
}

afterEach(() => vi.unstubAllGlobals());

/** Escenario de prueba: Visualizaciones del proyecto. */
describe("Visualizaciones del proyecto", () => {
  /** Escenario de prueba: resume hallazgos, alternativas, fuentes y actividad del proyecto abierto. */
  it("resume hallazgos, alternativas, fuentes y actividad del proyecto abierto", async () => {
    render(
      [
        finding(),
        finding({ id: "f2", finding_type: "competition", review_status: "proposed" }),
        finding({ id: "f3", finding_type: "competition", review_status: "rejected" }),
      ],
      [competitor(), competitor({ id: "c2", competitor_type: "indirect", review_status: "rejected" })],
      [SOURCE, SOURCE_AUGUST],
    );

    expect(await screen.findByRole("heading", { name: "Visualizaciones del proyecto" })).toBeInTheDocument();

    const categories = screen.getByRole("region", { name: "Temas que aparecen" });
    expect(within(categories).getByText("Mercado").closest("li")).toHaveTextContent("Mercado1");
    expect(within(categories).getByText("Competencia").closest("li")).toHaveTextContent("Competencia2");
    expect(screen.getByRole("region", { name: "Alternativas encontradas" })).toHaveTextContent("Muy parecida1");
    expect(screen.getByRole("region", { name: "De dónde viene la información" })).toHaveTextContent("Noticia1");
    expect(screen.getByRole("region", { name: "Fuentes consultadas con el tiempo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Fuentes consultadas por mes/ })).toBeInTheDocument();

    expect(
      screen.getByRole("img", {
        name: "Distribución de revisión: Aceptado 1, Sin revisar 1, Rechazado 1",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("resultados")).toBeInTheDocument();
  });

  /** Escenario de prueba: muestra los gráficos vacíos cuando el proyecto todavía no tiene hallazgos. */
  it("muestra los gráficos vacíos cuando el proyecto todavía no tiene hallazgos", async () => {
    render([]);

    expect(await screen.findByText("Aún no hay datos para graficar")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Temas que aparecen" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alternativas encontradas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "De dónde viene la información" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Distribución de revisión: Aceptado 0, Sin revisar 0, Rechazado 0",
      }),
    ).toBeInTheDocument();
  });
});
