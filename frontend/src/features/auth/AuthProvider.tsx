/**
 * ARCHIVO: auth/AuthProvider.tsx
 *
 * ¿Qué es?
 * Es el "encargado de la cuenta" de toda la app. Se coloca una sola vez arriba de todo, y desde
 * ahí mantiene el tablero de anuncios (AuthContext) con el estado real de la sesión.
 *
 * ¿Para qué sirve?
 * Responde a tres preguntas, sin que las pantallas tengan que preguntarlas:
 * 1. ¿Hay alguien conectado? (la sesión la guarda Supabase, el servicio externo de inicio de sesión).
 * 2. ¿Quién es esa persona dentro de IdeaForge? (sus datos y su rol, guardados en nuestra base de datos).
 * 3. ¿Puede seguir usando la app? (si la sesión caducó o la cuenta está desactivada, lo sabe).
 *
 * ¿Quién lo usa?
 * app/App.tsx lo envuelve alrededor de toda la aplicación. Las pantallas leen su información con useAuth().
 *
 * Idea clave: Supabase guarda la sesión (quién inició sesión) y nuestro backend guarda el perfil
 * (nombre y rol). Este archivo une las dos cosas.
 */

/* "useQuery" pide datos al servidor y los guarda en memoria. "useQueryClient" da acceso a esa memoria (la caché)
   para poder borrarla. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
/* Tipos de Supabase: "AuthError" es un error de inicio de sesión y "Session" es la sesión activa. */
import { type AuthError, type Session } from "@supabase/supabase-js";
/* Herramientas de React: "ReactNode" (contenido), "useCallback" (guardar una función para no recrearla),
   "useEffect" (hacer algo al cambiar algo), "useMemo" (guardar un valor calculado), "useState" (guardar un valor). */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

/* "ApiError" es el error que devuelve nuestro backend. "onSessionExpired" permite escuchar cuando la sesión caduca. */
import { ApiError, onSessionExpired } from "../../lib/apiClient";
/* "getSupabase" devuelve el cliente de Supabase o lanza error si no está configurado. "supabase" es el cliente o null. */
import { getSupabase, supabase } from "../../lib/supabaseClient";
/* La petición "me" que trae el perfil de la persona desde nuestro backend. */
import { authApi } from "./api";
/* El tablero compartido (la forma y el contexto), y el tipo de estado de la sesión. */
import { type AuthContextValue, type AuthStatus, AuthContext } from "./AuthContext";
/* Formas de los datos del formulario de inicio y registro. */
import type { LoginInput, RegisterInput } from "./types";

/**
 * ME_QUERY_KEY es el "nombre en la caché" del perfil de la persona conectada.
 * La caché guarda el perfil con este nombre; si cambiamos el nombre, la caché lo trata como otro dato.
 * Otros archivos lo usan para refrescar el perfil después de cambiarlo.
 */
/** Define me query key como dato o funcion publica de auth. */
export const ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * readableAuthError traduce los errores técnicos de Supabase a mensajes en español que la persona entiende.
 *
 * Recibe: el error original de Supabase (con un código, por ejemplo "invalid_credentials").
 * Devuelve: un Error nuevo con un mensaje claro. Si el código no está en la lista, usa un mensaje genérico.
 *
 * Así nunca se muestra en pantalla un texto en inglés o un código interno.
 */
/** Gestiona readable auth error de autenticacion. */
function readableAuthError(error: AuthError): Error {
  // "switch" compara el código del error con cada caso, y devuelve el mensaje del caso que coincide.
  /** Selecciona un caso segun error.code. */
  switch (error.code) {
    // Contraseña o correo equivocados.
    case "invalid_credentials":
      return new Error("El correo o la contraseña no son correctos.");
    // Todavía no confirmó su correo (hay que abrir el enlace que llegó al correo).
    case "email_not_confirmed":
      return new Error("Confirma tu correo electrónico antes de iniciar sesión.");
    // Intentó registrarse con un correo que ya tiene cuenta.
    case "user_already_exists":
      return new Error("Ya existe una cuenta con ese correo.");
    // La contraseña no es lo bastante segura según las reglas de Supabase.
    case "weak_password":
      return new Error("La contraseña no cumple los requisitos de seguridad.");
    // Cualquier otro error (por ejemplo, sin conexión): mensaje general.
    default:
      return new Error("No se pudo completar el acceso. Inténtalo de nuevo.");
  }
}

