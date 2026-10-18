import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import { segmentText } from "./components/CitedText";
import type { Evidence, ResearchQuery, ResearchRunDetail, Source } from "./types";

const NOW = "2026-09-24T10:00:00Z";
const TEXT = "Hay demanda creciente. Existe un competidor. Interpretación: parece viable.";

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "p1",
    title: "Agro Conecta",
    raw_idea: "Plataforma que conecta agricultores con restaurantes.",
    status: "researching",
    created_at: NOW,
    updated_at: NOW,
    attributes: [],
    structure: { ready: true, missing: [], pending_suggestions: 0 },
    ...overrides,
  };
}

function evidence(sourceId: string, start: number, end: number): Evidence {
  return { id: crypto.randomUUID(), source_id: sourceId, content: TEXT.slice(start, end), span_start: start, span_end: end };
}

function query(overrides: Partial<ResearchQuery> = {}): ResearchQuery {
  return {
    id: "q1",
    position: 0,
    category: "competition",
    question: "¿Qué competidores existen?",
    status: "completed",
    response_text: TEXT,
    executed_queries: ["competidores agro"],
    search_suggestions_html: null,
    completed_at: NOW,
    sources: [
      { source_id: "s1", url: "https://example.com/a", domain: "example.com", title: "Informe A", source_type: "news", was_cited: true, rank: 0 },
      { source_id: "s2", url: "javascript:alert(1)", domain: "malo.com", title: "Enlace peligroso", source_type: "unknown", was_cited: false, rank: 1 },
    ],
    evidence: [evidence("s1", 0, 22)],
    ...overrides,
  };
}

function run(overrides: Partial<ResearchRunDetail> = {}): ResearchRunDetail {
  return {
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
    queries: [query()],
    ...overrides,
  };
}

function renderResearch(detail: ProjectDetail, runs: ResearchRunDetail[], extra: Parameters<typeof apiRoutes>[0] = []) {
  const fetchMock = mockFetch(
    apiRoutes([
      { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, detail) },
      { path: "/api/v1/projects/p1/research-runs", respond: () => jsonResponse(200, runs) },
      ...runs.map((r) => ({
        path: `/api/v1/projects/p1/research-runs/${r.id}`,
        respond: () => jsonResponse(200, r),
      })),
      ...extra,
    ]),
  );
  const router = renderRoutes([projectDetailRoute], "/proyectos/p1/investigacion");
  return { fetchMock, router };
}

afterEach(() => vi.unstubAllGlobals());

describe("segmentText", () => {
  it("divide el texto según los fragmentos citados, incluso si se solapan", () => {
    const segments = segmentText("abcdefghij", [
      evidence("s1", 0, 4),
      evidence("s2", 2, 6),
      { ...evidence("s3", 0, 1), span_start: 5, span_end: 99 }, // fuera del texto: se ignora
    ]);
    expect(segments).toEqual([
      { text: "ab", sourceIds: ["s1"] },
      { text: "cd", sourceIds: ["s1", "s2"] },
      { text: "ef", sourceIds: ["s2"] },
      { text: "ghij", sourceIds: [] },
    ]);
  });
});

describe("Pestaña de investigación", () => {
  it("resalta los fragmentos citados y enlaza solo URLs http(s)", async () => {
    renderResearch(project(), [run()]);

    const cited = await screen.findByText("Hay demanda creciente.");
    expect(cited.tagName).toBe("MARK");
    expect(screen.getByRole("link", { name: "Fuente 1" })).toHaveAttribute("href", "#fuente-q1-1");
    expect(screen.getByRole("link", { name: /Informe A/ })).toHaveAttribute("rel", "noopener noreferrer nofollow");
    // La URL javascript: se muestra como texto, nunca como enlace.
    expect(screen.getByText("Enlace peligroso").closest("a")).toBeNull();
    expect(screen.getByText("Consultada, no citada")).toBeInTheDocument();
    expect(screen.queryByText(/Resultados simulados/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva investigación" })).toBeInTheDocument();
  });

  it("muestra el progreso de una investigación en curso y avisa si es simulada", async () => {
    renderResearch(project(), [
      run({ status: "running", current_step: "searching", progress_pct: 40, ai_provider: "fake", queries: [query({ status: "pending", response_text: null, sources: [], evidence: [] })] }),
    ]);

    const progress = await screen.findByRole("progressbar", { name: "Progreso de la investigación" });
    expect(progress).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("Buscando información en la web")).toBeInTheDocument();
    expect(screen.getByText(/Resultados simulados/)).toBeInTheDocument();
    // Con una investigación activa no se puede lanzar otra.
    expect(screen.queryByRole("button", { name: /investigación/ })).not.toBeInTheDocument();
  });

  it("explica el error de una investigación fallida", async () => {
    renderResearch(project({ status: "structured" }), [
      run({ status: "failed", error_code: "ai_timeout", error_message: "El proveedor de IA tardó demasiado en responder.", queries: [] }),
    ]);
    expect(await screen.findByText("El proveedor de IA tardó demasiado en responder.")).toBeInTheDocument();
    expect(screen.getByText("Fallida")).toBeInTheDocument();
  });

  it("en borrador pide confirmar la estructura antes de investigar", async () => {
    renderResearch(project({ status: "draft" }), []);
    expect(await screen.findByText(/primero confirma la estructura/)).toBeInTheDocument();
    expect(await screen.findByText("Aún no hay investigaciones")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar investigación" })).not.toBeInTheDocument();
  });
});

describe("Iniciar investigación", () => {
  it("desde el panel de estructura lanza la investigación y abre su pestaña", async () => {
    const pending = run({ status: "pending", progress_pct: 0, queries: [], finished_at: null });
    const { fetchMock, router } = renderResearch(project({ status: "structured" }), [pending], [
      { method: "POST", path: "/api/v1/projects/p1/research-runs", respond: () => jsonResponse(202, pending) },
    ]);
    await router.navigate("/proyectos/p1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Iniciar investigación" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/proyectos/p1/investigacion"));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    expect(await screen.findByText("En cola")).toBeInTheDocument();
  });

  it("muestra el motivo si el backend rechaza la investigación", async () => {
    renderResearch(project({ status: "structured" }), [], [
      {
        method: "POST",
        path: "/api/v1/projects/p1/research-runs",
        respond: () =>
          jsonResponse(429, { error: { code: "research_limit_reached", message: "Alcanzaste el límite de 10 investigaciones en 24 horas." } }),
      },
    ]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Iniciar investigación" }));
    expect(await screen.findByText(/Alcanzaste el límite/)).toBeInTheDocument();
  });
});

describe("Pestaña de fuentes", () => {
  it("lista las fuentes y permite ver solo las citadas", async () => {
    const sources: Source[] = [
      { id: "s1", url: "https://example.com/a", domain: "example.com", title: "Informe A", source_type: "government", created_at: NOW, citation_count: 2, evidence_count: 3 },
      { id: "s2", url: "https://example.org/b", domain: "example.org", title: null, source_type: "unknown", created_at: NOW, citation_count: 0, evidence_count: 0 },
    ];
    mockFetch(
      apiRoutes([
        { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, project()) },
        { path: "/api/v1/projects/p1/sources", respond: () => jsonResponse(200, sources) },
      ]),
    );
    renderRoutes([projectDetailRoute], "/proyectos/p1/fuentes");
    const user = userEvent.setup();

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Citada en 2 preguntas")).toBeInTheDocument();
    expect(within(list).getByText("Gobierno")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Citadas (1)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Citadas (1)" })).toHaveAttribute("aria-pressed", "true");
  });
});
