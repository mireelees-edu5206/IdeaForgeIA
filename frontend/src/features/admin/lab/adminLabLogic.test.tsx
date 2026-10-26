import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AdminLabLogicPage } from "./AdminLabLogicPage";

vi.mock("../queries", () => ({
  useAdminLabPropositions: () => ({
    isPending: false,
    isError: false,
    data: {
      rules: [
        {
          id: "structure",
          title: "Estructuración de una idea",
          description: "Regla sobre los atributos requeridos.",
          source: "projects/service.py - check_structure",
          formula: "P5 = P1 AND P2",
          inputs: [
            { symbol: "P1", name: "Problema", meaning: "Problema confirmado." },
            { symbol: "P2", name: "Solución", meaning: "Solución confirmada." },
          ],
          output: { symbol: "P5", name: "Lista", meaning: "Puede estructurarse." },
          rows: [
            { values: { P1: false, P2: false }, result: false },
            { values: { P1: false, P2: true }, result: false },
            { values: { P1: true, P2: false }, result: false },
            { values: { P1: true, P2: true }, result: true },
          ],
          note: "Sólo reglas implementadas.",
        },
      ],
      peas: [
        { symbol: "P", name: "Performance", description: "Trazabilidad." },
        { symbol: "E", name: "Environment", description: "Sistema." },
        { symbol: "A", name: "Actuators", description: "Acciones." },
        { symbol: "S", name: "Sensors", description: "Entradas." },
      ],
    },
  }),
}));

describe("Apartado de proposiciones y tablas de verdad", () => {
  it("presenta reglas generales del sistema sin requerir seleccionar un proyecto", () => {
    render(
      <MemoryRouter>
        <AdminLabLogicPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Proposiciones y tablas de verdad" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Estructuración de una idea")).toBeInTheDocument();
    expect(screen.getByText("projects/service.py - check_structure")).toBeInTheDocument();
    expect(screen.getByText("PEAS del agente IdeaForge AI")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Tabla de verdad: Estructuración de una idea" });
    expect(within(table).getAllByRole("row")).toHaveLength(5);
  });
});
