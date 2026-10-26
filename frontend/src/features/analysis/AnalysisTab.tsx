import { useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiHelpCircle, FiPlus, FiRefreshCw, FiTrendingUp } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { errorMessageFrom } from "../../lib/formErrors";
import { formatDateTime } from "../../lib/formatDate";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { useFindings } from "../findings/queries";
import { isActiveRun } from "../research/constants";
import { useResearchRuns } from "../research/queries";
import { AnalysisItemCard } from "./components/AnalysisItemCard";
import { AnalysisItemForm, type AnalysisSubmission } from "./components/AnalysisItemForm";
import { useAnalysis, useCreateAnalysisItem, useStartAnalysis } from "./queries";
import type { AnalysisItem, AnalysisKindKey } from "./types";

const QUADRANT_MATERIAL: Record<AnalysisKindKey, string> = {
  opportunities: "surface-panel ring-1 ring-kind-finding/30",
  risks: "surface-panel ring-1 ring-rose-400/25",
  hypotheses: "surface-panel ring-1 ring-kind-hypothesis/35",
  "missing-information": "fog-uncertain",
};

const ANALYSIS_SECTIONS: Array<{
  kind: AnalysisKindKey;
  title: string;
  description: string;
  icon: typeof FiTrendingUp;
  plural: string;
}> = [
  {
    kind: "opportunities",
    title: "Oportunidades",
    description: "Señales que podrían ayudar a que tu idea funcione. Comprueba cada una en sus fuentes.",
    icon: FiTrendingUp,
    plural: "oportunidades",
  },
  {
    kind: "risks",
    title: "Riesgos",
    description: "Situaciones que podrían complicar la idea y conviene tener en cuenta.",
    icon: FiAlertTriangle,
    plural: "riesgos",
  },
  {
    kind: "hypotheses",
    title: "Suposiciones a comprobar",
    description: "Preguntas que puedes probar con clientes o con una prueba pequeña.",
    icon: FiCheckCircle,
    plural: "suposiciones",
  },
  {
    kind: "missing-information",
    title: "Preguntas sin responder",
    description: "Información que todavía falta para decidir con más seguridad.",
    icon: FiHelpCircle,
    plural: "preguntas",
  },
];

function itemsForKind(
  kind: AnalysisKindKey,
  overview: { opportunities: AnalysisItem[]; risks: AnalysisItem[]; hypotheses: AnalysisItem[]; missing_information: AnalysisItem[] },
) {
  if (kind === "opportunities") return overview.opportunities;
  if (kind === "risks") return overview.risks;
  if (kind === "hypotheses") return overview.hypotheses;
  return overview.missing_information;
}

