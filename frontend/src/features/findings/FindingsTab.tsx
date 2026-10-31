/**
 * ARCHIVO: findings/FindingsTab.tsx
 *
 * ¿Qué es?
 * Es la pestaña "Resultados de la búsqueda". Muestra lo que se encontró en la investigación,
 * con su evidencia, y permite filtrar por búsqueda, tema y estado de revisión. También permite
 * añadir un resultado que la persona ya conoce.
 *
 * ¿Para qué sirve?
 * Es el paso de revisión: aquí la persona decide qué resultados acepta, cuáles rechaza y cuáles
 * todavía debe revisar. Así, solo lo confirmado se usa como base de decisiones.
 *
 * ¿Quién la usa?
 * Se muestra dentro del detalle del proyecto (routes.tsx, ruta "hallazgos").
 *
 * Qué ve la persona:
 * - Un selector de búsqueda (por defecto, la más reciente), y dos filtros: tema y revisión.
 * - Un contador: "N resultados · M pendientes de revisar".
 * - La lista de tarjetas de resultado (FindingCard).
 * - Un botón "Añadir resultado" que abre un formulario.
 */

/* "useState" guarda la búsqueda elegida, los filtros y si el formulario de añadir está abierto. */
import { useState } from "react";
/* Iconos: documento (sin resultados), más (añadir) y recargar (reintentar). */
import { FiFileText, FiPlus, FiRefreshCw } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
/* Formato de fecha y convertidor de errores a texto. */
import { formatDateTime } from "../../lib/formatDate";
import { errorMessageFrom } from "../../lib/formErrors";
/* Mensaje de "todavía no hay nada". */
import { EmptyState } from "../projects/components/EmptyState";
/* El proyecto que entregó el detalle a esta pestaña. */
import { useProjectOutlet } from "../projects/outlet";
/* Nombres en español de las categorías y de las búsquedas. */
import { CATEGORY_LABELS } from "../research/constants";
import { useResearchRuns } from "../research/queries";
import type { ResearchCategory } from "../research/types";
/* Tarjeta de cada resultado, formulario para crear uno y la etiqueta de procedencia. */
import { FindingCard } from "./components/FindingCard";
import { FindingForm } from "./components/FindingForm";
import { ProvenanceBadge } from "./components/badges";
/* Textos de revisión y las funciones de la caché. */
import { REVIEW_LABELS } from "./constants";
import { useCreateFinding, useFindings } from "./queries";
import type { ReviewStatus } from "./types";

/**
 * ALL es el valor que significa "sin filtro" en los menús ("todas", "todos"). Lo usamos como texto
 * fijo en lugar de escribir "all" en varios lugares, así es fácil cambiarlo si hace falta.
 */
/** Define ALL para el bloque de resultados. */
const ALL = "all";

/**
 * FindingsTab dibuja la pestaña completa: filtros, formulario opcional y la lista de resultados.
 */
