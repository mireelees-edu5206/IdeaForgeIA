import { FiAlertTriangle } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { formatDateTime } from "../../../lib/formatDate";
import { RUN_STEP_LABELS, isActiveRun } from "../constants";
import type { ResearchRunDetail } from "../types";
import { RunStatusBadge } from "./badges";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="neo-inset rounded-xl px-4 py-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

export function FakeProviderNotice() {
  return (
    <div
      role="note"
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

export function RunStatusCard({ run }: { run: ResearchRunDetail }) {
  const active = isActiveRun(run.status);
  const answered = run.queries.filter((q) => q.status === "completed").length;
  const citedSources = new Set(run.queries.flatMap((q) => q.sources.filter((s) => s.was_cited).map((s) => s.source_id)));
  const evidence = run.queries.reduce((total, q) => total + q.evidence.length, 0);

  return (
    <GlassPanel className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <RunStatusBadge status={run.status} />
          <span className="text-xs text-slate-400">
            Iniciada el <time dateTime={run.created_at}>{formatDateTime(run.created_at)}</time>
          </span>
        </div>
      </div>

      {active && (
        <div className="neo-inset flex flex-col gap-2.5 rounded-2xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-200" aria-live="polite">
              <span className="size-2.5 animate-forge-pulse rounded-full bg-accent-cyan" aria-hidden="true" />
              {run.current_step ? RUN_STEP_LABELS[run.current_step] : "En cola…"}
            </span>
            <span className="font-mono-tech text-xs font-semibold text-accent-cyan tabular-nums">
              {run.progress_pct} %
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de la investigación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={run.progress_pct}
            className="neo-inset h-3 overflow-hidden rounded-full"
          >
            <div
              className="filament-line h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(run.progress_pct, 3)}%` }}
            />
          </div>
        </div>
      )}

      {run.error_message && <Alert>{run.error_message}</Alert>}

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