export function AnalysisTab() {
  const { project } = useProjectOutlet();
  const runs = useResearchRuns(project.id);
  const [runChoice, setRunChoice] = useState<string | null>(null);
  const [creating, setCreating] = useState<AnalysisKindKey | null>(null);
  const latestRun = runs.data?.[0];
  const runId = runChoice ?? latestRun?.id;
  const selectedRun = runs.data?.find((run) => run.id === runId);
  const polling = Boolean(selectedRun && isActiveRun(selectedRun.status) && selectedRun.current_step === "analyzing");
  const analysis = useAnalysis(project.id, runId, polling);
  const findings = useFindings(project.id, runId ? { run_id: runId } : {});
  const start = useStartAnalysis(project.id);
  const create = useCreateAnalysisItem(project.id);
  const linkedFindings = (findings.data ?? []).filter((finding) => finding.review_status !== "rejected");
  const hasUsableFindings = linkedFindings.length > 0;
  const canStart = Boolean(
    latestRun &&
      selectedRun?.id === latestRun.id &&
      selectedRun.status === "completed" &&
      (project.status === "researching" || project.status === "analyzed") &&
      hasUsableFindings,
  );

  const runOptions = (runs.data ?? []).map((run, index) => ({
    value: run.id,
    label: `${formatDateTime(run.created_at)}${index === 0 ? " (la más reciente)" : ""}`,
  }));

  async function submit(submission: AnalysisSubmission) {
    if ("itemId" in submission) return;
    await create.mutateAsync(submission);
    setCreating(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Qué puede significar para tu idea</h2>
          <p className="max-w-3xl text-sm text-slate-400">
            Revisa oportunidades, riesgos y preguntas pendientes. Las sugerencias ayudan a pensar; no son hechos confirmados.
          </p>
        </div>
        {runOptions.length > 0 && (
          <div className="w-full sm:max-w-xs">
            <Select
              label="Búsqueda que estás viendo"
              value={runId ?? ""}
              options={runOptions}
              onChange={(value) => setRunChoice(value)}
            />
          </div>
        )}
      </header>

      <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FiActivity aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent-cyan" />
          <div>
            <h3 className="font-medium text-slate-100">Revisar los resultados</h3>
            <p className="text-sm text-slate-400">
              Resume lo que encontramos y muestra posibles próximos pasos para tu idea.
            </p>
            {!hasUsableFindings && selectedRun?.status === "completed" && (
              <p className="mt-1 text-xs text-amber-200">Aún no hay resultados para revisar. Vuelve a resultados o añade información que conozcas.</p>
            )}
          </div>
        </div>
        <Button
          icon={<FiActivity aria-hidden="true" />}
          loading={start.isPending}
          disabled={!canStart || start.isPending}
          onClick={() => selectedRun && start.mutate(selectedRun.id)}
        >
          {polling ? "Revisando…" : "Ver próximos pasos"}
        </Button>
        {start.isError && <div className="sm:basis-full"><Alert>{errorMessageFrom(start.error)}</Alert></div>}
      </GlassPanel>

      {runs.isError && <Alert>{errorMessageFrom(runs.error)}</Alert>}
      {findings.isError && <Alert>{errorMessageFrom(findings.error)}</Alert>}
      {selectedRun?.error_message && <Alert>{selectedRun.error_message}</Alert>}

      {analysis.isPending ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
          <Spinner className="size-5 text-accent-cyan" /> Cargando análisis…
        </div>
      ) : analysis.isError ? (
        <GlassPanel className="flex flex-col items-start gap-4 p-6">
          <Alert>{errorMessageFrom(analysis.error)}</Alert>
          <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => analysis.refetch()}>
            Reintentar
          </Button>
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-5">
          {polling && (
            <p role="status" className="text-sm text-accent-cyan">
              El análisis está en curso; esta vista se actualizará automáticamente.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ANALYSIS_SECTIONS.map(({ kind, title, icon: Icon }) => {
              const count = itemsForKind(kind, analysis.data).length;
              return (
                <a
                  key={kind}
                  href={`#section-${kind}`}
                  className="neo-raised tilt-3d jelly flex items-center gap-3 rounded-2xl p-3.5"
                >
                  <span className="neo-inset grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xl leading-none font-semibold tabular-nums">{count}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{title}</p>
                  </div>
                </a>
              );
            })}
          </div>
          {ANALYSIS_SECTIONS.map(({ kind, title, description, icon: Icon, plural }) => {
            const items = itemsForKind(kind, analysis.data);
            return (
              <section
                key={kind}
                aria-labelledby={`section-${kind}`}
                className={`flex flex-col gap-3 rounded-3xl p-5 ${QUADRANT_MATERIAL[kind]}`}
              >
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 id={`section-${kind}`} className="flex items-center gap-2 font-semibold">
                      <Icon aria-hidden="true" className="text-accent-cyan" /> {title}
                    </h3>
                    <p className="text-xs text-slate-400">{description}</p>
                  </div>
                  {creating !== kind && (
                    <Button size="sm" variant="secondary" icon={<FiPlus aria-hidden="true" />} onClick={() => {
                      create.reset();
                      setCreating(kind);
                    }}>
                      Añadir
                    </Button>
                  )}
                </header>

                {creating === kind && (
                  <GlassPanel className="p-5">
                    <h4 className="mb-4 font-semibold">Añadir {plural}</h4>
                    <AnalysisItemForm
                      kind={kind}
                      findings={linkedFindings}
                      pending={create.isPending}
                      error={create.error}
                      onSubmit={submit}
                      onCancel={() => {
                        create.reset();
                        setCreating(null);
                      }}
                    />
                  </GlassPanel>
                )}

                {items.length === 0 ? (
                  <EmptyState
                    icon={Icon}
                    title={`Sin ${plural}`}
                    description={kind === "missing-information" ? "Aquí aparecerán las preguntas que todavía no tienen respuesta suficiente." : "Se mostrarán aquí las propuestas del análisis y los elementos que añadas manualmente."}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {items.map((item) => (
                      <AnalysisItemCard
                        key={item.id}
                        projectId={project.id}
                        kind={kind}
                        item={item}
                        findings={findings.data ?? []}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
