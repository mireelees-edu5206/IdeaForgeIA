import { type Tokens, tokenStorage } from "./tokenStorage";

const API_BASE = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");
const REFRESH_LOCK = "ideaforge-auth-refresh";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Error con el formato uniforme del backend: {"error": {code, message, details?}}. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─────────────── Aviso de sesión expirada ───────────────

const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// ─────────────── Peticiones ───────────────

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** false en endpoints públicos (login, registro...): no envía token ni intenta renovar. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions, accessToken?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "No se pudo conectar con el servidor. Revisa tu conexión.");
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body as T;

  const error = (body as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } })
    ?.error;
  throw new ApiError(
    response.status,
    error?.code ?? "http_error",
    error?.message ?? "Ocurrió un error inesperado. Inténtalo de nuevo.",
    error?.details ?? [],
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const accessToken = auth ? tokenStorage.get()?.accessToken : undefined;
  let response = await send(path, options, accessToken);

  if (response.status === 401 && accessToken) {
    const renewed = await refreshSession(accessToken);
    if (renewed) response = await send(path, options, renewed.accessToken);
  }
  return parse<T>(response);
}

// ─────────────── Renovación de sesión ───────────────
// El backend invalida toda la sesión si un refresh token se reutiliza. Por eso:
//  - una sola renovación a la vez en la pestaña (promesa compartida), y
//  - entre pestañas, un Web Lock; al obtenerlo se comprueba si otra pestaña ya renovó.

let refreshInFlight: Promise<Tokens | null> | null = null;

export function refreshSession(staleAccessToken?: string): Promise<Tokens | null> {
  refreshInFlight ??= withCrossTabLock(() => doRefresh(staleAccessToken)).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(REFRESH_LOCK, task)
    : task();
}

async function doRefresh(staleAccessToken?: string): Promise<Tokens | null> {
  const current = tokenStorage.get();
  if (!current) return null;
  if (staleAccessToken && current.accessToken !== staleAccessToken) return current;

  let response: Response;
  try {
    response = await send("/auth/refresh", {
      method: "POST",
      body: { refresh_token: current.refreshToken },
    });
  } catch {
    return null; // sin red: se conserva la sesión para reintentar más tarde
  }
  if (!response.ok) {
    tokenStorage.clear();
    sessionExpiredListeners.forEach((listener) => listener());
    return null;
  }
  const data = (await response.json()) as { access_token: string; refresh_token: string };
  const tokens = { accessToken: data.access_token, refreshToken: data.refresh_token };
  tokenStorage.set(tokens);
  return tokens;
}
