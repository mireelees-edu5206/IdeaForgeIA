/**
 * ARCHIVO: analysis/AnalysisTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Qué puede significar para tu idea". Muestra el análisis en cuatro cuadrantes:
 * oportunidades, riesgos, suposiciones a comprobar y preguntas sin responder. También tiene el botón
 * para generar el análisis a partir de una búsqueda ("Ver próximos pasos").
 *
 * ¿Para qué sirve?
 * Ayuda a pensar la idea a partir de los resultados revisados. Todo lo que aparece aquí son
 * sugerencias o interpretaciones, no hechos confirmados: la pantalla lo repite en su texto.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "analisis").
 *
 * Qué ve la persona:
 * - Un selector para elegir la búsqueda que está viendo (por defecto, la más reciente).
 * - Una tarjeta "Revisar los resultados" con el botón para generar el análisis.
 * - Cuatro contadores (uno por cuadrante) que enlazan a cada sección.
 * - Las cuatro secciones, cada una con sus elementos y un botón "Añadir".
 *
 * Detalle: mientras el análisis se está generando, la pantalla vuelve a pedir datos cada 2 segundos
 * (esto lo decide "polling" en useAnalysis).
 */

/* "useState" guarda la búsqueda elegida y qué sección tiene abierto el formulario de añadir. */
import { useState } from "react";
/* Iconos: actividad, alerta, check, ayuda, más, recargar y tendencia. */
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiHelpCircle, FiPlus, FiRefreshCw, FiTrendingUp } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
/* Convierte errores a texto y formatea fechas. */
import { errorMessageFrom } from "../../lib/formErrors";
import { formatDateTime } from "../../lib/formatDate";
/* Mensaje de "todavía no hay nada". */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* Resultados (para vincularlos) y función que dice si una búsqueda sigue activa. */
import { useFindings } from "../findings/queries";
import { isActiveRun } from "../research/constants";
import { useResearchRuns } from "../research/queries";
/* La tarjeta de cada elemento y el formulario para crear uno. */
import { AnalysisItemCard } from "./components/AnalysisItemCard";
import { AnalysisItemForm, type AnalysisSubmission } from "./components/AnalysisItemForm";
/* Consultas y acciones del análisis, desde la caché. */
import { useAnalysis, useCreateAnalysisItem, useStartAnalysis } from "./queries";
import type { AnalysisItem, AnalysisKindKey } from "./types";

/**
 * QUADRANT_MATERIAL define el estilo (material y borde) de cada una de las cuatro secciones.
 * Cambia aquí los clases si quieres otro aspecto para oportunidades, riesgos, etc.
 */
/** Define QUADRANT_MATERIAL para el bloque de analisis. */
const QUADRANT_MATERIAL: Record<AnalysisKindKey, string> = {
  opportunities: "surface-panel ring-1 ring-kind-finding/30",
  risks: "surface-panel ring-1 ring-rose-400/25",
  hypotheses: "surface-panel ring-1 ring-kind-hypothesis/35",
  "missing-information": "fog-uncertain",
};

/**
 * ANALYSIS_SECTIONS es la lista de las cuatro secciones, en el orden en que aparecen en pantalla.
 * Para cada una: su tipo (kind), su título, su explicación corta, su icono y su nombre en plural
 * (se usa en el título "Añadir oportunidades" y en el texto "Sin riesgos").
 */
/** Define ANALYSIS_SECTIONS para el bloque de analisis. */
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

/**
 * itemsForKind devuelve la lista de elementos de una sección, a partir del análisis completo.
 * Por ejemplo, para "risks" devuelve overview.risks. Si no es ninguno de los tres primeros,
 * devuelve la lista de preguntas sin responder (es el último caso).
 */
/** Gestiona items for kind de analisis. */
function itemsForKind(
  kind: AnalysisKindKey,
  overview: { opportunities: AnalysisItem[]; risks: AnalysisItem[]; hypotheses: AnalysisItem[]; missing_information: AnalysisItem[] },
) {
  /** Rama condicional: kind === "opportunities". */
  if (kind === "opportunities") return overview.opportunities;
  /** Rama condicional: kind === "risks". */
  if (kind === "risks") return overview.risks;
  /** Rama condicional: kind === "hypotheses". */
  if (kind === "hypotheses") return overview.hypotheses;
  return overview.missing_information;
}

/**
 * AnalysisTab dibuja la pestaña completa. Calcula qué búsqueda se ve, si el análisis se está generando,
 * si se puede iniciar, y muestra las cuatro secciones.
 */
