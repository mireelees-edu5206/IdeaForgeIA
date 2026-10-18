import { afterEach, describe, expect, it, vi } from "vitest";

import { authHeader, jsonResponse, mockFetch } from "../test/fetchMock";
import { ApiError, apiRequest, onSessionExpired } from "./apiClient";
import { tokenStorage } from "./tokenStorage";

const OLD = { accessToken: "access-old", refreshToken: "refresh-old" };
const NEW_PAIR = { access_token: "access-new", refresh_token: "refresh-new", token_type: "bearer", expires_in: 1800 };

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("envía el access token y devuelve el JSON", async () => {
    tokenStorage.set(OLD);
    const fetchMock = mockFetch(() => jsonResponse(200, { ok: true }));

    await expect(apiRequest("/users/me")).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/users/me");
    expect(authHeader(init!)).toBe("Bearer access-old");
  });

  it("no envía token en endpoints públicos", async () => {
    tokenStorage.set(OLD);
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    await apiRequest("/auth/login", { method: "POST", body: {}, auth: false });
    expect(authHeader(fetchMock.mock.calls[0]![1]!)).toBeUndefined();
  });

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
    const error = await apiRequest("/auth/register", { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_error", details: [{ field: "email" }] });
  });

  it("devuelve un error de red legible si el servidor no responde", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(apiRequest("/health", { auth: false })).rejects.toMatchObject({ code: "network_error", status: 0 });
  });
});

describe("renovación de sesión", () => {
  it("ante un 401 renueva los tokens y repite la petición", async () => {
    tokenStorage.set(OLD);
    mockFetch((url, init) => {
      if (url.endsWith("/auth/refresh")) return jsonResponse(200, NEW_PAIR);
      return authHeader(init) === "Bearer access-new" ? jsonResponse(200, { id: 1 }) : jsonResponse(401, {});
    });

    await expect(apiRequest("/users/me")).resolves.toEqual({ id: 1 });
    expect(tokenStorage.get()).toEqual({ accessToken: "access-new", refreshToken: "refresh-new" });
  });

  it("varias peticiones con 401 simultáneas provocan UNA sola renovación", async () => {
    tokenStorage.set(OLD);
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith("/auth/refresh")) return jsonResponse(200, NEW_PAIR);
      return authHeader(init) === "Bearer access-new" ? jsonResponse(200, {}) : jsonResponse(401, {});
    });

    await Promise.all([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("si otra pestaña ya renovó, usa sus tokens sin volver a llamar a /auth/refresh", async () => {
    tokenStorage.set(OLD);
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith("/auth/refresh")) return jsonResponse(200, NEW_PAIR);
      if (authHeader(init) === "Bearer access-old") {
        // Mientras tanto, otra pestaña rotó los tokens.
        tokenStorage.set({ accessToken: "access-other-tab", refreshToken: "refresh-other-tab" });
        return jsonResponse(401, {});
      }
      return jsonResponse(200, { ok: true });
    });

    await expect(apiRequest("/users/me")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/refresh"))).toBe(false);
    expect(authHeader(fetchMock.mock.calls[1]![1]!)).toBe("Bearer access-other-tab");
  });

  it("si la renovación falla, borra los tokens y avisa de la sesión expirada", async () => {
    tokenStorage.set(OLD);
    mockFetch(() => jsonResponse(401, { error: { code: "invalid_refresh_token", message: "x" } }));
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(apiRequest("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(tokenStorage.get()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
