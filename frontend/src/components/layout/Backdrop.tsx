/**
 * ARCHIVO: Backdrop.tsx
 *
 * ¿Qué es?
 * Escena de fondo de alto impacto visual a pantalla completa:
 * - Aurora y haces de luz intensos en movimiento continuo.
 * - Cuadrícula de perspectiva luminosa.
 * - Rosa de los vientos / astrolabio con anillos giratorios continuos.
 * - Ondas y cordilleras vectoriales en capas con bordes brillantes (cian, turquesa y mandarina solar).
 * - Nodos y destellos flotantes con brillo (glow).
 */

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
      {/* 1. Halos de aurora intensos y visibles */}
      <div
        className="liquid-orb absolute -top-28 -left-20 size-[46rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(14, 165, 233, 0.52), transparent 68%)" }}
      />
      <div
        className="liquid-orb liquid-orb--secondary absolute top-6 -right-20 size-[44rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(20, 184, 166, 0.48), transparent 68%)" }}
      />
      <div
        className="liquid-orb liquid-orb--tertiary absolute -bottom-24 left-1/4 size-[46rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(249, 115, 22, 0.44), transparent 68%)" }}
      />

      {/* 2. Escena ilustrada a pantalla completa con alto contraste y movimiento */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="vivid-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.42" />
          </linearGradient>
          <linearGradient id="vivid-wave-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.48" />
            <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="vivid-beam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
            <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </linearGradient>
          <pattern id="vivid-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="#38bdf8"
              strokeOpacity="0.22"
              strokeWidth="1"
            />
            <circle cx="60" cy="60" r="2" fill="#2dd4bf" fillOpacity="0.42" />
          </pattern>
        </defs>

        {/* Cuadrícula arquitectónica bien visible */}
        <rect width="1440" height="900" fill="url(#vivid-grid)" />

        {/* Haz de luz diagonal tipo proyector / aurora */}
        <polygon points="-80,0 520,0 1180,900 340,900" fill="url(#vivid-beam)" />

        {/* Grandes ondas/cordilleras inferiores con borde luminoso */}
        <path
          d="M-120 610 C 220 460, 560 770, 920 570 C 1180 430, 1340 640, 1560 530 L 1560 960 L -120 960 Z"
          fill="url(#vivid-wave-1)"
        />
        <path
          d="M-120 610 C 220 460, 560 770, 920 570 C 1180 430, 1340 640, 1560 530"
          stroke="#38bdf8"
          strokeOpacity="0.75"
          strokeWidth="3"
        />

        <path
          d="M-100 710 C 310 580, 670 860, 1050 670 C 1270 560, 1410 730, 1560 660 L 1560 960 L -100 960 Z"
          fill="url(#vivid-wave-2)"
        />
        <path
          d="M-100 710 C 310 580, 670 860, 1050 670 C 1270 560, 1410 730, 1560 660"
          stroke="#fb923c"
          strokeOpacity="0.82"
          strokeWidth="3"
        />

        {/* Curvas de energía superiores */}
        <path
          d="M-120 170 C 240 20, 520 320, 880 140 C 1160 10, 1340 220, 1560 95"
          stroke="#38bdf8"
          strokeOpacity="0.65"
          strokeWidth="2.8"
        />
        <path
          d="M-120 225 C 260 75, 540 375, 900 195 C 1180 65, 1360 275, 1560 150"
          stroke="#2dd4bf"
          strokeOpacity="0.6"
          strokeWidth="2.2"
          strokeDasharray="12 8"
        />

        {/* Astrolabio / Brújula gigante arriba a la derecha con giro continuo */}
        <g transform="translate(1210, 220)">
          <circle cx="0" cy="0" r="195" fill="#0ea5e9" fillOpacity="0.16" />
          <g className="animate-spin-very-slow">
            <circle
              cx="0"
              cy="0"
              r="185"
              stroke="#38bdf8"
              strokeOpacity="0.72"
              strokeWidth="2.5"
              strokeDasharray="14 10"
            />
            <circle cx="0" cy="-185" r="7" fill="#fde047" />
            <circle cx="185" cy="0" r="6" fill="#fb923c" />
            <circle cx="0" cy="185" r="7" fill="#2dd4bf" />
            <circle cx="-185" cy="0" r="6" fill="#38bdf8" />
          </g>
          <circle cx="0" cy="0" r="132" stroke="#2dd4bf" strokeOpacity="0.7" strokeWidth="2.2" />
          <circle
            cx="0"
            cy="0"
            r="78"
            fill="#f97316"
            fillOpacity="0.22"
            stroke="#fb923c"
            strokeOpacity="0.85"
            strokeWidth="2.5"
          />
          <line x1="-220" y1="0" x2="220" y2="0" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.8" />
          <line x1="0" y1="-220" x2="0" y2="220" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.8" />
          <g className="animate-float-slow">
            <polygon points="0,-122 22,0 0,-22 -22,0" fill="#f97316" />
            <polygon points="0,122 22,0 0,22 -22,0" fill="#2dd4bf" />
            <circle cx="0" cy="0" r="11" fill="#fde047" />
          </g>
        </g>

        {/* Planetario / Red de nodos de mercado abajo a la izquierda */}
        <g transform="translate(200, 660)">
          <circle cx="0" cy="0" r="170" fill="#14b8a6" fillOpacity="0.18" />
          <g className="animate-spin-reverse-slow">
            <circle
              cx="0"
              cy="0"
              r="160"
              stroke="#2dd4bf"
              strokeOpacity="0.75"
              strokeWidth="2.5"
              strokeDasharray="18 10"
            />
            <circle cx="113" cy="-113" r="9" fill="#fb923c" />
            <circle cx="-113" cy="113" r="9" fill="#fde047" />
          </g>
          <circle cx="0" cy="0" r="104" stroke="#38bdf8" strokeOpacity="0.68" strokeWidth="2.2" />
          {/* Triángulo de conexión de evidencia */}
          <polygon
            points="0,-95 86,52 -86,52"
            fill="#0284c7"
            fillOpacity="0.18"
            stroke="#fde047"
            strokeOpacity="0.75"
            strokeWidth="2"
          />
          <circle cx="0" cy="-95" r="8" fill="#fde047" />
          <circle cx="86" cy="52" r="8" fill="#fb923c" />
          <circle cx="-86" cy="52" r="8" fill="#2dd4bf" />
        </g>

        {/* Cristales / prismas flotantes con brillo en los costados */}
        <g className="animate-float-slow" transform="translate(150, 185)">
          <polygon
            points="0,-52 46,-26 46,26 0,52 -46,26 -46,-26"
            fill="#f97316"
            fillOpacity="0.26"
            stroke="#fb923c"
            strokeWidth="2.5"
          />
          <circle cx="0" cy="0" r="7" fill="#fde047" />
        </g>

        <g className="animate-float-delayed" transform="translate(720, 130)">
          <path
            d="M0 -24 L7 -7 L24 0 L7 7 L0 24 L-7 7 L-24 0 L-7 -7 Z"
            fill="#fde047"
            fillOpacity="0.85"
          />
        </g>
      </svg>

      {/* 3. Onda luminosa al cambiar entre pantallas */}
      <div
        key={pathname}
        className="liquid-route-wave absolute inset-x-0 -top-24 mx-auto h-72 w-[min(64rem,92vw)] rounded-full"
      />
    </div>
  );
}
