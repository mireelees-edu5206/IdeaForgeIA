import type { ReactNode } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { Navigate, Outlet, useLocation } from "react-router";

import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "./AuthContext";

export const LOGIN_PATH = "/iniciar-sesion";

function FullScreenMessage({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6">{children}</div>;
}

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

/** Rutas privadas: exige sesión y recuerda a dónde quería ir el usuario. */
export function RequireAuth() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Loading />;
  if (status === "anonymous") return <Navigate to={LOGIN_PATH} replace state={{ from: location }} />;
  if (status === "unavailable") {
    return (
      <FullScreenMessage>
        <GlassPanel className="max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold">No se pudo verificar tu acceso</h1>
          <p className="mt-2 text-sm text-slate-300">
            Comprueba la conexión y la configuración de Supabase; después, inténtalo de nuevo.
          </p>
          <Button className="mt-6" variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={retry}>
            Reintentar
          </Button>
        </GlassPanel>
      </FullScreenMessage>
    );
  }
  return <Outlet />;
}

export function redirectTarget(state: unknown): string {
  return (state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
}

/** Rutas exclusivas de administración: si no tiene rol admin, redirige al panel. */
export function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Rutas de invitado (login, registro): si ya hay sesión, vuelve a donde iba el usuario. */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading />;
  if (status === "authenticated") return <Navigate to={redirectTarget(location.state)} replace />;
  return <Outlet />;
}
