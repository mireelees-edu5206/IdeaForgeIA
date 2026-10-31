/**
 * ARCHIVO: research/components/RunStatusCard.tsx
 *
 * ¿Qué es?
 * Es el panel de resumen de una investigación: su estado, la barra de avance mientras corre,
 * el motivo si falló y tres cifras de resumen (preguntas respondidas, fuentes citadas y fragmentos).
 * También incluye el aviso de "resultados de demostración" para las búsquedas con datos de prueba.
 *
 * ¿Para qué sirve?
 * Para saber de un vistazo cómo va la búsqueda y qué tan completa está, antes de leer las preguntas.
 *
 * ¿Quién lo usa?
 * ResearchTab.tsx, arriba de la lista de preguntas. FakeProviderNotice también lo usa ResearchTab.
 */

/* Icono de advertencia para el aviso de demostración. */
import { FiAlertTriangle } from "react-icons/fi";

/* Aviso de error, tarjeta de cristal y formato de fecha. */
import { Alert } from "../../../components/ui/Alert";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { formatDateTime } from "../../../lib/formatDate";
/* Textos de cada paso y la función que dice si la búsqueda sigue activa. */
import { RUN_STEP_LABELS, isActiveRun } from "../constants";
/* Ficha completa de la búsqueda. */
import type { ResearchRunDetail } from "../types";
/* La etiqueta de estado de la búsqueda. */
import { RunStatusBadge } from "./badges";

/**
 * Stat dibuja una cifra de resumen: un título pequeño y el número grande debajo.
 * Recibe: label (el nombre de la cifra) y value (el número o texto).
 */
/** Componente Stat: renderiza la vista de investigacion. */
function Stat({ label, value }: { label: string; value: string | number }) {
  // "dt" es el título de una cifra y "dd" su valor; juntos forman una lista de descripciones (semántica HTML).
  return (
    <div className="neo-inset rounded-xl px-4 py-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

/**
 * FakeProviderNotice es el aviso de advertencia que aparece cuando los resultados son de demostración.
 * Dice con claridad que las fuentes (example.com, example.org) no existen, para que nadie tome decisiones con ellas.
 * "role=note" marca el aviso como una nota para lectores de pantalla.
 */
/** Expone la funcion fake provider notice para el flujo de research. */
export function FakeProviderNotice() {
  return (
    <div
      role="note"
      // Estilo de advertencia: borde punteado ámbar y fondo ámbar suave.
      className="flex items-start gap-3 rounded-xl border border-dashed border-kind-hypothesis/60 bg-kind-hypothesis/10 px-4 py-3 text-sm text-amber-100"
    >
      <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-kind-hypothesis" />
      <p>
        <strong className="font-semibold">Resultados de demostración.</strong> Son ejemplos, no una búsqueda real:
        las fuentes (example.com, example.org…) no existen. No los uses para tomar decisiones.
      </p>
    </div>
  );
}

/**
 * RunStatusCard dibuja el panel de resumen de una búsqueda.
 *
 * Recibe: run, la búsqueda completa con sus preguntas.
 *
 * Qué calcula:
 * - answered: cuántas preguntas ya tienen respuesta.
 * - citedSources: cuántas fuentes distintas se citaron en total (sin repetir la misma fuente).
 * - evidence: cuántos fragmentos de evidencia hay en total.
 */
/** Expone la funcion run status card para el flujo de research. */
export function RunStatusCard({ run }: { run: ResearchRunDetail }) {
  // ¿La búsqueda sigue en curso? Si sí, mostramos la barra de avance.
  const active = isActiveRun(run.status);
  // Preguntas respondidas: contamos solo las que tienen estado "completed".
  const answered = run.queries.filter((q) => q.status === "completed").length;
  // Fuentes citadas sin repetir: juntamos las fuentes citadas de todas las preguntas y quitamos repetidas con un Set.
  const citedSources = new Set(run.queries.flatMap((q) => q.sources.filter((s) => s.was_cited).map((s) => s.source_id)));
  // Total de fragmentos de evidencia: sumamos la cantidad de cada pregunta. "reduce" acumula el total.
  const evidence = run.queries.reduce((total, q) => total + q.evidence.length, 0);

  return (
    <GlassPanel className="flex flex-col gap-4 p-5">
      {/* La fila superior: estado de la búsqueda y la fecha en que se inició. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <RunStatusBadge status={run.status} />
          <span className="text-xs text-slate-400">
            Iniciada el <time dateTime={run.created_at}>{formatDateTime(run.created_at)}</time>
          </span>
        </div>
      </div>

      {/* Solo mientras corre: el paso actual, el porcentaje y la barra de avance. */}
      {active && (
        <div className="neo-inset flex flex-col gap-2.5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-sm">
            {/* "aria-live=polite" hace que el lector de pantalla anuncie los cambios de paso sin interrumpir. */}
            <span className="flex items-center gap-2 font-medium text-slate-200" aria-live="polite">
              {/* El puntito que pulsa (forge-pulse, definido en index.css). "aria-hidden" lo esconde de lectores de pantalla. */}
              <span className="size-2.5 animate-forge-pulse rounded-full bg-accent-cyan" aria-hidden="true" />
              {/* El paso en lenguaje sencillo, o "En cola…" si todavía no empezó. */}
              {run.current_step ? RUN_STEP_LABELS[run.current_step] : "En cola…"}
            </span>
            <span className="font-mono-tech text-xs font-semibold text-accent-cyan tabular-nums">
              {run.progress_pct} %
            </span>
          </div>
          {/* La barra de progreso. Los atributos "aria-value..." le dicen al lector de pantalla cuánto va. */}
          <div
            role="progressbar"
            aria-label="Progreso de la investigación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={run.progress_pct}
            className="neo-inset h-3 overflow-hidden rounded-full"
          >
            {/* La parte llena. "Math.max(..., 3)" hace que se vea un poquito aunque el avance sea 0. */}
            <div
              className="filament-line h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(run.progress_pct, 3)}%` }}
            />
          </div>
        </div>
      )}

      {/* Si la búsqueda falló, mostramos el motivo que mandó el servidor. */}
      {run.error_message && <Alert>{run.error_message}</Alert>}

      {/* Las tres cifras de resumen. Solo si ya hay preguntas. */}
      {run.queries.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Preguntas respondidas" value={`${answered}/${run.queries.length}`} />
          <Stat label="Fuentes citadas" value={citedSources.size} />
          <Stat label="Fragmentos con cita" value={evidence} />
        </dl>
      )}
    </GlassPanel>
  );
}
