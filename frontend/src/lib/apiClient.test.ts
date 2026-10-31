/** Pruebas de regresion para apiClient. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authHeader, jsonResponse, mockFetch } from "../test/fetchMock";
import { ApiError, apiRequest, onSessionExpired } from "./apiClient";

/** Define supabaseMock para el bloque de servicios compartidos. */
const supabaseMock = vi.hoisted(() => {
  let session: { access_token: string } | null = null;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    refreshSession: vi.fn(async () => {
      session = { access_token: "access-new" };
      return { data: { session: session as { access_token: string } | null }, error: null };
    }),
    signOut: vi.fn(async () => {
      session = null;
      return { error: null };
    }),
  };
  return {
    auth,
    reset() {
      session = null;
      Object.values(auth).forEach((method) => method.mockClear());
    },
    setSession(value: typeof session) {
      session = value;
    },
  };
});

vi.mock("./supabaseClient", () => ({ supabase: { auth: supabaseMock.auth } }));

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => supabaseMock.reset());

/** Escenario de prueba: apiRequest. */
describe("apiRequest", () => {
  /** Escenario de prueba: envía el token de Supabase y devuelve el JSON. */
  it("envía el token de Supabase y devuelve el JSON", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    const fetchMock = mockFetch(() => jsonResponse(200, { ok: true }));

    await expect(apiRequest("/users/me")).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/users/me");
    expect(authHeader(init!)).toBe("Bearer access-old");
  });

  /** Escenario de prueba: no envía token en endpoints públicos. */
  it("no envía token en endpoints públicos", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await apiRequest("/health", { auth: false });
    expect(authHeader(fetchMock.mock.calls[0]![1]!)).toBeUndefined();
  });

  /** Escenario de prueba: convierte el formato de error del backend en ApiError. */
  it("convierte el formato de error del backend en ApiError", async () => {
    mockFetch(() =>
      jsonResponse(422, {
        error: {
          code: "validation_error",
          message: "Los datos enviados no son válidos.",
          details: [{ field: "email", message: "El valor no es válido." }],
        },
      }),
    );
    const error = await apiRequest("/health", { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_error", details: [{ field: "email" }] });
  });

  /** Escenario de prueba: devuelve un error de red legible si el servidor no responde. */
  it("devuelve un error de red legible si el servidor no responde", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(apiRequest("/health", { auth: false })).rejects.toMatchObject({ code: "network_error", status: 0 });
  });
});

/** Escenario de prueba: renovación de sesión. */
describe("renovación de sesión", () => {
  /** Escenario de prueba: ante un 401 renueva la sesión de Supabase y repite la petición. */
  it("ante un 401 renueva la sesión de Supabase y repite la petición", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    mockFetch((_url, init) => {
      return authHeader(init) === "Bearer access-new"
        ? jsonResponse(200, { id: 1 })
        : jsonResponse(401, {});
    });

    await expect(apiRequest("/users/me")).resolves.toEqual({ id: 1 });
    expect(supabaseMock.auth.refreshSession).toHaveBeenCalledOnce();
  });

  /** Escenario de prueba: varias peticiones con 401 simultáneas provocan UNA sola renovación. */
  it("varias peticiones con 401 simultáneas provocan UNA sola renovación", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    const fetchMock = mockFetch((_url, init) => {
      return authHeader(init) === "Bearer access-new" ? jsonResponse(200, {}) : jsonResponse(401, {});
    });

    await Promise.all([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(supabaseMock.auth.refreshSession).toHaveBeenCalledOnce();
  });

  /** Escenario de prueba: si otra pestaña ya renovó, reutiliza el token actual. */
  it("si otra pestaña ya renovó, reutiliza el token actual", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    mockFetch((_url, init) => {
      /** Rama condicional: authHeader(init) === "Bearer access-old". */
      if (authHeader(init) === "Bearer access-old") {
        supabaseMock.setSession({ access_token: "access-other-tab" });
        return jsonResponse(401, {});
      }
      return jsonResponse(200, { ok: true });
    });

    await expect(apiRequest("/users/me")).resolves.toEqual({ ok: true });
    expect(supabaseMock.auth.refreshSession).not.toHaveBeenCalled();
  });

  /** Escenario de prueba: si la renovación falla, cierra la sesión y avisa. */
  it("si la renovación falla, cierra la sesión y avisa", async () => {
    supabaseMock.setSession({ access_token: "access-old" });
    supabaseMock.auth.refreshSession.mockImplementation(async () => ({
      data: { session: null },
      error: null,
    }));
    mockFetch(() => jsonResponse(401, { error: { code: "invalid_token", message: "x" } }));
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(apiRequest("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(supabaseMock.auth.signOut).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
