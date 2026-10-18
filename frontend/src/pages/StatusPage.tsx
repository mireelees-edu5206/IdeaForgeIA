import { Link, isRouteErrorResponse, useRouteError } from "react-router";

import { Backdrop } from "../components/layout/Backdrop";
import { GlassPanel } from "../components/ui/GlassPanel";
import { useDocumentTitle } from "../lib/useDocumentTitle";

function StatusPage({ code, title, description }: { code: string; title: string; description: string }) {
  useDocumentTitle(title);
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <Backdrop />
      <GlassPanel className="max-w-md p-10 text-center animate-fade-up">
        <p className="text-gradient text-5xl font-bold">{code}</p>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        <Link
          to="/"
          className="jelly neo-raised mt-8 inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium"
        >
          Volver al inicio
        </Link>
      </GlassPanel>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <StatusPage code="404" title="Página no encontrada" description="La página que buscas no existe o se ha movido." />
  );
}

/** Errores inesperados al renderizar: mensaje genérico, sin detalles técnicos. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <StatusPage
      code="¡Ups!"
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Recarga la página o inténtalo más tarde."
    />
  );
}
