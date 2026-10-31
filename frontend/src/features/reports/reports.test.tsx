/** Pruebas de regresion para el flujo de informes. */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { Report, ReportDetail, ReportListItem } from "./types";

/** Define NOW para el bloque de informes. */
const NOW = "2026-10-15T10:00:00Z";
/** Define PROJECT para el bloque de informes. */
const PROJECT: ProjectDetail = {
  id: "p1",
  title: "Agro Conecta",
  raw_idea: "Plataforma que conecta productores locales con restaurantes.",
  status: "analyzed",
  created_at: NOW,
  updated_at: NOW,
  attributes: [
    {
      id: "area1",
      attribute_type: "geographic_scope",
      value: "Toluca, México",
      position: 0,
      origin: "user",
      is_confirmed: true,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  structure: { ready: true, missing: [], pending_suggestions: 0 },
};
/** Define REPORT para el bloque de informes. */
const REPORT: Report = {
  id: "report1",
  project_id: "p1",
  run_id: "run1",
  version: 1,
  title: "Veredicto final: Agro Conecta",
  status: "generating",
  ai_provider: "fake",
  ai_model: "fake-1",
  error_code: null,
  created_at: NOW,
  completed_at: null,
};
/** Define REPORT_LIST para el bloque de informes. */
const REPORT_LIST: ReportListItem = { ...REPORT, section_count: 10, status: "completed" };
/** Define DETAIL para el bloque de informes. */
const DETAIL: ReportDetail = {
  ...REPORT,
  status: "completed",
  completed_at: NOW,
  sections: [
    {
      id: "section1",
      section_type: "executive_summary",
      position: 0,
      title: "Veredicto final",
      content: "El análisis identifica una oportunidad por validar.",
      verdict: {
        recommendation: "needs_validation",
        confidence: "medium",
        summary: "El análisis identifica una oportunidad por validar.",
        investment: null,
        zones: [],
        missing_information: ["Faltan datos de costos."],
        next_steps: ["Entrevistar posibles clientes."],
      },
    },
    {
      id: "section2",
      section_type: "sources",
      position: 8,
      title: "Hallazgos, evidencias y fuentes",
      content: "[S1] Informe: https://fuente.example/estudio",
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

/** Escenario de prueba: Informes del proyecto. */
describe("Informes del proyecto", () => {
  /** Escenario de prueba: genera y muestra el documento con sus enlaces de fuente. */
  it("genera y muestra el documento con sus enlaces de fuente", async () => {
    const user = userEvent.setup();
    let reportLists = 0;
    const fetchMock = mockFetch(
      apiRoutes([
        { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
        {
          path: "/api/v1/projects/p1/reports",
          respond: () => jsonResponse(200, reportLists++ === 0 ? [] : [REPORT_LIST]),
        },
        {
          method: "POST",
          path: "/api/v1/projects/p1/reports",
          respond: () => jsonResponse(202, REPORT),
        },
        {
          path: "/api/v1/projects/p1/reports/report1",
          respond: () => jsonResponse(200, DETAIL),
        },
      ]),
    );
    renderRoutes(
      [projectDetailRoute],
      "/proyectos/p1/reportes?zona=San%20Mateo%2C%20Toluca&lat=19.2925&lon=-99.6569&radio=500&giro=ropa",
    );

    await user.click(await screen.findByRole("button", { name: "Generar veredicto" }));

    expect(await screen.findByText("El análisis identifica una oportunidad por validar.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Veredicto final" })).toBeInTheDocument();
    expect(screen.getByText("Faltan pruebas importantes")).toBeInTheDocument();
    expect(screen.getByText(/no se puede estimar de forma responsable/i)).toBeInTheDocument();
    expect(screen.getByText(/Este veredicto es una demostración/)).toBeInTheDocument();
    expect(screen.queryByText(/fake-1|Proveedor de pruebas/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://fuente.example/estudio" })).toHaveAttribute(
      "rel",
      "noopener noreferrer nofollow",
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).endsWith("/reports") && init?.method === "POST",
      ),
    ).toBe(true);
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/reports") && init?.method === "POST",
    );
    expect(JSON.parse(createCall![1]!.body as string)).toEqual({
      geographic_scopes: [
        {
          query: "San Mateo, Toluca",
          latitude: 19.2925,
          longitude: -99.6569,
          radius_m: 500,
          keyword: "ropa",
        },
      ],
    });
  });
});
