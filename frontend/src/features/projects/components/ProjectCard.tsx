import { useState } from "react";
import { FiArrowUpRight, FiClock } from "react-icons/fi";
import { Link } from "react-router";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { StageSealGlyph } from "../../../components/ui/ForgeGlyphs";
import { formatDateTime, formatRelative } from "../../../lib/formatDate";
import { errorMessageFrom } from "../../../lib/formErrors";
import type { ProjectStatus, ProjectSummary } from "../types";
import { useDeleteProject } from "../queries";
import { StatusBadge } from "./badges";

const STAGE_META: Record<ProjectStatus, { step: number; hint: string; material: string }> = {
  draft: { step: 1, hint: "Completa la estructura para empezar a investigar.", material: "ESTRUCTURA" },
  structured: { step: 2, hint: "La idea está lista para buscar fuentes y evidencia.", material: "PREPARADO" },
  researching: { step: 3, hint: "Revisa los resultados y las opciones encontradas.", material: "INVESTIGACIÓN" },
  analyzed: { step: 4, hint: "Explora oportunidades, riesgos y qué falta comprobar.", material: "ANÁLISIS" },
};

export function ProjectCard({
  project,
  showDeleteAction = false,
}: {
  project: ProjectSummary;
  showDeleteAction?: boolean;
}) {
  const { step, hint, material } = STAGE_META[project.status];
  const deleteProject = useDeleteProject(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className="project-card surface-panel flex min-w-0 flex-col rounded-2xl p-4">
      <Link
        to={`/proyectos/${project.id}`}
        className="group flex min-w-0 flex-1 flex-col justify-between gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              <span className="font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400">{material}</span>
            </div>
            <h3 className="font-display mt-3 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">
              {project.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{hint}</p>
          </div>
          <span className="project-card__arrow grid size-10 shrink-0 place-items-center rounded-xl">
            <StageSealGlyph status={project.status} className="size-6" />
          </span>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className={
                  index <= step
                    ? "progress-liquid h-1.5 rounded-full"
                    : "h-1.5 rounded-full bg-muted"
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

      {showDeleteAction && (
        <>
          <div className="mt-3 flex justify-end border-t border-border/70 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar proyecto
            </Button>
          </div>
          <ConfirmDialog
            open={confirmDelete}
            title="¿Eliminar este proyecto?"
            confirmLabel="Eliminar definitivamente"
            loading={deleteProject.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => deleteProject.mutate(undefined, { onSuccess: () => setConfirmDelete(false) })}
          >
            <p>
              Se eliminará <strong className="text-slate-100">{project.title}</strong> junto con sus resultados,
              fuentes e informes. No se puede deshacer.
            </p>
            {deleteProject.isError && (
              <div className="mt-3">
                <Alert>{errorMessageFrom(deleteProject.error)}</Alert>
              </div>
            )}
          </ConfirmDialog>
        </>
      )}
    </article>
  );
}

export function ProjectCardSkeleton() {
  return <div aria-hidden="true" className="surface-panel h-44 animate-pulse rounded-2xl" />;
}
