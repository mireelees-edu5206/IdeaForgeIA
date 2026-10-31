/**
 * ARCHIVO: projects/components/ProjectCard.tsx
 *
 * ¿Qué es?
 * Es la tarjeta de un proyecto en la lista. Muestra su nombre, su etapa, un mensaje de qué sigue,
 * una barra de cuatro escalones que indica el avance y cuándo se actualizó por última vez.
 * Toda la tarjeta es un enlace: al tocarla, se abre el detalle del proyecto.
 *
 * ¿Para qué sirve?
 * Para ver de un vistazo el estado de cada idea y decidir cuál abrir.
 * Opcionalmente tiene el botón "Eliminar proyecto", que abre una confirmación antes de borrar.
 *
 * ¿Quién lo usa?
 * ProjectsPage.tsx (la lista completa) y DashboardPage.tsx (las últimas ideas del panel de inicio).
 * Hay también un "esqueleto" (ProjectCardSkeleton): una tarjeta gris que parpadea mientras carga.
 *
 * Detalle importante: la tarjeta tiene su propio texto de etapa (hint) y su nombre de material
 * (STAGE_META, abajo). No es el mismo que el de constants.ts; aquí está pensado para la tarjeta.
 */

/* "useState" guarda si la ventana de confirmación está abierta. */
import { useState } from "react";
/* Iconos: flecha (abrir), reloj (fecha). */
import { FiArrowUpRight, FiClock } from "react-icons/fi";
/* Enlace interno que lleva al detalle del proyecto. */
import { Link } from "react-router";

/* Piezas visuales compartidas: avisos, botones, la ventana de confirmación y el sello de etapa. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { StageSealGlyph } from "../../../components/ui/ForgeGlyphs";
/* Funciones que convierten fechas en texto ("hace 2 días") y en fecha completa. */
import { formatDateTime, formatRelative } from "../../../lib/formatDate";
/* Convierte un error en un mensaje que se puede mostrar. */
import { errorMessageFrom } from "../../../lib/formErrors";
/* Tipos de etapa y de resumen de proyecto. */
import type { ProjectStatus, ProjectSummary } from "../types";
/* La acción que borra un proyecto (en la caché). */
import { useDeleteProject } from "../queries";
/* La etiqueta de etapa de esta tarjeta. */
import { StatusBadge } from "./badges";

/**
 * STAGE_META es la "escalera" de cada etapa para esta tarjeta:
 * - step: en qué escalón va (1 a 4). Los escalones que ya se alcanzaron se pintan de color.
 * - hint: el mensaje corto que dice qué sigue ("Completa la estructura para empezar a investigar.").
 * - material: el nombre "de material" que aparece en la tarjeta (ESTRUCTURA, PREPARADO, etc.),
 *   que es parte de la temática de forja de la app.
 */
/** Catalogo STAGE_META que define etiquetas o reglas de proyectos. */
const STAGE_META: Record<ProjectStatus, { step: number; hint: string; material: string }> = {
  // Borrador: está en el escalón 1.
  draft: { step: 1, hint: "Completa la estructura para empezar a investigar.", material: "ESTRUCTURA" },
  // Lista para investigar: escalón 2.
  structured: { step: 2, hint: "La idea está lista para buscar fuentes y evidencia.", material: "PREPARADO" },
  // Investigando: escalón 3.
  researching: { step: 3, hint: "Revisa los resultados y las opciones encontradas.", material: "INVESTIGACIÓN" },
  // Resultados listos: escalón 4 (el último, todo pintado).
  analyzed: { step: 4, hint: "Explora oportunidades, riesgos y qué falta comprobar.", material: "ANÁLISIS" },
};

/**
 * ProjectCard dibuja la tarjeta de un proyecto.
 *
 * Recibe:
 * - project: el resumen del proyecto (nombre, etapa, fechas).
 * - showDeleteAction (opcional, por defecto false): si es true, aparece el botón "Eliminar proyecto".
 *   Se usa solo en la lista, donde la persona puede borrar.
 */
