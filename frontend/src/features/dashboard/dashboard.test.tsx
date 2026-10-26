import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../test/render";
import { DashboardPage } from "./DashboardPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", full_name: "Ana Pérez", role: "user" },
  }),
}));

vi.mock("../projects/queries", () => ({
  useProjectsOverview: () => ({
    isSuccess: true,
    isError: false,
    data: { total: 0, by_status: { draft: 0, structured: 0, researching: 0, analyzed: 0 } },
  }),
  useProjectList: () => ({
    isPending: false,
    isError: false,
    data: { items: [], total: 0 },
  }),
}));

describe("Panel de inicio", () => {
  it("guía a una persona nueva para crear su primera idea sin mostrar métricas vacías", async () => {
    renderRoutes([{ path: "/", element: <DashboardPage /> }], "/");

    expect(await screen.findByRole("heading", { name: "Empieza con tu idea." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear mi primer proyecto" })).toHaveAttribute(
      "href",
      "/proyectos/nuevo",
    );
    expect(screen.getByText("No necesitas tenerlo todo resuelto.")).toBeInTheDocument();
    expect(screen.getByText("Tú tienes la última palabra")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