/**
 * AuthProvider es el componente que maneja la sesión y entrega el tablero a toda la app.
 *
 * Cómo se usa: se envuelve la app una vez: <AuthProvider>...toda la app...</AuthProvider>
 *
 * Recibe: children (la app completa que va dentro).
 * Devuelve: el tablero (AuthContext) con los datos listos para leer.
 */
/** Expone la funcion auth provider para el flujo de auth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Acceso a la caché de datos del proyecto (TanStack Query). La usamos para borrarla al cambiar de cuenta.
  const queryClient = useQueryClient();
  // "session" es la sesión de Supabase (null si nadie inició sesión).
  const [session, setSession] = useState<Session | null>(null);
  // "initialized" dice si ya terminamos de preguntar por la sesión al arrancar. Mientras sea false, mostramos "cargando".
  const [initialized, setInitialized] = useState(false);
  // "sessionExpired" es true si la sesión caducó mientras se usaba la app (para mostrar un aviso).
  const [sessionExpired, setSessionExpired] = useState(false);

  // Pide el perfil de la persona a nuestro backend (GET /users/me). Solo se hace si hay sesión y Supabase está configurado.
  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    // "enabled" decide si la petición se hace: solo cuando hay sesión y el cliente existe.
    enabled: Boolean(session && supabase),
    // "staleTime" dice que el perfil se considera fresco durante 5 minutos (5 × 60 000 milisegundos) antes de volver a pedirlo.
    staleTime: 5 * 60_000,
  });

  // Este bloque se ejecuta al arrancar la app (y solo cuando cambia "queryClient"). Prepara la escucha de la sesión.
  useEffect(() => {
    // Limpieza de restos antiguos: versiones anteriores guardaban tokens a mano en el navegador.
    // Ahora Supabase se encarga, así que esos datos sobrantes se borran.
    // Elimina solo las claves de sesión de la autenticación local que ya se retiró.
    localStorage.removeItem("ideaforge.access_token");
    localStorage.removeItem("ideaforge.refresh_token");
    // Si Supabase no está configurado (faltan las variables de entorno), no hay nada que escuchar.
    // Marcamos la inicialización como terminada y salimos. El estado quedará en "unavailable".
    if (!supabase) {
      setInitialized(true);
      return;
    }

    // "currentUserId" recuerda de qué cuenta es la sesión actual, para detectar cuando cambia.
    let currentUserId: string | null = null;
    // Supabase avisa cada vez que alguien entra, sale o renueva su sesión. Esta función se ejecuta en cada aviso.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // "nextSession?.user.id" es el identificador de la cuenta nueva, o null si se cerró la sesión.
      const nextUserId = nextSession?.user.id ?? null;
      // Al cambiar de cuenta, borramos la caché para que no se mezclen datos de una persona con otra.
      if (currentUserId !== nextUserId) queryClient.clear();
      currentUserId = nextUserId;
      // Guardamos la sesión nueva y marcamos que ya terminó la inicialización.
      setSession(nextSession);
      setInitialized(true);
    });

    // Al arrancar, preguntamos a Supabase si ya había una sesión guardada en el navegador (de una visita anterior).
    void supabase.auth.getSession().then(({ data: result, error }) => {
      // Si hubo un error al leerla, asumimos que no hay sesión. Si no, guardamos lo que encontró (puede ser null).
      /** Rama condicional: error. */
      if (error) {
        setSession(null);
      } else {
        setSession(result.session);
      }
      setInitialized(true);
    });

    // Función de limpieza: cuando la app se cierra, dejamos de escuchar a Supabase para no dejar avisos sueltos.
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  // Segundo bloque de escucha: cuando el sistema detecta que la sesión caducó (por ejemplo, el backend responde 401),
  // avisa aquí. Entonces marcamos "sessionExpired", quitamos la sesión y borramos la caché.
  useEffect(
    () =>
      onSessionExpired(() => {
        setSessionExpired(true);
        setSession(null);
        queryClient.clear();
      }),
    [queryClient],
  );

  // Inicio de sesión con correo y contraseña. "useCallback" guarda la función para que no cambie en cada dibujo.
  const login = useCallback(
    async (credentials: LoginInput) => {
      // Le pedimos a Supabase que compruebe el correo y la contraseña.
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      // Si hay error, lo traducimos a un mensaje en español y lo lanzamos (la pantalla lo muestra).
      /** Rama condicional: error. */
      if (error) throw readableAuthError(error);
      // Si Supabase no devolvió sesión, algo raro pasó; avisamos sin entrar.
      /** Rama condicional: !data.session. */
      if (!data.session) throw new Error("No se pudo iniciar sesión. Inténtalo de nuevo.");
      // Todo bien: ya no está "caducada" y pedimos el perfil de inmediato para que la app tenga los datos al entrar.
      setSessionExpired(false);
      await queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: authApi.me });
    },
    [queryClient],
  );

  // Inicio de sesión con Google. Supabase abre la pantalla de Google y, al terminar, regresa a esta misma página.
  const loginWithGoogle = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      // "redirectTo" es la dirección a la que regresar después de elegir la cuenta de Google.
      options: { redirectTo: window.location.origin },
    });
    /** Rama condicional: error. */
    if (error) throw readableAuthError(error);
  }, []);

  // Registro de una cuenta nueva. Devuelve true si la persona todavía debe confirmar su correo.
  const register = useCallback(async (input: RegisterInput) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // "data" guarda datos extra en la cuenta de Supabase (aquí, el nombre completo).
        data: { full_name: input.full_name },
        // Al confirmar el correo, el enlace regresa a esta misma página.
        emailRedirectTo: window.location.origin,
      },
    });
    /** Rama condicional: error. */
    if (error) throw readableAuthError(error);
    // Supabase devuelve session=null cuando la persona debe confirmar el enlace por correo.
    // Por eso esta función devuelve true cuando la sesión es null: significa "revisa tu correo".
    return data.session === null;
  }, []);

  // Cierra la sesión: avisa a Supabase, quita la sesión local y borra la caché para que nada quede a la vista.
  const logout = useCallback(async () => {
    /** Rama condicional: supabase. */
    // "catch(() => undefined)" ignora un error al cerrar sesión: igual dejamos la app limpia.
    if (supabase) await supabase.auth.signOut().catch(() => undefined);
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  // Vuelve a comprobar la sesión (se usa en el aviso de "no disponible" con el botón "Reintentar").
  const retry = useCallback(() => {
    /** Rama condicional: supabase. */
    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    }
    // También volvemos a pedir el perfil al backend.
    void me.refetch();
  }, [me]);

  // Decidimos el estado final de la sesión, revisando las condiciones en orden. La primera que se cumple gana.
  let status: AuthStatus;
  // 1. Todavía no terminamos de preguntar por la sesión: "loading" (cargando).
  /** Rama condicional: !initialized. */
  if (!initialized) status = "loading";
  // 2. No hay configuración de Supabase: "unavailable" (no disponible).
  else if (!supabase) status = "unavailable";
  // 3. Terminamos y no hay sesión: "anonymous" (invitado).
  else if (!session) status = "anonymous";
  // 4. Hay sesión y ya tenemos el perfil: "authenticated" (conectado).
  else if (me.data) status = "authenticated";
  // 5. Hubo un error al pedir el perfil. Si fue 401 (no autorizado), la sesión no sirve: invitado. Si fue otro error: no disponible.
  else if (me.isError) {
    status = me.error instanceof ApiError && me.error.status === 401 ? "anonymous" : "unavailable";
    // 6. Cualquier otro caso (todavía cargando el perfil): "loading".
  } else status = "loading";

  // "useMemo" arma el tablero completo solo cuando cambia algo importante, para no redibujar toda la app sin motivo.
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      // El usuario solo se entrega cuando el estado es "authenticated". Si no, es null.
      user: status === "authenticated" ? (me.data ?? null) : null,
      sessionExpired,
      login,
      loginWithGoogle,
      register,
      logout,
      retry,
    }),
    [status, me.data, sessionExpired, login, loginWithGoogle, register, logout, retry],
  );

  // Entregamos el tablero a toda la app. Los componentes hijos (children) podrán leerlo con useAuth().
  return <AuthContext value={value}>{children}</AuthContext>;
}
