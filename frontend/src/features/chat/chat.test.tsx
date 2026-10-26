import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { ChatReply } from "./types";

const NOW = "2026-10-14T10:00:00Z";
const PROJECT: ProjectDetail = {
  id: "p1",
  title: "Agro Conecta",
  raw_idea: "Plataforma que conecta agricultores locales con restaurantes.",
  status: "analyzed",
  created_at: NOW,
  updated_at: NOW,
  attributes: [],
  structure: { ready: true, missing: [], pending_suggestions: 0 },
};
const REPLY: ChatReply = {
  answer: "El hallazgo apunta a compras recurrentes; es una interpretación, no una garantía de demanda.",
  references: [
    {
      id: "f1",
      finding_type: "market",
      statement: "Los restaurantes realizan pedidos recurrentes.",
      confidence_level: "medium",
      origin: "ai",
      review_status: "accepted",
      evidence: [
        {
          stance: "supports",
          content: "Se observan pedidos periódicos.",
          source_url: "https://fuente.example/mercado",
          source_title: "Estudio sectorial",
          source_domain: "fuente.example",
        },
      ],
    },
  ],
  provider: "ollama",
  model: "qwen3:4b",
};

function renderChat() {
  let sends = 0;
  const fetchMock = mockFetch(
    apiRoutes([
      { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
      {
        method: "POST",
        path: "/api/v1/projects/p1/chat",
        respond: () => {
          sends += 1;
          return jsonResponse(200, { ...REPLY, answer: `${REPLY.answer} (${sends})` });
        },
      },
    ]),
  );
  renderRoutes([projectDetailRoute], "/proyectos/p1/asistente");
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof mockFetch>, index: number): unknown {
  return JSON.parse(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")[index]![1]!.body as string) as unknown;
}

afterEach(() => vi.unstubAllGlobals());

describe("Asistente contextual del proyecto", () => {
  it("envía el historial y muestra referencias verificables sin renderizar HTML", async () => {
    const fetchMock = renderChat();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Pregunta sobre tu idea" });
    await user.type(screen.getByLabelText("Tu mensaje"), "¿Qué evidencia respalda la oportunidad?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(`${REPLY.answer} (1)`)).toBeInTheDocument();
    expect(screen.getAllByText("Asistente", { exact: true })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Estudio sectorial/ })).toHaveAttribute(
      "href",
      "https://fuente.example/mercado",
    );
    expect(bodyOf(fetchMock, 0)).toEqual({
      message: "¿Qué evidencia respalda la oportunidad?",
      history: [],
    });

    await user.type(screen.getByLabelText("Tu mensaje"), "¿Y qué falta validar?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(`${REPLY.answer} (2)`);
    await waitFor(() =>
      expect(bodyOf(fetchMock, 1)).toEqual({
        message: "¿Y qué falta validar?",
        history: [
          { role: "user", content: "¿Qué evidencia respalda la oportunidad?" },
          { role: "assistant", content: `${REPLY.answer} (1)` },
        ],
      }),
    );
  });
});
