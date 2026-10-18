import { Outlet } from "react-router";

import { Backdrop } from "./Backdrop";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="relative min-h-dvh px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-8 lg:pb-12">
      <Backdrop />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-night-800 focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Topbar />
        <main id="contenido" className="w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
