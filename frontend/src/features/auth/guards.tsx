/**
 * ARCHIVO: auth/guards.tsx
 *
 * ¿Qué es?
 * Son los "guardias de las puertas" de la app. Antes de dejar pasar a una persona a una pantalla,
 * revisan quién es y si tiene derecho a entrar.
 *
 * ¿Para qué sirve?
 * - RequireAuth: solo deja pasar a personas con sesión iniciada. Si no la tienen, las manda a iniciar sesión.
 * - RequireAdmin: solo deja pasar a administradores. A los demás los regresa al panel de inicio.
 * - GuestOnly: deja pasar a personas SIN sesión (inicio y registro). Si ya tienen sesión, las regresa a donde iban.
 *
 * ¿Quién lo usa?
 * app/router.tsx envuelve las rutas privadas con estos guardias. Así no hace falta repetir la
 * revisión en cada pantalla.
 *
 * Cómo funciona por dentro: cada guardia lee el estado de la sesión con useAuth() y decide:
 * mostrar la pantalla (<Outlet />, que es el "hueco" donde entra la página), redirigir (<Navigate />)
 * o mostrar un mensaje mientras espera.
 */

/* "ReactNode" es cualquier contenido que React puede dibujar. */
import type { ReactNode } from "react";
/* El icono de recargar, para el botón "Reintentar". */
import { FiRefreshCw } from "react-icons/fi";
/* "Navigate" cambia de página. "Outlet" es el hueco donde entra la pantalla hija. "useLocation" dice en qué dirección estamos. */
import { Navigate, Outlet, useLocation } from "react-router";

/* Piezas visuales de la app: botón, tarjeta de cristal y ruedita de carga. */
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
/* Traemos el hook que lee el estado de la sesión. */
import { useAuth } from "./AuthContext";

/**
 * LOGIN_PATH es la dirección de la pantalla de inicio de sesión.
 * Está en una constante para cambiarla en un solo lugar si algún día cambia.
 */
/** Define login path como dato o funcion publica de auth. */
export const LOGIN_PATH = "/iniciar-sesion";

/**
 * FullScreenMessage centra un mensaje en toda la pantalla. Lo usan los guardias cuando muestran
 * "Cargando…" o un aviso, para que el mensaje quede en el medio y no pegado a un lado.
 */
/** Componente FullScreenMessage: renderiza la vista de autenticacion. */
function FullScreenMessage({ children }: { children: ReactNode }) {
  // "grid min-h-dvh place-items-center" centra su contenido en la altura visible de la pantalla. "p-6" deja espacio alrededor.
  return <div className="grid min-h-dvh place-items-center p-6">{children}</div>;
}

/**
 * Loading es el mensaje mientras se comprueba la sesión: una ruedita y el texto "Cargando…".
 * "role=status" avisa a lectores de pantalla que esa parte está cambiando (esperando).
 */
/** Componente Loading: renderiza la vista de autenticacion. */
function Loading() {
  return (
    <FullScreenMessage>
      <span role="status" className="flex items-center gap-3 text-slate-300">
        <Spinner className="size-5 text-accent-cyan" />
        Cargando…
      </span>
    </FullScreenMessage>
  );
}

/**
 * RequireAuth protege las rutas privadas.
 *
 * Qué hace según el estado:
 * - "loading": muestra "Cargando…" mientras no sabe si hay sesión.
 * - "anonymous": manda a la pantalla de inicio. Guarda la dirección que quería visitar en "state.from",
 *   para llevarla de vuelta después de iniciar sesión.
 * - "unavailable": muestra un aviso con el botón "Reintentar" (no es culpa de la persona, es la conexión o la configuración).
 * - "authenticated": deja pasar (<Outlet />).
 */
/** Rutas privadas: exige sesión y recuerda a dónde quería ir el usuario. */
export function RequireAuth() {
  // Leemos el estado de la sesión y la función para reintentar.
  const { status, retry } = useAuth();
  // Guardamos la dirección actual para poder regresar a ella después de iniciar sesión.
  const location = useLocation();

  // Mientras no sabemos si hay sesión, mostramos "Cargando…".
  if (status === "loading") return <Loading />;
  // Sin sesión: mandamos a iniciar sesión. "replace" evita que el botón "atrás" vuelva a la página privada.
  // "state={{ from: location }}" es el recado de "a dónde iba": la pantalla de login lo usa después.
  if (status === "anonymous") return <Navigate to={LOGIN_PATH} replace state={{ from: location }} />;
  // Si no se pudo verificar, mostramos el aviso y el botón de reintentar.
  if (status === "unavailable") {
    return (
      <FullScreenMessage>
        <GlassPanel className="max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold">No se pudo verificar tu acceso</h1>
          <p className="mt-2 text-sm text-slate-300">
            Comprueba la conexión y la configuración de Supabase; después, inténtalo de nuevo.
          </p>
          {/* Al pulsar, se vuelve a comprobar la sesión (función retry del AuthProvider). */}
          <Button className="mt-6" variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={retry}>
            Reintentar
          </Button>
        </GlassPanel>
      </FullScreenMessage>
    );
  }
  // Si llegamos aquí, la persona tiene sesión: dejamos que se muestre la pantalla pedida.
  return <Outlet />;
}

/**
 * redirectTarget lee la dirección a la que la persona quería ir (guardada por RequireAuth)
 * y la devuelve como texto. Si no hay ninguna, devuelve "/" (el panel de inicio).
 *
 * Recibe: state (lo que viene guardado en la navegación; puede estar vacío o tener cualquier forma).
 * Devuelve: la ruta a la que regresar. Ejemplo: "/proyectos/abc".
 */
/** Expone la funcion redirect target para el flujo de auth. */
export function redirectTarget(state: unknown): string {
  // "as" le dice a TypeScript cómo esperamos que sea el dato. El "?." evita errores si falta algo.
  // El "??" pone "/" cuando no hay dirección guardada.
  return (state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
}

/**
 * RequireAdmin protege las pantallas de administración. Si la persona no es administradora,
 * la regresa al panel de inicio ("/") sin mostrar nada de la pantalla privada.
 */
/** Rutas exclusivas de administración: si no tiene rol admin, redirige al panel. */
export function RequireAdmin() {
  // Leemos los datos de la persona conectada.
  const { user } = useAuth();
  // "user?.role !== 'admin'" es true si no hay usuario o si su rol no es admin. En ese caso la regresamos al panel.
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

/**
 * GuestOnly protege las pantallas de invitado (iniciar sesión y registrarse).
 * Si ya hay sesión, no tiene sentido mostrarlas: regresa a la persona a donde iba.
 */
/** Rutas de invitado (login, registro): si ya hay sesión, vuelve a donde iba el usuario. */
export function GuestOnly() {
  // Leemos el estado de la sesión y la dirección actual.
  const { status } = useAuth();
  const location = useLocation();
  // Mientras se comprueba la sesión, mostramos "Cargando…".
  if (status === "loading") return <Loading />;
  // Si ya tiene sesión, lo mandamos a su destino (guardado en "state") o al panel.
  if (status === "authenticated") return <Navigate to={redirectTarget(location.state)} replace />;
  // Sin sesión: mostramos la pantalla de invitado (login o registro).
  return <Outlet />;
}
