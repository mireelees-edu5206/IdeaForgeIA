/**
 * ARCHIVO: frontend/src/pages/StatusPage.tsx
 *
 * ¿Qué es?
 * Las pantallas de aviso que aparecen cuando algo no está bien: "página no encontrada" (404) y
 * "algo salió mal" (error inesperado). Todas usan el mismo diseño.
 *
 * ¿Para qué sirve?
 * Para que la persona nunca vea una pantalla en blanco o un error técnico. Siempre hay un mensaje
 * claro y un botón para volver al inicio.
 *
 * ¿Quién lo usa?
 * - app/router.tsx: NotFoundPage (ruta "*") y RouteErrorPage (errorElement).
 *
 * Qué se ve en pantalla:
 * - Un fondo animado (Backdrop) detrás de todo.
 * - Una tarjeta de cristal centrada con: el código grande (404 o "¡Ups!"), un título, una descripción
 *   y un botón "Volver al inicio".
 */
import { Link, isRouteErrorResponse, useRouteError } from "react-router";

import { Backdrop } from "../components/layout/Backdrop";
import { GlassPanel } from "../components/ui/GlassPanel";
import { useDocumentTitle } from "../lib/useDocumentTitle";

/**
 * Dibuja la pantalla de aviso genérica. Es la base de NotFoundPage y RouteErrorPage.
 *
 * Props (datos que recibe desde afuera):
 * - code: el número o texto grande que aparece arriba, por ejemplo "404".
 * - title: el título que aparece en la pestaña del navegador y debajo del código.
 * - description: una frase corta que explica qué pasó.
 */
function StatusPage({ code, title, description }: { code: string; title: string; description: string }) {
  // Cambia el título de la pestaña del navegador mientras esta pantalla está abierta.
  useDocumentTitle(title);
  return (
    // Contenedor a pantalla completa. "grid place-items-center" centra la tarjeta.
    <div className="grid min-h-dvh place-items-center p-6">
      {/* Fondo animado, siempre detrás de la tarjeta. */}
      <Backdrop />
      {/* Tarjeta de cristal: máximo 28rem de ancho, texto centrado y animación de entrada. */}
      <GlassPanel className="max-w-md p-10 text-center animate-fade-up">
        {/* El código grande. "text-gradient" le pone un degradado de color. */}
        <p className="text-gradient text-5xl font-bold">{code}</p>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        {/* Enlace a la página de inicio. Se ve como botón gracias a sus clases. */}
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

/**
 * Pantalla "Página no encontrada" (404). La usa el router cuando ninguna ruta coincide con la dirección.
 * No recibe props: el texto es fijo.
 */
export function NotFoundPage() {
  return (
    <StatusPage code="404" title="Página no encontrada" description="La página que buscas no existe o se ha movido." />
  );
}

/**
 * Pantalla de error inesperado. El router la muestra si una página lanza un error al dibujarse.
 *
 * Por seguridad no se muestra el detalle técnico del error: solo un mensaje genérico. Si el error
 * en realidad es un 404 (una ruta de la API o de la app que no existe), se muestra NotFoundPage.
 */
export function RouteErrorPage() {
  // useRouteError entrega el error que lanzó la página. Puede ser de cualquier tipo.
  const error = useRouteError();
  // isRouteErrorResponse reconoce los errores de navegación de React Router, y status === 404 es "no encontrado".
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <StatusPage
      code="¡Ups!"
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Recarga la página o inténtalo más tarde."
    />
  );
}