/** Resume estado y acciones del proyecto. */
export function ProjectCard({
  project,
  showDeleteAction = false,
}: {
  project: ProjectSummary;
  showDeleteAction?: boolean;
}) {
  // Sacamos de STAGE_META los datos de la etapa actual de este proyecto.
  const { step, hint, material } = STAGE_META[project.status];
  // La acción de borrar este proyecto (se crea para este id concreto).
  const deleteProject = useDeleteProject(project.id);
  // "confirmDelete" dice si la ventana de "¿seguro?" está abierta.
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    // "article" es el contenedor semántico de una tarjeta independiente. Clases: efecto de tarjeta, columna, ancho que se ajusta.
    <article className="project-card surface-panel flex min-w-0 flex-col rounded-2xl p-4">
      {/* Toda la parte de arriba es un enlace al detalle del proyecto. "flex-1" hace que ocupe el espacio sobrante. */}
      <Link
        to={`/proyectos/${project.id}`}
        className="group flex min-w-0 flex-1 flex-col justify-between gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Fila superior: a la izquierda la etiqueta de etapa, el nombre y la frase; a la derecha el sello. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* La etiqueta de etapa y el nombre de material, en la misma línea. */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              <span className="font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400">{material}</span>
            </div>
            {/* El nombre del proyecto. "line-clamp-2" lo corta en dos líneas si es muy largo. "group-hover" lo pinta al pasar el mouse por la tarjeta. */}
            <h3 className="font-display mt-3 line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">
              {project.title}
            </h3>
            {/* El mensaje de qué sigue, según la etapa. */}
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{hint}</p>
          </div>
          {/* El sello de la etapa (el dibujo de piedra, metal o cristal). */}
          <span className="project-card__arrow grid size-10 shrink-0 place-items-center rounded-xl">
            <StageSealGlyph status={project.status} className="size-6" />
          </span>
        </div>

        {/* Fila inferior: la barra de avance, la fecha y el texto "Abrir". */}
        <div className="flex flex-col gap-2.5 pt-2">
          {/* Cuatro escalones. "aria-hidden" los esconde de lectores de pantalla porque el texto ya dice la etapa. */}
          <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
            {/* Dibujamos cuatro barras. "index" va de 1 a 4. */}
            {[1, 2, 3, 4].map((index) => (
              <span
                key={index}
                // Si el escalón ya se alcanzó ("index <= step"), se pinta con el degradado de avance (progress-liquid). Si no, es gris (bg-muted).
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
              {/* "time" marca la fecha para máquinas. "dateTime" tiene la fecha exacta; "title" muestra la fecha completa al pasar el mouse. */}
              <time dateTime={project.updated_at} title={formatDateTime(project.updated_at)}>
                {/* El texto visible: "hace 2 días", por ejemplo. */}
                {formatRelative(project.updated_at)}
              </time>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-accent-cyan">
              Abrir <FiArrowUpRight aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>

      {/* La zona de borrar: solo si la lista la pide ("showDeleteAction"). Está fuera del enlace para no abrir el proyecto por error. */}
      {showDeleteAction && (
        <>
          <div className="mt-3 flex justify-end border-t border-border/70 pt-2">
            {/* Al pulsar, no borra: solo abre la ventana de confirmación. "disabled" evita tocarlo mientras se borra. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar proyecto
            </Button>
          </div>
          {/* La ventana de confirmación. "open" la muestra o la oculta. */}
          <ConfirmDialog
            open={confirmDelete}
            title="¿Eliminar este proyecto?"
            confirmLabel="Eliminar definitivamente"
            loading={deleteProject.isPending}
            onCancel={() => setConfirmDelete(false)}
            // Al confirmar, ejecutamos el borrado. Si sale bien, cerramos la ventana.
            onConfirm={() => deleteProject.mutate(undefined, { onSuccess: () => setConfirmDelete(false) })}
          >
            <p>
              Se eliminará <strong className="text-slate-100">{project.title}</strong> junto con sus resultados,
              fuentes e informes. No se puede deshacer.
            </p>
            {/* Si el borrado falla, mostramos el motivo dentro de la ventana, para que la persona lo vea. */}
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

/**
 * ProjectCardSkeleton es el "esqueleto": una tarjeta gris que parpadea (animate-pulse)
 * mientras la lista carga. Así la pantalla no se ve vacía ni salta de golpe.
 */
/** Expone la funcion project card skeleton para el flujo de projects. */
export function ProjectCardSkeleton() {
  // "aria-hidden" la esconde de lectores de pantalla: no hay nada que leer todavía.
  return <div aria-hidden="true" className="surface-panel h-44 animate-pulse rounded-2xl" />;
}
