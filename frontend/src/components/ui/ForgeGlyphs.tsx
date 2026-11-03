/**
 * ARCHIVO: ForgeGlyphs.tsx
 *
 * ¿Qué es?
 * Colección de símbolos e ilustraciones vectoriales SVG de IdeaForge AI en paleta cálida editorial
 * (terracota, verde salvia, arena y carbón, cero morados).
 */

import type { SVGProps } from "react";
import type { ProjectStatus } from "../../features/projects/types";

type GlyphProps = SVGProps<SVGSVGElement>;

/**
 * CrucibleGlyph: Nuevo emblema de brújula de exploración y validación de ideas.
 */
export function CrucibleGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" {...props}>
      {/* Anillo de brújula */}
      <circle
        cx="14"
        cy="14"
        r="10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeOpacity="0.32"
      />
      {/* Marcas cardinales */}
      <path
        d="M14 2v2.2M14 23.8V26M2 14h2.2M23.8 14H26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      {/* Aguja norte (terracota / acción) */}
      <polygon points="14,5.2 17.6,14 14,12.3 10.4,14" fill="#f97316" />
      {/* Aguja sur (salvia / evidencia) */}
      <polygon points="14,22.8 17.6,14 14,15.7 10.4,14" fill="#10b981" />
      {/* Eje central */}
      <circle cx="14" cy="14" r="1.9" fill="#fbbf24" />
    </svg>
  );
}

/**
 * StageSealGlyph: Sello visual por etapa del proyecto.
 */
export function StageSealGlyph({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  if (status === "draft") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <rect
          x="5"
          y="4"
          width="18"
          height="20"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeDasharray="3 2"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M9.5 10h9M9.5 14h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="18.5" cy="18.5" r="2.2" fill="currentColor" />
      </svg>
    );
  }
  if (status === "structured") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <rect
          x="4.5"
          y="4.5"
          width="19"
          height="19"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="m10 14.2 2.7 2.7 5.5-5.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "researching") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <circle
          cx="13"
          cy="13"
          r="7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path d="m18.5 18.5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="13" cy="13" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <circle
        cx="14"
        cy="14"
        r="10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M14 7.5 15.8 11.8 20.2 12.2 16.8 15.1 17.8 19.5 14 17.2 10.2 19.5 11.2 15.1 7.8 12.2 12.2 11.8 14 7.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * FacetTriadGlyph: Indicador de los 3 pilares básicos (Problema, Solución, Clientes).
 */
export function FacetTriadGlyph({ lit }: { lit: number }) {
  const dots = [7, 14, 21];
  return (
    <svg viewBox="0 0 28 14" className="h-3.5 w-7 shrink-0" aria-hidden="true">
      {dots.map((cx, index) => {
        const active = index < lit;
        return (
          <circle
            key={cx}
            cx={cx}
            cy={7}
            r={active ? 4 : 3.2}
            fill="currentColor"
            fillOpacity={active ? 1 : 0.25}
            className={active ? "text-primary" : "text-slate-400"}
          />
        );
      })}
    </svg>
  );
}

/**
 * FilamentBridgeGlyph: Hilo conector de evidencia.
 */
export function FilamentBridgeGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 8C18 1 46 15 60 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="3 2"
      />
      <circle cx="4" cy="8" r="2.6" fill="currentColor" />
      <circle cx="32" cy="8" r="2.2" fill="currentColor" fillOpacity="0.65" />
      <circle cx="60" cy="8" r="2.6" fill="currentColor" />
    </svg>
  );
}

/**
 * HeroIllustration: Escena editorial cálida (tablero de campo, brújula, notas y métrica de mercado).
 * Sin tonos morados: usa arena, carbón, terracota (#f97316), verde salvia (#0284c7) y ocre (#d97706).
 */
