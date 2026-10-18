import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../lib/queryClient";
import { tokenStorage } from "../../lib/tokenStorage";
import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { AuthProvider } from "./AuthProvider";
import { GuestOnly, LOGIN_PATH, RequireAuth } from "./guards";
import { LoginPage } from "./LoginPage";

const USER = { id: "1", email: "ana@ideaforge.dev", full_name: "Ana Pérez", role: "user", created_at: "" };

function renderApp(initialPath: string) {
  const router = createMemoryRouter(
    [
      { element: <GuestOnly />, children: [{ path: LOGIN_PATH, element: <LoginPage /> }] },
      { element: <RequireAuth />, children: [{ path: "/privado", element: <p>Zona privada</p> }] },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

describe("flujo de autenticación", () => {
  it("una ruta privada sin sesión redirige al login", async () => {
    renderApp("/privado");
    expect(await screen.findByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
  });

  it("tras iniciar sesión vuelve a la ruta que se pidió", async () => {
    mockFetch((url) => (url.endsWith("/auth/login")
      ? jsonResponse(200, { access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 1800 })
      : jsonResponse(200, USER)));
    const router = renderApp("/privado");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana@ideaforge.dev");
    await user.type(screen.getByLabelText("Contraseña"), "clave-muy-segura");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Zona privada")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/privado");
    expect(tokenStorage.get()).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("muestra el mensaje del servidor si las credenciales son incorrectas", async () => {
    mockFetch(() =>
      jsonResponse(401, { error: { code: "invalid_credentials", message: "Correo o contraseña incorrectos." } }),
    );
    renderApp(LOGIN_PATH);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana@ideaforge.dev");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(tokenStorage.get()).toBeNull();
  });

  it("con sesión guardada entra directamente a la ruta privada", async () => {
    tokenStorage.set({ accessToken: "a", refreshToken: "r" });
    mockFetch(() => jsonResponse(200, USER));
    renderApp("/privado");
    expect(await screen.findByText("Zona privada")).toBeInTheDocument();
  });
});
