/**
 * ARCHIVO: research/ResearchTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Investigar" de un proyecto. Aquí se inicia la búsqueda en internet, se ve su progreso
 * y se leen las respuestas con sus fuentes.
 *
 * ¿Para qué sirve?
 * Es donde la idea se convierte en evidencia. La persona ve qué se buscó, cómo va y qué se encontró,
 * y puede distinguir qué afirmaciones están respaldadas por una fuente y cuáles no.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "investigacion").
 *
 * Qué ve la persona según el caso:
 * - Proyecto en borrador: un aviso azul que pide primero confirmar la estructura de la idea.
 * - Sin búsquedas: un mensaje de "Aún no hemos buscado información" con el botón para empezar.
 * - Con búsquedas: un selector (si hay varias), el resumen de la búsqueda y las preguntas.
 * - Búsqueda en curso: no se puede iniciar otra hasta que termine.
 */

/* "useQueryClient" da acceso a la memoria para refrescar datos. "useEffect" hace algo al cambiar un valor. "useRef" guarda un valor que no provoca redibujos. */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
/* Iconos: brújula (sin búsquedas) y recargar (reintentar). */
import { FiCompass, FiRefreshCw } from "react-icons/fi";
/* Hook para leer y cambiar los parámetros de la dirección (por ejemplo "?ejecucion=abc"). */
import { useSearchParams } from "react-router";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Spinner } from "../../components/ui/Spinner";
/* Formato de fecha completa y convertidor de errores a texto. */
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
/* Mensaje de "todavía no hay nada" del módulo de proyectos. */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que el detalle entregó a esta pestaña, y la memoria de proyectos. */
import { useProjectOutlet } from "../projects/outlet";
import { projectKeys } from "../projects/queries";
/* Las tarjetas y los paneles de esta pantalla. */
import { QueryCard } from "./components/QueryCard";
import { FakeProviderNotice, RunStatusCard } from "./components/RunStatusCard";
import { StartResearchButton } from "./components/StartResearchButton";
/* Textos de estado y la función que dice si una búsqueda sigue activa. */
import { RUN_STATUS_META, isActiveRun } from "./constants";
/* Los datos de las búsquedas, desde la caché. */
import { useResearchRun, useResearchRuns } from "./queries";

/**
 * Loading dibuja un mensaje de espera centrado con la ruedita de carga.
 * Recibe text: lo que dice mientras espera (por ejemplo "Cargando resultados…").
 */
/** Componente Loading: renderiza la vista de investigacion. */
function Loading({ text }: { text: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
      <Spinner className="size-5 text-accent-cyan" /> {text}
    </div>
  );
}

/**
 * ReadingGuide es un recuadro que enseña a leer las respuestas: qué significa el texto resaltado
 * y qué significa el texto sin resaltar. Va justo antes de las preguntas.
 */
