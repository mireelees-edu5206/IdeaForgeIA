import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { FiCompass, FiRefreshCw } from "react-icons/fi";
import { useSearchParams } from "react-router";

import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Spinner } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
import { EmptyState } from "../projects/components/EmptyState";
import { useProjectOutlet } from "../projects/outlet";
import { projectKeys } from "../projects/queries";
import { QueryCard } from "./components/QueryCard";
import { FakeProviderNotice, RunStatusCard } from "./components/RunStatusCard";
import { StartResearchButton } from "./components/StartResearchButton";
import { RUN_STATUS_META, isActiveRun } from "./constants";
import { useResearchRun, useResearchRuns } from "./queries";

function Loading({ text }: { text: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
      <Spinner className="size-5 text-accent-cyan" /> {text}
    </div>
  );
}

function ReadingGuide() {
  return (
    <div className="neo-inset flex flex-col gap-2 rounded-xl p-4 text-xs text-slate-400">
      <p className="font-medium text-slate-300">Cómo leer las respuestas</p>
      <p>
        <mark className="rounded bg-kind-evidence/15 px-0.5 text-slate-50 underline decoration-kind-evidence/50 decoration-dotted underline-offset-4">
          Texto resaltado
        </mark>{" "}
        con número: fragmento respaldado por la fuente indicada. Comprueba la fuente antes de darlo por cierto.
      </p>
      <p>
        Texto sin resaltar: redacción de la IA sin cita directa. Trátalo como interpretación, no como un hecho verificado.
      </p>
    </div>
  );
}

export function ResearchTab() {
  const { project } = useProjectOutlet();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const runs = useResearchRuns(project.id);
  const selectedId = params.get("ejecucion") ?? runs.data?.[0]?.id;
  const run = useResearchRun(project.id, selectedId);

  // Al terminar una investigación cambia el estado del proyecto y aparecen fuentes nuevas.
  const status = run.data?.status;
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current && isActiveRun(previousStatus.current) && status && !isActiveRun(status)) {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    }
    previousStatus.current = status;
  }, [status, project.id, queryClient]);

  const hasActiveRun = runs.data?.some((r) => isActiveRun(r.status)) ?? false;
  const canStart = project.status !== "draft" && !hasActiveRun;
  const selectLatest = () => setParams({}, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Investigación</h2>
          <p className="text-sm text-slate-400">
            La IA plantea preguntas sobre tu idea y las responde buscando en la web, citando de dónde sale cada dato.
          </p>
        </div>
        {canStart && runs.isSuccess && (
          <StartResearchButton
            projectId={project.id}
            label={runs.data.length ? "Nueva investigación" : "Iniciar investigación"}
            onStarted={selectLatest}
          />
        )}
      </div>

      {project.status === "draft" && (
        <Alert tone="info">
          Para investigar, primero confirma la estructura de la idea.{" "}
          <LinkButton to={`/proyectos/${project.id}`} variant="ghost" size="sm">
            Ir a la idea
          </LinkButton>
        </Alert>
      )}

      {runs.isPending ? (
        <Loading text="Cargando investigaciones…" />
      ) : runs.isError ? (
        <GlassPanel className="flex flex-col items-start gap-4 p-6">
          <Alert>{errorMessageFrom(runs.error)}</Alert>
          <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => runs.refetch()}>
            Reintentar
          </Button>
        </GlassPanel>
      ) : runs.data.length === 0 ? (
        <EmptyState
          icon={FiCompass}
          title="Aún no hay investigaciones"
          description="Cuando inicies una, verás aquí las preguntas, las respuestas con sus citas y las fuentes consultadas."
        />
      ) : (
        <>
          {runs.data.length > 1 && (
            <div className="flex flex-col gap-1.5 sm:max-w-md">
              <label htmlFor="run-select" className="text-xs font-medium text-slate-400">
                Investigación mostrada
              </label>
              <select
                id="run-select"
                value={selectedId}
                onChange={(event) => setParams({ ejecucion: event.target.value }, { replace: true })}
                className="neo-inset h-11 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
              >
                {runs.data.map((r, index) => (
                  <option key={r.id} value={r.id}>
                    {formatDateTime(r.created_at)} · {RUN_STATUS_META[r.status].label}
                    {index === 0 ? " (la más reciente)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {run.isPending ? (
            <Loading text="Cargando resultados…" />
          ) : run.isError ? (
            <Alert>{errorMessageFrom(run.error)}</Alert>
          ) : (
            <>
              {run.data.ai_provider === "fake" && <FakeProviderNotice />}
              <RunStatusCard run={run.data} />
              {run.data.queries.length > 0 && (
                <section aria-label="Preguntas de investigación" className="flex flex-col gap-3">
                  <ReadingGuide />
                  {run.data.queries.map((query, index) => (
                    <QueryCard key={query.id} query={query} defaultOpen={index === 0} />
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
