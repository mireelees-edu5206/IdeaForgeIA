import { FiArrowUpRight, FiClock } from "react-icons/fi";
import { Link } from "react-router";

import { StageSealGlyph } from "../../../components/ui/ForgeGlyphs";
import { formatDateTime, formatRelative } from "../../../lib/formatDate";
import type { ProjectStatus, ProjectSummary } from "../types";
import { StatusBadge } from "./badges";

const STAGE_META: Record<ProjectStatus, { step: number; hint: string; material: string }> = {
  draft: { step: 1, hint: "Paso 1/4 · Estructura pendiente de confirmar", material: "Piedra en bruto" },
  structured: { step: 2, hint: "Paso 2/4 · Listo para buscar fuentes y evidencia", material: "Aleación de bronce" },
  researching: { step: 3, hint: "Paso 3/4 · Revisa hallazgos y lanza el análisis", material: "Cobre al rojo" },
  analyzed: { step: 4, hint: "Paso 4/4 · Oportunidades, riesgos e hipótesis listos", material: "Cristal tallado" },
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const { step, hint, material } = STAGE_META[project.status];
  return (
    <Link
      to={`/proyectos/${project.id}`}
      className="glass tilt-3d jelly group flex flex-col justify-between gap-4 rounded-3xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <span className="font-mono-tech text-[11px] text-slate-400">{material}</span>
          </div>
          <h3 className="font-display mt-3 line-clamp-2 text-lg font-bold leading-snug group-hover:text-accent-cyan">
            {project.title}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span className="neo-raised grid size-11 shrink-0 place-items-center rounded-2xl text-accent-cyan transition group-hover:scale-105">
          <StageSealGlyph status={project.status} className="size-6" />
        </span>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={
                index <= step
                  ? "filament-line h-1.5 rounded-full"
                  : "neo-inset h-1.5 rounded-full"
              }
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <FiClock aria-hidden="true" />
            <time dateTime={project.updated_at} title={formatDateTime(project.updated_at)}>
              {formatRelative(project.updated_at)}
            </time>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent-cyan">
            Abrir <FiArrowUpRight aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return <div aria-hidden="true" className="glass h-44 animate-pulse rounded-3xl" />;
}