/** Expone la funcion findings tab para el flujo de findings. */
export function FindingsTab() {
  // El proyecto que entregó el detalle.
  const { project } = useProjectOutlet();
  // Las búsquedas del proyecto (para el selector de búsqueda).
  const runs = useResearchRuns(project.id);
  // La búsqueda que eligió la persona. "null" significa que todavía no eligió ninguna.
  const [runChoice, setRunChoice] = useState<string | null>(null);
  // Filtro por tema. Empieza en "todas".
  const [type, setType] = useState<ResearchCategory | typeof ALL>(ALL);
  // Filtro por revisión. Empieza en "todos".
  const [review, setReview] = useState<ReviewStatus | typeof ALL>(ALL);
  // true si el formulario de "Añadir resultado" está abierto.
  const [creating, setCreating] = useState(false);
  // La acción de crear un resultado.
  const create = useCreateFinding(project.id);

  // Por defecto, muestra los resultados de la búsqueda más reciente y los añadidos por el usuario.
  // "??" elige la primera opción que exista: la que eligió la persona, luego la más reciente, y si no hay, "todas".
  const runId = runChoice ?? runs.data?.[0]?.id ?? ALL;
  // La lista de resultados con los filtros actuales. Si un filtro está en "todas", se manda como indefinido (no se filtra).
  const findings = useFindings(project.id, {
    run_id: runId === ALL ? undefined : runId,
    finding_type: type === ALL ? undefined : type,
    review_status: review === ALL ? undefined : review,
  });
  // Cuántos resultados de la IA siguen sin revisar. "filter" cuenta los que cumplen ambas condiciones.
  const pending = findings.data?.filter((f) => f.origin === "ai" && f.review_status === "proposed").length ?? 0;

  // Opciones del selector de búsqueda: primero "todas", luego cada búsqueda con su fecha.
  // "...(runs.data ?? []).map(...)" copia las búsquedas al arreglo, usando "?? []" si todavía no cargaron.
  const runOptions = [
    { value: ALL, label: "Todas las búsquedas" },
    ...(runs.data ?? []).map((run, index) => ({
      value: run.id,
      label: `${formatDateTime(run.created_at)}${index === 0 ? " (la más reciente)" : ""}`,
    })),
  ];
  // Opciones del filtro de tema: "todas" más cada categoría con su nombre en español.
  const typeOptions: Array<{ value: ResearchCategory | typeof ALL; label: string }> = [
    { value: ALL, label: "Todas" },
    ...(Object.keys(CATEGORY_LABELS) as ResearchCategory[]).map((value) => ({ value, label: CATEGORY_LABELS[value] })),
  ];
  // Opciones del filtro de revisión: "todos" más cada estado con su nombre.
  const reviewOptions: Array<{ value: ReviewStatus | typeof ALL; label: string }> = [
    { value: ALL, label: "Todos" },
    ...(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((value) => ({ value, label: REVIEW_LABELS[value] })),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* La cabecera: título, explicación y el botón de añadir (oculto mientras el formulario está abierto). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resultados de la búsqueda</h2>
          <p className="text-sm text-slate-400">
            Aquí verás qué encontramos y de qué fuente viene. Revisa la información antes de usarla como base para una decisión.
          </p>
        </div>
        {!creating && (
          <Button icon={<FiPlus aria-hidden="true" />} onClick={() => setCreating(true)}>
            Añadir resultado
          </Button>
        )}
      </div>

      {/* El formulario de añadir, dentro de una tarjeta. Al guardar bien, se cierra. */}
      {creating && (
        <GlassPanel className="p-5">
          <h3 className="mb-4 font-semibold">Añade un resultado que conozcas</h3>
          <FindingForm
            submitLabel="Guardar resultado"
            pending={create.isPending}
            error={create.error}
            note="Se guardará como información aportada por ti. Podrás vincular una fuente más adelante."
            // "mutateAsync" devuelve una promesa. Si el guardado sale bien, cerramos el formulario.
            onSubmit={(data) => create.mutateAsync(data).then(() => setCreating(false))}
            onCancel={() => {
              // "reset" borra cualquier error anterior de la acción antes de cerrar.
              create.reset();
              setCreating(false);
            }}
          />
        </GlassPanel>
      )}

      {/* Los tres selectores de filtro, en fila en pantallas grandes. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Búsqueda" value={runId} options={runOptions} onChange={setRunChoice} />
        <Select label="Tema" value={type} options={typeOptions} onChange={setType} />
        <Select label="Estado de revisión" value={review} options={reviewOptions} onChange={setReview} />
      </div>

      {/* Una leyenda con los tres tipos de etiqueta de procedencia, para entender los stickers de las tarjetas. */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Quién añadió cada resultado:</span>
        <ProvenanceBadge origin="ai" review="proposed" />
        <ProvenanceBadge origin="ai" review="accepted" />
        <ProvenanceBadge origin="user" review="accepted" />
      </div>

      {/* El cuerpo: cargando, error, vacío o la lista. */}
      {findings.isPending ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-300">
          <Spinner className="size-5 text-accent-cyan" /> Cargando resultados…
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
          title="Todavía no hay resultados"
          description="Cuando busques información, aparecerán aquí los datos encontrados. También puedes añadir los que ya conoces."
        />
      ) : (
        <section aria-label="Lista de resultados" className="flex flex-col gap-3">
          {/* El contador. "aria-live=polite" lo anuncia a lectores de pantalla cuando cambia (por ejemplo, al filtrar). */}
          <p className="text-sm text-slate-300" aria-live="polite">
            {findings.data.length} {findings.data.length === 1 ? "resultado" : "resultados"}
            {pending > 0 && ` · ${pending} pendiente${pending === 1 ? "" : "s"} de revisar`}
          </p>
          {/* Una tarjeta por resultado. */}
          {findings.data.map((finding) => (
            <FindingCard key={finding.id} projectId={project.id} finding={finding} />
          ))}
        </section>
      )}
    </div>
  );
}
