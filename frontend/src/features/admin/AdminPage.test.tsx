import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { renderRoutes } from "../../test/render";
import { AdminPage } from "./AdminPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1", role: "admin" } }),
}));

const overview = {
  total_users: 2,
  active_users: 2,
  admin_users: 1,
  total_projects: 1,
  projects_by_status: { draft: 1, structured: 0, researching: 0, analyzed: 0 },
  total_research_runs: 0,
  completed_research_runs: 0,
  failed_research_runs: 0,
  total_findings: 0,
  total_reports: 0,
  total_ai_calls: 0,
  ai_by_provider: [],
  recent_ai_logs: [],
};

const adminUser = {
  id: "admin-1",
  email: "admin@example.test",
  full_name: "Admin",
  role: "admin",
  is_active: true,
  project_count: 0,
  research_run_count: 0,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const targetUser = {
  ...adminUser,
  id: "user-2",
  email: "person@example.test",
  full_name: "Patricia Persona",
  role: "user",
  project_count: 1,
  research_run_count: 2,
};

afterEach(() => vi.unstubAllGlobals());

describe("Administración de cuentas", () => {
  it("pide confirmación antes de eliminar una cuenta y actualiza la lista", async () => {
    let deleted = false;
    const fetchMock = mockFetch((rawUrl, init) => {
      const path = new URL(rawUrl, "http://localhost").pathname;
      if (path === "/api/v1/admin/overview") return jsonResponse(200, overview);
      if (path === "/api/v1/admin/users" && init.method !== "DELETE") {
        return jsonResponse(200, deleted ? [adminUser] : [adminUser, targetUser]);
      }
      if (path === "/api/v1/admin/users/user-2" && init.method === "DELETE") {
        deleted = true;
        return jsonResponse(204);
      }
      return jsonResponse(404);
    });
    renderRoutes([{ path: "/admin", element: <AdminPage /> }], "/admin");
    const user = userEvent.setup();

    const row = (await screen.findAllByText("Patricia Persona"))[0]!;
    await user.click(within(row.closest("li")!).getByRole("button", { name: "Eliminar cuenta" }));

    const dialog = screen.getByRole("dialog", { name: "¿Eliminar esta cuenta definitivamente?" });
    expect(within(dialog).getByText(/proyectos, investigaciones, resultados e informes/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Eliminar cuenta" }));

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(screen.queryByText("Patricia Persona")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });
});
