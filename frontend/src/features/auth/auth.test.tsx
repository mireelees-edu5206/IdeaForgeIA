import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../../lib/queryClient";
import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { AuthProvider } from "./AuthProvider";
import { GuestOnly, LOGIN_PATH, RequireAuth } from "./guards";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

const supabaseMock = vi.hoisted(() => {
  let session: { access_token: string; user: { id: string } } | null = null;
  let loginError: { code: string } | null = null;
  const listeners: Array<(event: string, value: typeof session) => void> = [];
  const auth = {
    onAuthStateChange: vi.fn((callback: (event: string, value: typeof session) => void) => {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signInWithPassword: vi.fn(async () => {
      if (loginError) return { data: { session: null }, error: loginError };
      session = { access_token: "supabase-access", user: { id: "supabase-user" } };
      listeners.forEach((callback) => callback("SIGNED_IN", session));
      return { data: { session }, error: null };
    }),
    signInWithOAuth: vi.fn(async () => ({ data: { url: "https://accounts.google.com" }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null, user: { id: "supabase-user" } }, error: null })),
    signOut: vi.fn(async () => {
      session = null;
      listeners.forEach((callback) => callback("SIGNED_OUT", session));
      return { error: null };
    }),
    refreshSession: vi.fn(async () => ({ data: { session }, error: null })),
  };

  return {
    auth,
    reset() {
      session = null;
      loginError = null;
      listeners.length = 0;
      Object.values(auth).forEach((method) => {
        if (typeof method === "function" && "mockClear" in method) method.mockClear();
      });
    },
    setSession(value: typeof session) {
      session = value;
    },
    setLoginError(value: typeof loginError) {
      loginError = value;
    },
  };
});

vi.mock("../../lib/supabaseClient", () => ({
  supabase: { auth: supabaseMock.auth },
  getSupabase: () => ({ auth: supabaseMock.auth }),
}));

const USER = {
  id: "1",
  email: "ana@ideaforge.dev",
  full_name: "Ana Pérez",
  role: "user",
  created_at: "",
};

function renderApp(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: <GuestOnly />,
        children: [
          { path: LOGIN_PATH, element: <LoginPage /> },
          { path: "/registro", element: <RegisterPage /> },
        ],
      },
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

beforeEach(() => supabaseMock.reset());
afterEach(() => vi.unstubAllGlobals());

describe("flujo de autenticación con Supabase", () => {
  it("una ruta privada sin sesión redirige al login", async () => {
    renderApp("/privado");
    expect(await screen.findByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear una cuenta" })).toBeInTheDocument();
  });

  it("mantiene la contraseña oculta y explica cómo mostrarla", async () => {
    renderApp(LOGIN_PATH);
    const user = userEvent.setup();
    const password = await screen.findByLabelText("Contraseña");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });

  it("valida la sesión con la API y vuelve a la ruta que se pidió", async () => {
    mockFetch(() => jsonResponse(200, USER));
    const router = renderApp("/privado");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana@ideaforge.dev");
    await user.type(screen.getByLabelText("Contraseña"), "clave-muy-segura");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Zona privada")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/privado");
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@ideaforge.dev",
      password: "clave-muy-segura",
    });
  });

  it("muestra un error de credenciales en español", async () => {
    supabaseMock.setLoginError({ code: "invalid_credentials" });
    renderApp(LOGIN_PATH);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo electrónico"), "ana@ideaforge.dev");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo o la contraseña no son correctos.",
    );
  });

  it("inicia el flujo OAuth de Google", async () => {
    renderApp(LOGIN_PATH);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Continuar con Google" }));
    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  it("informa que debe confirmar el correo antes de iniciar sesión", async () => {
    renderApp("/registro");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@ideaforge.dev");
    await user.type(screen.getByLabelText("Contraseña"), "clave-muy-segura");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave-muy-segura");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Te enviamos un enlace de confirmación.",
    );
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@ideaforge.dev",
        options: expect.objectContaining({
          data: { full_name: "Ana Pérez" },
          emailRedirectTo: window.location.origin,
        }),
      }),
    );
  });

  it("con una sesión de Supabase guardada carga el perfil local", async () => {
    supabaseMock.setSession({ access_token: "saved-supabase-access", user: { id: "supabase-user" } });
    mockFetch(() => jsonResponse(200, USER));
    renderApp("/privado");
    expect(await screen.findByText("Zona privada")).toBeInTheDocument();
  });
});
