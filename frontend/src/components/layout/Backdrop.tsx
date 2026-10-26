import { useEffect } from "react";
import { useLocation } from "react-router";

import { type ForgeMode, forgeSceneStore } from "../../lib/forgeSceneStore";
import { initLiquidGlass } from "../../lib/liquidGlass";

function routeMode(pathname: string): { mode: ForgeMode; stageIndex: number } {
  if (pathname === "/iniciar-sesion" || pathname === "/registro") return { mode: "auth", stageIndex: 0 };
  if (pathname === "/proyectos/nuevo") return { mode: "composer", stageIndex: 1 };
  if (pathname.startsWith("/proyectos/")) {
    const stages = ["", "/investigacion", "/hallazgos", "/competidores", "/analisis", "/asistente", "/fuentes"];
    const found = stages.findIndex((suffix) => suffix && pathname.endsWith(suffix));
    return { mode: "workspace", stageIndex: found === -1 ? 0 : found };
  }
  if (pathname.startsWith("/proyectos")) return { mode: "portfolio", stageIndex: 1 };
  return { mode: "dashboard", stageIndex: 0 };
}

export function Backdrop() {
  const { pathname } = useLocation();

  useEffect(() => {
    initLiquidGlass();
  }, []);

  useEffect(() => {
    const { mode, stageIndex } = routeMode(pathname);
    forgeSceneStore.set({ mode, stageIndex });
  }, [pathname]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Gotas y cáusticas de luz de fondo para refracción de cristal líquido */}
      <div
        className="liquid-orb absolute -top-36 -left-20 size-[38rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-primary), transparent 66%)" }}
      />
      <div
        className="liquid-orb liquid-orb--secondary absolute top-6 -right-24 size-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-secondary), transparent 68%)" }}
      />
      <div
        className="liquid-orb liquid-orb--tertiary absolute -bottom-40 left-1/5 size-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-tertiary), transparent 70%)" }}
      />
      <div
        className="liquid-orb liquid-orb--caustic absolute top-1/3 left-1/2 size-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--glass-caustic-orb), transparent 68%)" }}
      />
      {/* Onda ambiental suave al cambiar entre pantallas */}
      <div
        key={pathname}
        className="liquid-route-wave absolute inset-x-0 -top-24 mx-auto h-80 w-[min(64rem,92vw)] rounded-full"
      />
      {/* Retícula sutil */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--grid-line) 1px, transparent 1px)," +
            "linear-gradient(var(--grid-line) 1px, transparent 1px)," +
            "linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "96px 96px, 96px 96px, 96px 96px",
          maskImage: "radial-gradient(ellipse at 55% 32%, black 18%, transparent 74%)",
        }}
      />
    </div>
  );
}
