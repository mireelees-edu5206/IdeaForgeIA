import { useState } from "react";
import { FiFileText, FiPlus, FiRefreshCw } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { CATEGORY_LABELS } from "../research/constants";
import { useResearchRuns } from "../research/queries";
import type { ResearchCategory } from "../research/types";
import { FindingCard } from "./components/FindingCard";
import { FindingForm } from "./components/FindingForm";
import { ProvenanceBadge } from "./components/badges";
import { REVIEW_LABELS } from "./constants";
import { useCreateFinding, useFindings } from "./queries";
import type { ReviewStatus } from "./types";

const ALL = "all";

export function FindingsTab() {
  const { project } = useProjectOutlet();
  const runs = useResearchRuns(project.id);
  const [runChoice, setRunChoice] = useState<string | null>(null);
  const [type, setType] = useState<ResearchCategory | typeof ALL>(ALL);
  const [review, setReview] = useState<ReviewStatus | typeof ALL>(ALL);
  const [creating, setCreating] = useState(false);
  const create = useCreateFinding(project.id);

  // Por defecto, la investigación más reciente (más los hallazgos aportados por el usuario).
  const runId = runChoice ?? runs.data?.[0]?.id ?? ALL;
  const findings = useFindings(project.id, {
    run_id: runId === ALL ? undefined : runId,
    finding_type: type === ALL ? undefined : type,
    review_status: review === ALL ? undefined : review,
  });
  const pending = findings.data?.filter((f) => f.origin === "ai" && f.review_status === "proposed").length ?? 0;

  const runOptions = [
    { value: ALL, label: "Todas las investigaciones" },
    ...(runs.data ?? []).map((run, index) => ({
      value: run.id,
      label: `${formatDateTime(run.created_at)}${index === 0 ? " (la más reciente)" : ""}`,
    })),
  ];
  const typeOptions: Array<{ value: ResearchCategory | typeof ALL; label: string }> = [
    { value: ALL, label: "Todas" },
    ...(Object.keys(CATEGORY_LABELS) as ResearchCategory[]).map((value) => ({ value, label: CATEGORY_LABELS[value] })),
  ];
  const reviewOptions: Array<{ value: ReviewStatus | typeof ALL; label: string }> = [
    { value: ALL, label: "Todos" },
    ...(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((value) => ({ value, label: REVIEW_LABELS[value] })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Hallazgos</h2>
          <p className="text-sm text-slate-400">
            Afirmaciones extraídas de la investigación. Cada hallazgo de la IA cita al menos un fragmento de una fuente;
            revísalos antes de darlos por buenos.
          </p>
        </div>
        {!creating && (
          <Button icon={<FiPlus aria-hidden="true" />} onClick={() => setCreating(true)}>
            Nuevo hallazgo
          </Button>
        )}
      </div>

      {creating && (
        <GlassPanel className="p-5">
          <h3 className="mb-4 font-semibold">Nuevo hallazgo</h3>
          <FindingForm
            submitLabel="Guardar hallazgo"
            pending={create.isPending}
            error={create.error}
            note="Se guardará como dato aportado por ti, sin evidencia vinculada."
            onSubmit={(data) => create.mutateAsync(data).then(() => setCreating(false))}
            onCancel={() => {
              create.reset();
              setCreating(false);
            }}
          />
        </GlassPanel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Investigación" value={runId} options={runOptions} onChange={setRunChoice} />
        <Select label="Categoría" value={type} options={typeOptions} onChange={setType} />
        <Select label="Revisión" value={review} options={reviewOptions} onChange={setReview} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Etiquetas:</span>
        <ProvenanceBadge origin="ai" review="proposed" />
        <ProvenanceBadge origin="ai" review="accepted" />
        <ProvenanceBadge origin="user" review="accepted" />
      </div>

      {findings.isPending ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
          <Spinner className="size-5 text-accent-cyan" /> Cargando hallazgos…
        </div>
      ) : findings.isError ? (
        <GlassPanel className="flex flex-col items-start gap-4 p-6">
          <Alert>{errorMessageFrom(findings.error)}</Alert>
          <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => findings.refetch()}>
            Reintentar
          </Button>
        </GlassPanel>
      ) : findings.data.length === 0 ? (
        <EmptyState
          icon={FiFileText}
          title="No hay hallazgos"
          description="Aparecerán al completar una investigación. También puedes añadir los tuyos o cambiar los filtros."
        />
      ) : (
        <section aria-label="Lista de hallazgos" className="flex flex-col gap-3">
          <p className="text-sm text-slate-300" aria-live="polite">
            {findings.data.length} {findings.data.length === 1 ? "hallazgo" : "hallazgos"}
            {pending > 0 && ` · ${pending} sin revisar`}
          </p>
          {findings.data.map((finding) => (
            <FindingCard key={finding.id} projectId={project.id} finding={finding} />
          ))}
        </section>
      )}
    </div>
  );
}
