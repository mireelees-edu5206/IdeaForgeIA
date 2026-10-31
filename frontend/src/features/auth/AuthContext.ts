/**
 * ARCHIVO: auth/AuthContext.ts
 *
 * ¿Qué es?
 * Es un "tablero de anuncios" compartido para toda la app. Ahí se publica quién está conectado,
 * si la sesión sigue activa y qué acciones se pueden hacer (entrar, salir, registrarse).
 * Cualquier pantalla puede leer el tablero sin tener que preguntar a cada una por separado.
 *
 * ¿Para qué sirve?
 * - Define la forma del tablero (AuthContextValue): qué datos y funciones tiene.
 * - Define los posibles estados de la sesión (AuthStatus).
 * - Ofrece la función useAuth(), que cualquier pantalla usa para leer el tablero.
 *
 * ¿Quién lo usa?
 * AuthProvider.tsx lo llena con datos reales. Las pantallas (Topbar, Sidebar, guards, LoginPage,
 * RegisterPage, SettingsPage...) lo leen con useAuth().
 *
 * Nota: este archivo no crea la sesión. Solo describe el tablero. La lógica está en AuthProvider.tsx.
 */

/* "createContext" crea el tablero vacío. "useContext" permite leerlo. */
import { createContext, useContext } from "react";

/* Traemos las formas de los datos de inicio, registro y usuario (definidas en types.ts). */
import type { LoginInput, RegisterInput, User } from "./types";

/**
 * AuthStatus es la lista de estados posibles de la sesión. Cada uno cambia lo que ve la persona:
 * - "loading": todavía se está comprobando la sesión. Se muestra una ruedita de carga.
 * - "authenticated": hay sesión y el perfil se cargó correctamente. Se muestra la app.
 * - "anonymous": no hay sesión. Se manda a la pantalla de inicio de sesión.
 * - "unavailable": no se pudo configurar Supabase o verificar el perfil en el backend.
 *   Se muestra un aviso con el botón "Reintentar".
 */
/** unavailable: no se pudo configurar Supabase o verificar el perfil en el backend. */
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

/**
 * AuthContextValue es la forma exacta del tablero: todo lo que una pantalla puede leer o pedir.
 * - status: el estado de la sesión (ver AuthStatus).
 * - user: los datos de la persona conectada, o null si no hay nadie.
 * - sessionExpired: true si la sesión caducó mientras se usaba la app (para avisar a la persona).
 * - login(datos): inicia sesión con correo y contraseña. Puede lanzar un error con mensaje en español.
 * - loginWithGoogle(): abre la pantalla de Google para entrar.
 * - register(datos): crea la cuenta. Devuelve true si hay que confirmar el correo antes de entrar.
 * - logout(): cierra la sesión y borra los datos guardados en memoria.
 * - retry(): vuelve a intentar comprobar la sesión (se usa en el aviso de "no disponible").
 */
/** Describe el contrato auth context value utilizado por auth. */
export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  sessionExpired: boolean;
  login: (data: LoginInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  retry: () => void;
}

/**
 * AuthContext es el tablero en sí. Empieza vacío (null). AuthProvider.tsx lo llena cuando la
 * app arranca. Si alguien intenta leerlo fuera de AuthProvider, recibirá null (y useAuth avisa del error).
 */
/** Define auth context como dato o funcion publica de auth. */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * useAuth lee el tablero desde cualquier pantalla.
 *
 * Cómo se usa: const { user, status, logout } = useAuth();
 *
 * Si la pantalla no está dentro de AuthProvider, lanza un error con un mensaje claro para
 * quien programa: así se detecta el problema enseguida, en lugar de romperse en silencio.
 */
/** Expone la funcion use auth para el flujo de auth. */
export function useAuth(): AuthContextValue {
  // Leemos el tablero. Si es null, algo está mal conectado en la app.
  const context = useContext(AuthContext);
  // Si no hay tablero, no podemos seguir: lanzamos el error con su mensaje.
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return context;
}
