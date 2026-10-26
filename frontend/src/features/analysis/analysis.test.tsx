import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { ResearchRun } from "../research/types";
import type { Finding } from "../findings/types";
import type { AnalysisOverview, Opportunity, Risk } from "./types";

const NOW = "2026-10-01T10:00:00Z";
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
const FINDING: Finding = {
  id: "f1",
  run_id: "r1",
  origin: "ai",
  review_status: "accepted",
  finding_type: "market",
  statement: "Los restaurantes locales compran a productores varias veces al mes.",
  confidence_level: "medium",
  confidence_rationale: null,
  created_at: NOW,
  updated_at: NOW,
  evidence: [
    {
      evidence_id: "e1",
      stance: "supports",
      content: "Los restaurantes realizan pedidos recurrentes.",
      source: { id: "s1", url: "https://fuente.example/informe", domain: "fuente.example", title: "Informe sectorial", source_type: "academic" },
    },
  ],
  entities: [],
};
const OPPORTUNITY: Opportunity = {
  id: "o1",
  run_id: "r1",
  origin: "ai",
  review_status: "proposed",
  created_at: NOW,
  updated_at: NOW,
  findings: [{ id: "f1", finding_type: "market", statement: FINDING.statement, confidence_level: "medium", review_status: "accepted" }],
  title: "Pedidos recurrentes",
  description: "La frecuencia de compra podría favorecer una relación comercial continua.",
  potential: "medium",
};
const OVERVIEW: AnalysisOverview = {
  opportunities: [OPPORTUNITY],
  risks: [],
  hypotheses: [],
  missing_information: [],
};

function render(routes: Parameters<typeof apiRoutes>[0]) {
  const fetchMock = mockFetch(
    apiRoutes([
      { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
      { path: "/api/v1/projects/p1/research-runs", respond: () => jsonResponse(200, [RUN]) },
      { path: "/api/v1/projects/p1/findings", respond: () => jsonResponse(200, [FINDING]) },
      { path: "/api/v1/projects/p1/analysis", respond: () => jsonResponse(200, OVERVIEW) },
      ...routes,
    ]),
  );
  renderRoutes([projectDetailRoute], "/proyectos/p1/analisis");
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, method: string) =>
  JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === method)![1]!.body as string) as unknown;

afterEach(() => vi.unstubAllGlobals());

describe("Pestaña de análisis", () => {
  it("muestra una oportunidad como interpretación y enlaza el hallazgo con su fuente", async () => {
    render([]);
    const card = await screen.findByRole("article", { name: OPPORTUNITY.title });

    expect(within(card).getByText("Sugerencia de IA · revisa las fuentes antes de aceptarla")).toBeInTheDocument();
    expect(within(card).getByText(FINDING.statement)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Informe sectorial/ })).toHaveAttribute("href", "https://fuente.example/informe");
  });

  it("crea un riesgo manual y conserva el vínculo al hallazgo seleccionado", async () => {
    const created: Risk = {
      id: "risk1",
      run_id: null,
      origin: "user",
      review_status: "accepted",
      created_at: NOW,
      updated_at: NOW,
      findings: [{ id: "f1", finding_type: "market", statement: FINDING.statement, confidence_level: "medium", review_status: "accepted" }],
      title: "Dependencia logística",
      description: "El transporte puede elevar los costos de entrega.",
      category: "operational",
      likelihood: "medium",
      impact: "high",
      mitigation: "Validar un proveedor regional.",
    };
    const fetchMock = render([
      {
        method: "POST",
        path: "/api/v1/projects/p1/risks",
        respond: () => jsonResponse(201, created),
      },
    ]);
    const user = userEvent.setup();

    await screen.findByRole("article", { name: OPPORTUNITY.title });
    const section = screen.getByRole("region", { name: /Riesgos/ });
    await user.click(within(section).getByRole("button", { name: "Añadir" }));
    await user.type(screen.getByLabelText("Riesgo"), "Dependencia logística");
    await user.type(screen.getByLabelText("Descripción / interpretación"), "El transporte puede elevar los costos de entrega.");
    await user.selectOptions(screen.getByLabelText("Categoría"), "operational");
    await user.selectOptions(screen.getByLabelText("Probabilidad estimada"), "medium");
    await user.selectOptions(screen.getByLabelText("Impacto estimado"), "high");
    await user.click(screen.getByLabelText(FINDING.statement));
    await user.click(within(section).getByRole("button", { name: "Crear" }));

    await waitFor(() =>
      expect(bodyOf(fetchMock, "POST")).toEqual({
        title: "Dependencia logística",
        description: "El transporte puede elevar los costos de entrega.",
        category: "operational",
        likelihood: "medium",
        impact: "high",
        mitigation: null,
        finding_ids: ["f1"],
      }),
    );
  });
});