export function HeroIllustration(props: GlyphProps) {
  return (
    <svg viewBox="0 0 380 230" fill="none" aria-hidden="true" {...props}>
      {/* Fondo orgánico suave en arena/salvia */}
      <ellipse cx="195" cy="120" rx="148" ry="88" fill="#0284c7" fillOpacity="0.08" />
      <circle cx="290" cy="56" r="34" fill="#f97316" fillOpacity="0.12" />

      {/* Cuadrícula de cuaderno de campo */}
      <g stroke="currentColor" strokeOpacity="0.08" strokeWidth="1">
        <line x1="55" y1="45" x2="335" y2="45" />
        <line x1="55" y1="85" x2="335" y2="85" />
        <line x1="55" y1="125" x2="335" y2="125" />
        <line x1="55" y1="165" x2="335" y2="165" />
      </g>

      {/* Tarjeta central: Tablero de evidencias y mercado */}
      <g className="animate-float-slow">
        <rect
          x="82"
          y="30"
          width="210"
          height="144"
          rx="18"
          fill="#ffffff"
          stroke="#bae6fd"
          strokeWidth="1.5"
        />
        {/* Barra superior del cuaderno */}
        <rect x="82" y="30" width="210" height="30" rx="18" fill="#e0f2fe" />
        <circle cx="102" cy="45" r="4" fill="#f97316" />
        <circle cx="115" cy="45" r="4" fill="#d97706" />
        <circle cx="128" cy="45" r="4" fill="#0284c7" />
        <rect x="146" y="41" width="84" height="8" rx="4" fill="#c7c1b2" />

        {/* Gráfica de barras cálida (arena -> salvia -> terracota) */}
        <rect x="108" y="124" width="24" height="30" rx="5" fill="#bae6fd" />
        <rect x="142" y="106" width="24" height="48" rx="5" fill="#a7f3d0" />
        <rect x="176" y="88" width="24" height="66" rx="5" fill="#0284c7" />
        <rect x="210" y="72" width="24" height="82" rx="5" fill="#f97316" />

        {/* Curva de validación */}
        <path
          d="M118 114 154 96 188 79 222 64"
          stroke="#082f49"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="222" cy="64" r="4.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
      </g>

      {/* Tarjeta flotante izquierda: Brújula de exploración */}
      <g className="animate-float-delayed">
        <rect
          x="22"
          y="82"
          width="88"
          height="86"
          rx="18"
          fill="#082f49"
          stroke="#3f3f46"
          strokeWidth="1.5"
        />
        <circle cx="66" cy="118" r="20" stroke="#f0f9ff" strokeOpacity="0.25" strokeWidth="1.5" />
        <polygon points="66,101 72,118 66,115 60,118" fill="#f97316" />
        <polygon points="66,135 72,118 66,121 60,118" fill="#34d399" />
        <circle cx="66" cy="118" r="2.5" fill="#fbbf24" />
        <rect x="42" y="148" width="48" height="6" rx="3" fill="#f0f9ff" fillOpacity="0.7" />
      </g>

      {/* Tarjeta flotante derecha: Sello de fuente verificada */}
      <g className="animate-float-slow">
        <rect
          x="252"
          y="116"
          width="106"
          height="74"
          rx="16"
          fill="#0284c7"
          stroke="#34d399"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        <circle cx="280" cy="153" r="14" fill="#ffffff" fillOpacity="0.16" />
        <path
          d="m274 153 4.2 4.2 8.5-8.5"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="302" y="142" width="40" height="7" rx="3.5" fill="#ffffff" />
        <rect x="302" y="156" width="28" height="6" rx="3" fill="#a7f3d0" />
      </g>
    </svg>
  );
}

/**
 * EmptyIllustration: Ilustración editorial de libreta y brújula para listas vacías.
 */
export function EmptyIllustration(props: GlyphProps) {
  return (
    <svg viewBox="0 0 180 120" fill="none" aria-hidden="true" {...props}>
      <ellipse cx="90" cy="104" rx="56" ry="7" fill="currentColor" fillOpacity="0.07" />
      <g className="animate-float-slow">
        <rect
          x="40"
          y="20"
          width="100"
          height="72"
          rx="14"
          fill="var(--surface-card)"
          stroke="var(--border-subtle)"
          strokeWidth="1.6"
        />
        <circle cx="66" cy="48" r="12" fill="#f97316" fillOpacity="0.14" />
        <polygon points="66,39 70,48 66,46 62,48" fill="#f97316" />
        <polygon points="66,57 70,48 66,50 62,48" fill="#0284c7" />
        <rect x="86" y="40" width="38" height="7" rx="3.5" fill="currentColor" fillOpacity="0.35" />
        <rect x="86" y="53" width="26" height="6" rx="3" fill="currentColor" fillOpacity="0.2" />
        <rect x="54" y="72" width="72" height="6" rx="3" fill="currentColor" fillOpacity="0.14" />
      </g>
      <circle cx="148" cy="28" r="5" fill="#d97706" fillOpacity="0.7" />
      <circle cx="30" cy="44" r="3.5" fill="#0284c7" fillOpacity="0.5" />
    </svg>
  );
}