/** Componente ReadingGuide: renderiza la vista de investigacion. */
function ReadingGuide() {
  return (
    <div className="neo-inset flex flex-col gap-2 rounded-xl p-4 text-xs text-slate-400">
      <p className="font-medium text-slate-300">Cómo leer las respuestas</p>
      <p>
        {/* Ejemplo visual: un fragmento resaltado igual que en las respuestas reales. */}
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

/**
 * ResearchTab dibuja la pestaña completa y decide qué mostrar según el estado de las búsquedas.
 *
 * No recibe datos: toma el proyecto de la pestaña padre (useProjectOutlet) y las búsquedas de la caché.
 */
/** Expone la funcion research tab para el flujo de research. */
export function ResearchTab() {
  // El proyecto que entregó el detalle a esta pestaña.
  const { project } = useProjectOutlet();
  // Acceso a la memoria para refrescar el proyecto cuando una búsqueda termina.
  const queryClient = useQueryClient();
  // "params" son los parámetros de la dirección; "setParams" los cambia.
  const [params, setParams] = useSearchParams();
  // La lista de búsquedas del proyecto.
  const runs = useResearchRuns(project.id);
  // La búsqueda que se muestra: la que viene en la dirección ("?ejecucion=..."), o la más reciente si no hay ninguna.
  // "??" usa la segunda opción solo si la primera es null o undefined.
  const selectedId = params.get("ejecucion") ?? runs.data?.[0]?.id;
  // El detalle de la búsqueda seleccionada.
  const run = useResearchRun(project.id, selectedId);

  // Cuando una búsqueda pasa de activa a terminada, el proyecto cambia (ya tiene fuentes y resultados nuevos).
  // Por eso refrescamos sus datos. "previousStatus" recuerda el estado anterior para comparar.
  const status = run.data?.status;
  const previousStatus = useRef(status);
  useEffect(() => {
    // Solo refrescamos si antes estaba activa y ahora ya no. "previousStatus.current" es el valor guardado.
    /** Rama condicional: previousStatus.current && isActiveRun(previousStatus.cu. */
    if (previousStatus.current && isActiveRun(previousStatus.current) && status && !isActiveRun(status)) {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    }
    // Guardamos el estado actual para la próxima comparación.
    previousStatus.current = status;
  }, [status, project.id, queryClient]);

  // ¿Hay alguna búsqueda en curso? Si sí, no dejamos iniciar otra.
  const hasActiveRun = runs.data?.some((r) => isActiveRun(r.status)) ?? false;
  // Se puede iniciar solo si el proyecto ya no es borrador y no hay una búsqueda activa.
  const canStart = project.status !== "draft" && !hasActiveRun;
  // Al iniciar una búsqueda nueva, la mostramos quitando el parámetro de la dirección ("reemplaza" sin dejar historial).
  const selectLatest = () => setParams({}, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título, explicación y el botón de buscar (solo si se puede). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Buscar información</h2>
          <p className="text-sm text-slate-400">
            Buscaremos información en la web sobre tu idea y te mostraremos las fuentes para que puedas revisarlas.
          </p>
        </div>
        {/* El botón cambia de texto si ya hubo búsquedas antes. Solo aparece si las búsquedas ya se cargaron. */}
        {canStart && runs.isSuccess && (
          <StartResearchButton
            projectId={project.id}
            label={runs.data.length ? "Buscar información otra vez" : "Buscar información"}
            onStarted={selectLatest}
          />
        )}
      </div>

      {/* Aviso si el proyecto todavía es borrador: primero hay que confirmar la estructura. */}
      {project.status === "draft" && (
        <Alert tone="info">
          Para investigar, primero confirma la estructura de la idea.{" "}
          <LinkButton to={`/proyectos/${project.id}`} variant="ghost" size="sm">
            Ir a la idea
          </LinkButton>
        </Alert>
      )}

      {/* El cuerpo de la pantalla: depende de si las búsquedas cargan, fallaron o están vacías. */}
      {runs.isPending ? (
        // Cargando la lista de búsquedas.
        <Loading text="Cargando investigaciones…" />
      ) : runs.isError ? (
        // Error al cargar: mensaje y botón para reintentar.
        <GlassPanel className="flex flex-col items-start gap-4 p-6">
          <Alert>{errorMessageFrom(runs.error)}</Alert>
          <Button variant="secondary" icon={<FiRefreshCw aria-hidden="true" />} onClick={() => runs.refetch()}>
            Reintentar
          </Button>
        </GlassPanel>
      ) : runs.data.length === 0 ? (
        // No hay ninguna búsqueda todavía.
        <EmptyState
          icon={FiCompass}
          title="Aún no hemos buscado información"
          description="Inicia una búsqueda para conocer el mercado y ver de dónde viene cada resultado."
        />
      ) : (
        <>
          {/* Si hay más de una búsqueda, un selector para elegir cuál ver. */}
          {runs.data.length > 1 && (
            <div className="flex flex-col gap-1.5 sm:max-w-md">
              <label htmlFor="run-select" className="text-xs font-medium text-slate-400">
                Búsqueda que estás viendo
              </label>
              <select
                id="run-select"
                value={selectedId}
                // Al elegir otra, cambiamos el parámetro de la dirección. Así la búsqueda queda guardada en la URL.
                onChange={(event) => setParams({ ejecucion: event.target.value }, { replace: true })}
                className="neo-inset h-11 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
              >
                {/* Cada opción muestra la fecha y el estado. La primera de la lista se marca como "la más reciente". */}
                {runs.data.map((r, index) => (
                  <option key={r.id} value={r.id}>
                    {formatDateTime(r.created_at)} · {RUN_STATUS_META[r.status].label}
                    {index === 0 ? " (la más reciente)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* El detalle de la búsqueda seleccionada: cargando, error o contenido. */}
          {run.isPending ? (
            <Loading text="Cargando resultados…" />
          ) : run.isError ? (
            <Alert>{errorMessageFrom(run.error)}</Alert>
          ) : (
            <>
              {/* Aviso de demostración, solo si la IA usada fue la de pruebas. */}
              {run.data.ai_provider === "fake" && <FakeProviderNotice />}
              <RunStatusCard run={run.data} />
              {/* La lista de preguntas. La primera viene abierta; el resto, cerradas. */}
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
