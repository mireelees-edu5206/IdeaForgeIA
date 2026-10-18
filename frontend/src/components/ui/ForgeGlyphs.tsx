import type { SVGProps } from "react";

import type { ProjectStatus } from "../../features/projects/types";

type GlyphProps = SVGProps<SVGSVGElement>;

/** Emblema del Crisol de IdeaForge: núcleo octaédrico dentro de un anillo de forja. */
export function CrucibleGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2.5 19.5 8v8L12 21.5 4.5 16V8L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.5v19M4.5 8l15 8M19.5 8l-15 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.55"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

/** Sello material por estado del proyecto (piedra bruta → metal → incandescente → cristal tallado). */
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
        <polygon
          points="14,3 24,9 22,21 8,24 4,12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="3 2.5"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <circle cx="14" cy="14" r="2.2" fill="currentColor" fillOpacity="0.5" />
      </svg>
    );
  }
  if (status === "structured") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <polygon
          points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path d="M14 3v22M4 8.5l20 11M24 8.5l-20 11" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" />
      </svg>
    );
  }
  if (status === "researching") {
    return (
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
        <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 2" />
        <polygon
          points="14,5.5 21.5,14 14,22.5 6.5,14"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <circle cx="14" cy="14" r="2.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <polygon
        points="14,2.5 23.5,8 23.5,20 14,25.5 4.5,20 4.5,8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <polygon points="14,7 19.5,14 14,21 8.5,14" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="14" cy="14" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** Indicador geométrico de las 3 facetas obligatorias (Problema, Solución, Segmento). */
export function FacetTriadGlyph({ lit }: { lit: number }) {
  const facets = [
    "M14 3 23 9.5 14 14Z",
    "M23 9.5 19.5 21 14 14Z",
    "M14 14 19.5 21 8.5 21 5 9.5 14 3Z",
  ];
  return (
    <svg viewBox="0 0 28 24" className="size-6 shrink-0" aria-hidden="true">
      {facets.map((d, index) => {
        const active = index < lit;
        return (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity={active ? 0.38 : 0.06}
            className={active ? "text-accent-cyan" : "text-slate-400"}
          />
        );
      })}
    </svg>
  );
}

/** Hilo óptico de trazabilidad entre dos nodos (dato → evidencia → fuente). */
export function FilamentBridgeGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 64 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 8C18 1 46 15 60 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 2"
      />
      <circle cx="4" cy="8" r="2.5" fill="currentColor" />
      <circle cx="32" cy="8" r="2" fill="currentColor" fillOpacity="0.65" />
      <circle cx="60" cy="8" r="2.5" fill="currentColor" />
    </svg>
  );
}
