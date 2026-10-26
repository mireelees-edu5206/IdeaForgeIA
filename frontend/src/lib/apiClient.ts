import { supabase } from "./supabaseClient";

const API_BASE = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");

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
  const accessToken = auth ? await getAccessToken() : undefined;
  let response = await send(path, options, accessToken);

  if (response.status === 401 && accessToken) {
    const renewed = await refreshSession(accessToken);
    if (renewed) response = await send(path, options, renewed);
  }
  return parse<T>(response);
}

async function getAccessToken(): Promise<string | undefined> {
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getSession();
  if (error) return undefined;
  return data.session?.access_token;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(staleAccessToken: string): Promise<string | null> {
  if (!supabase) return null;
  refreshInFlight ??= doRefresh(staleAccessToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(staleAccessToken: string): Promise<string | null> {
  const current = await getAccessToken();
  if (!current) return null;
  if (current !== staleAccessToken) return current;
  try {
    const { data, error } = await supabase!.auth.refreshSession();
    if (error || !data.session) throw error ?? new Error("No se pudo renovar la sesión.");
    return data.session.access_token;
  } catch {
    await supabase!.auth.signOut().catch(() => undefined);
    sessionExpiredListeners.forEach((listener) => listener());
    return null;
  }
}
