import { useEffect } from "react";
import { useLocation } from "react-router";

import { type ForgeMode, forgeSceneStore } from "../../lib/forgeSceneStore";

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
    const { mode, stageIndex } = routeMode(pathname);
    forgeSceneStore.set({ mode, stageIndex });
  }, [pathname]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Halos de color de fondo */}
      <div
        className="absolute -top-40 -left-24 size-[34rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-primary), transparent 68%)" }}
      />
      <div
        className="absolute top-8 -right-28 size-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-secondary), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-44 left-1/4 size-[32rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--orb-tertiary), transparent 72%)" }}
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
