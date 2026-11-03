/**
 * ARCHIVO: AppShell.tsx
 *
 * ¿Qué es?
 * Marco principal de la aplicación con el fondo cartográfico animado (<Backdrop />),
 * navegación superior tipo Dock y transiciones suaves entre pantallas.
 */

import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

import { Backdrop } from "./Backdrop";
import { Topbar } from "./Topbar";

function resolveScreenKey(pathname: string): string {
  const projectRoute = /^\/proyectos\/([^/]+)/.exec(pathname);
  if (projectRoute && projectRoute[1] !== "nuevo") {
    return `/proyectos/${projectRoute[1]}`;
  }
  return pathname;
}

export function AppShell() {
  const { pathname } = useLocation();
  const screenKey = resolveScreenKey(pathname);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="relative min-h-dvh px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-5">
      <Backdrop />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Topbar />
        <main ref={mainRef} id="contenido" tabIndex={-1} className="w-full scroll-mt-24">
          <div key={screenKey} className="animate-liquid-screen">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
