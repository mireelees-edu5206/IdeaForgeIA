/** Centraliza llamadas al backend con Bearer Supabase y renovación de sesión. */
import { supabase } from "./supabaseClient";

/** Define API_BASE para el bloque de servicios compartidos. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/$/, "");

/** Describe el contrato api error detail utilizado por shared frontend. */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Error con el formato uniforme del backend: {"error": {code, message, details?}}. */
export class ApiError extends Error {
  /** Metodo constructor: implementa una operacion de servicios compartidos. */
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

/** Expone la funcion on session expired para el flujo de shared frontend. */
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

/** Gestiona send de servicios compartidos. */
async function send(path: string, options: RequestOptions, accessToken?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  /** Rama condicional: options.body !== undefined. */
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  /** Rama condicional: accessToken. */
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  /** Maneja fallos de la operacion del bloque servicios compartidos. */
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    /** Rama condicional: error instanceof DOMException && error.name === "AbortE. */
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "No se pudo conectar con el servidor. Revisa tu conexión.");
  }
}

/** Interpreta parse de servicios compartidos. */
async function parse<T>(response: Response): Promise<T> {
  /** Rama condicional: response.status === 204. */
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  /** Rama condicional: response.ok. */
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

/** Expone la funcion api request para el flujo de shared frontend. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const accessToken = auth ? await getAccessToken() : undefined;
  let response = await send(path, options, accessToken);

  /** Rama condicional: response.status === 401 && accessToken. */
  if (response.status === 401 && accessToken) {
    const renewed = await refreshSession(accessToken);
    /** Rama condicional: renewed. */
    if (renewed) response = await send(path, options, renewed);
  }
  return parse<T>(response);
}

/** Obtiene get access token de servicios compartidos. */
async function getAccessToken(): Promise<string | undefined> {
  /** Rama condicional: !supabase. */
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getSession();
  /** Rama condicional: error. */
  if (error) return undefined;
  return data.session?.access_token;
}

/** Define refreshInFlight para el bloque de servicios compartidos. */
let refreshInFlight: Promise<string | null> | null = null;

/** Gestiona refresh session de servicios compartidos. */
async function refreshSession(staleAccessToken: string): Promise<string | null> {
  /** Rama condicional: !supabase. */
  if (!supabase) return null;
  // Comparte una sola renovación entre peticiones concurrentes del navegador.
  refreshInFlight ??= doRefresh(staleAccessToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Gestiona do refresh de servicios compartidos. */
async function doRefresh(staleAccessToken: string): Promise<string | null> {
  const current = await getAccessToken();
  /** Rama condicional: !current. */
  if (!current) return null;
  /** Rama condicional: current !== staleAccessToken. */
  if (current !== staleAccessToken) return current;
  /** Maneja fallos de la operacion del bloque servicios compartidos. */
  try {
    const { data, error } = await supabase!.auth.refreshSession();
    /** Rama condicional: error || !data.session. */
    if (error || !data.session) throw error ?? new Error("No se pudo renovar la sesión.");
    return data.session.access_token;
  } catch {
    await supabase!.auth.signOut().catch(() => undefined);
    sessionExpiredListeners.forEach((listener) => listener());
    return null;
  }
}