/** Expone la funcion analysis tab para el flujo de analysis. */
export function AnalysisTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Las búsquedas del proyecto.
  const runs = useResearchRuns(project.id);
  // La búsqueda que eligió la persona. "null" significa que no eligió ninguna.
  const [runChoice, setRunChoice] = useState<string | null>(null);
  // Qué sección tiene abierto el formulario de añadir (o null si ninguna).
  const [creating, setCreating] = useState<AnalysisKindKey | null>(null);
  // La búsqueda más reciente (la primera de la lista, porque el servidor las ordena de más nueva a más vieja).
  const latestRun = runs.data?.[0];
  // La búsqueda que se muestra: la elegida, o la más reciente si no eligió ninguna.
  const runId = runChoice ?? latestRun?.id;
  // Los datos completos de la búsqueda que se muestra.
  const selectedRun = runs.data?.find((run) => run.id === runId);
  // "polling": true si la búsqueda sigue activa y está en la fase de análisis. Así la pantalla se actualiza sola.
  const polling = Boolean(selectedRun && isActiveRun(selectedRun.status) && selectedRun.current_step === "analyzing");
  // El análisis de esa búsqueda (se actualiza cada 2 segundos mientras "polling" sea true).
  const analysis = useAnalysis(project.id, runId, polling);
  // Los resultados de esa búsqueda. Si no hay búsqueda elegida, se piden sin filtro (lista vacía de filtros).
  const findings = useFindings(project.id, runId ? { run_id: runId } : {});
  // Las acciones de iniciar el análisis y de crear un elemento.
  const start = useStartAnalysis(project.id);
  const create = useCreateAnalysisItem(project.id);
  // Los resultados que se pueden usar: todos menos los rechazados. "?? []" usa lista vacía mientras cargan.
  const linkedFindings = (findings.data ?? []).filter((finding) => finding.review_status !== "rejected");
  // ¿Hay al menos un resultado usable?
  const hasUsableFindings = linkedFindings.length > 0;
  // El botón "Ver próximos pasos" solo se activa si: es la búsqueda más reciente, está completada,
  // el proyecto está en investigación o analizado, y hay resultados usables.
  const canStart = Boolean(
    latestRun &&
      selectedRun?.id === latestRun.id &&
      selectedRun.status === "completed" &&
      (project.status === "researching" || project.status === "analyzed") &&
      hasUsableFindings,
  );

  // Opciones del selector de búsqueda, con fecha y marca para la más reciente.
  const runOptions = (runs.data ?? []).map((run, index) => ({
    value: run.id,
    label: `${formatDateTime(run.created_at)}${index === 0 ? " (la más reciente)" : ""}`,
  }));

  /**
   * submit se ejecuta al crear un elemento desde el formulario. Si la sumisión trae un id, es una
   * edición y no se hace nada aquí. Si no, crea el elemento y cierra el formulario.
   */
  /** Gestiona submit de analisis. */
  async function submit(submission: AnalysisSubmission) {
    // Las ediciones se hacen dentro de la tarjeta, no aquí.
    /** Rama condicional: "itemId" in submission. */
    if ("itemId" in submission) return;
    await create.mutateAsync(submission);
    setCreating(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título, aviso de que son sugerencias, y el selector de búsqueda (si hay búsquedas). */}
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

      {/* La tarjeta del botón "Ver próximos pasos" y sus avisos. */}
      <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FiActivity aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent-cyan" />
          <div>
            <h3 className="font-medium text-slate-100">Revisar los resultados</h3>
            <p className="text-sm text-slate-400">
              Resume lo que encontramos y muestra posibles próximos pasos para tu idea.
            </p>
            {/* Aviso: la búsqueda terminó pero no hay resultados que revisar. */}
            {!hasUsableFindings && selectedRun?.status === "completed" && (
              <p className="mt-1 text-xs text-amber-200">Aún no hay resultados para revisar. Vuelve a resultados o añade información que conozcas.</p>
            )}
          </div>
        </div>
        {/* El botón de generar el análisis. Muestra "Revisando…" mientras está en curso. */}
        <Button
          icon={<FiActivity aria-hidden="true" />}
          loading={start.isPending}
          disabled={!canStart || start.isPending}
          onClick={() => selectedRun && start.mutate(selectedRun.id)}
        >
          {polling ? "Revisando…" : "Ver próximos pasos"}
        </Button>
        {/* El error de iniciar, si lo hubo. Ocupa todo el ancho en pantallas grandes. */}
        {start.isError && <div className="sm:basis-full"><Alert>{errorMessageFrom(start.error)}</Alert></div>}
      </GlassPanel>

      {/* Errores de cargar las búsquedas, los resultados o el mensaje de la búsqueda seleccionada. */}
      {runs.isError && <Alert>{errorMessageFrom(runs.error)}</Alert>}
      {findings.isError && <Alert>{errorMessageFrom(findings.error)}</Alert>}
      {selectedRun?.error_message && <Alert>{selectedRun.error_message}</Alert>}

      {/* El cuerpo: cargando el análisis, error o el contenido. */}
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
          {/* Mientras se genera, un aviso que se anuncia a lectores de pantalla. */}
          {polling && (
            <p role="status" className="text-sm text-accent-cyan">
              El análisis está en curso; esta vista se actualizará automáticamente.
            </p>
          )}
          {/* Los cuatro contadores de arriba. Cada uno es un enlace a su sección (#section-...). */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ANALYSIS_SECTIONS.map(({ kind, title, icon: Icon }) => {
              // Cuántos elementos tiene esta sección.
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
          {/* Las cuatro secciones completas. */}
          {ANALYSIS_SECTIONS.map(({ kind, title, description, icon: Icon, plural }) => {
            // Los elementos de esta sección.
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
                  {/* El botón "Añadir" solo aparece si el formulario de esta sección no está abierto. */}
                  {creating !== kind && (
                    <Button size="sm" variant="secondary" icon={<FiPlus aria-hidden="true" />} onClick={() => {
                      // Borramos errores anteriores y abrimos el formulario de esta sección.
                      create.reset();
                      setCreating(kind);
                    }}>
                      Añadir
                    </Button>
                  )}
                </header>

                {/* El formulario de añadir, dentro de una tarjeta. */}
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

                {/* Si la sección está vacía, un mensaje. Si no, sus tarjetas. */}
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
