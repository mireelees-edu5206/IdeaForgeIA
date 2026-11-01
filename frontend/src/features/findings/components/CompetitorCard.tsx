/**
 * ARCHIVO: findings/components/CompetitorCard.tsx
 *
 * ¿Qué es?
 * Es la tarjeta de una alternativa o competidor. Muestra el nombre, su tipo de entidad, su sitio
 * web, su análisis, cuántos resultados la mencionan, y dos selectores para cambiar qué tan parecida
 * es y qué tan fuerte parece. También tiene los botones de revisión.
 *
 * ¿Para qué sirve?
 * Permite a la persona juzgar cada alternativa del mercado: si es parecida, si representa riesgo,
 * y si la acepta o la descarta. El análisis que viene de la IA se marca como interpretación, no como hecho.
 *
 * ¿Quién la usa?
 * CompetitorsTab.tsx, una tarjeta por cada competidor, agrupadas por tipo.
 *
 * Detalle: "Quitar" solo aparece en las opciones que añadió la persona. Las de la IA se rechazan, no se quitan.
 */

/* "useState" guarda si la ventana de quitar está abierta. */
import { useState } from "react";
/* Iconos: palomita, X, deshacer, enlace externo y basura. */
import { FiCheck, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Select } from "../../../components/ui/Select";
/* Une clases y convierte errores a texto. */
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
/* Función que valida enlaces seguros (de la carpeta de investigación). */
import { safeHref } from "../../research/constants";
/* Textos de tipo de competidor, de entidad y de niveles. */
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, ENTITY_TYPE_LABELS, LEVEL_LABELS, LEVEL_VALUES } from "../constants";
/* Acciones de cambiar y quitar un competidor, desde la caché. */
import { useDeleteCompetitor, useUpdateCompetitor } from "../queries";
/* Tipos del competidor y de la revisión. */
import type { Competitor, ReviewStatus } from "../types";
/* Etiquetas de procedencia y de riesgo. */
import { ProvenanceBadge, ThreatBadge } from "./badges";

/**
 * TYPE_OPTIONS es la lista de tipos de competidor para el menú "Qué tan parecida es":
 * cada tipo con su nombre corto (por ejemplo "Muy parecida").
 */
/** Catalogo TYPE_OPTIONS que define etiquetas o reglas de resultados. */
const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));
/** THREAT_OPTIONS es la lista de niveles de amenaza para el menú "Qué tan fuerte parece". */
/** Define THREAT_OPTIONS para el bloque de resultados. */
const THREAT_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

/**
 * CompetitorCard dibuja la tarjeta de un competidor.
 *
 * Recibe:
 * - projectId: el proyecto al que pertenece.
 * - competitor: el competidor completo (su entidad, tipo, amenaza, revisión y origen).
 */
/** Expone la funcion competitor card para el flujo de findings. */
export function CompetitorCard({ projectId, competitor }: { projectId: string; competitor: Competitor }) {
  // Las acciones de cambiar y quitar este competidor.
  const update = useUpdateCompetitor(projectId);
  const remove = useDeleteCompetitor(projectId);
  // Si la ventana de "¿quitar?" está abierta.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // La entidad (nombre, sitio, descripción) que está dentro del competidor. Es más cómodo tenerla a mano.
  const { entity } = competitor;
  // El enlace al sitio web, solo si existe y es seguro. Si no, es undefined.
  const href = entity.website ? safeHref(entity.website) : undefined;
  // Un identificador único para el nombre de la tarjeta (para lectores de pantalla).
  const headingId = `competidor-${competitor.id}`;
  // ¿Está rechazado? Si sí, se ve apagado y el nombre tachado.
  const rejected = competitor.review_status === "rejected";
  // Función corta para cambiar la revisión (aceptar, rechazar o volver a proponer).
  /** Define review para el bloque de resultados. */
  const review = (review_status: ReviewStatus) => update.mutate({ competitorId: competitor.id, review_status });

  return (
    // La tarjeta. "cn" la apaga si está rechazada.
    <article aria-labelledby={headingId} className={cn("surface-panel flex flex-col gap-3 rounded-2xl p-5", rejected && "opacity-60")}>
      {/* La cabecera: nombre y tipo de entidad a la izquierda, riesgo y procedencia a la derecha. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={headingId} className={cn("font-semibold text-slate-100", rejected && "line-through")}>
            {entity.name}
          </h4>
          <p className="text-xs text-slate-400">
            {ENTITY_TYPE_LABELS[entity.entity_type]}
            {/* Cuántos resultados la mencionan, solo si hay al menos uno. */}
            {competitor.finding_count > 0 &&
              ` · aparece en ${competitor.finding_count} ${competitor.finding_count === 1 ? "resultado" : "resultados"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThreatBadge level={competitor.threat_level} />
          <ProvenanceBadge origin={competitor.origin} review={competitor.review_status} />
        </div>
      </div>

      {/* El sitio web, como enlace en pestaña nueva. Solo si la dirección es segura. */}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 self-start break-all text-xs text-slate-300 hover:text-accent-cyan hover:underline"
        >
          {entity.website} <FiExternalLink aria-hidden="true" className="size-3 shrink-0" />
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
      )}
      {/* La descripción y el análisis van plegados, para que la tarjeta no ocupe tanto espacio en el celular. */}
      {(entity.description || competitor.rationale) && (
        <details className="rounded-xl bg-slate-400/5 px-3 py-2 text-sm text-slate-300">
          <summary className="flex min-h-9 cursor-pointer list-none items-center text-xs font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
            Ver descripción y análisis
          </summary>
          {/* La descripción de la entidad, si existe. */}
          {entity.description && <p className="mt-2 text-sm text-slate-300">{entity.description}</p>}
          {/* El análisis del competidor, si existe. Lleva una etiqueta que dice de quién es. */}
          {competitor.rationale && (
            <p className="mt-2 border-l-2 border-kind-analysis/50 pl-3 text-sm text-slate-300">
              {/* Si es de la IA, se aclara que es interpretación y no un hecho comprobado. */}
              <span className="block text-xs font-medium text-kind-analysis">
                {competitor.origin === "ai" ? "Análisis de la IA (interpretación, no un hecho)" : "Tu análisis"}
              </span>
              {competitor.rationale}
            </p>
          )}
        </details>
      )}

      {/* Los dos menús para cambiar el tipo y la amenaza. Al elegir, se guarda de inmediato. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={`Qué tan parecida es la opción ${entity.name}`}
          value={competitor.competitor_type}
          options={TYPE_OPTIONS}
          disabled={update.isPending}
          onChange={(competitor_type) => update.mutate({ competitorId: competitor.id, competitor_type })}
        />
        <Select
          label={`Qué tan fuerte parece la opción ${entity.name}`}
          value={competitor.threat_level}
          options={THREAT_OPTIONS}
          disabled={update.isPending}
          onChange={(threat_level) => update.mutate({ competitorId: competitor.id, threat_level })}
        />
      </div>

      {/* Errores de cambiar o quitar. "??" toma el de cambiar; si no hay, el de quitar. */}
      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}

      {/* Los botones de revisión. Cada uno aparece solo cuando tiene sentido en el estado actual. */}
      <div className="flex flex-wrap justify-end gap-1">
        {/* Aceptar: solo si todavía no está aceptado. */}
        {competitor.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => review("accepted")}>
            Aceptar
          </Button>
        )}
        {/* Rechazar: solo si todavía no está rechazado. */}
        {competitor.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => review("rejected")}>
            Rechazar
          </Button>
        )}
        {/* Deshacer: solo para opciones de la IA ya revisadas. Vuelve a "sin revisar". */}
        {competitor.origin === "ai" && competitor.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => review("proposed")}>
            Deshacer revisión
          </Button>
        )}
        {/* Quitar: solo para opciones que añadió la persona. Abre la confirmación. */}
        {competitor.origin === "user" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Quitar opción ${entity.name}`}
            className="hover:text-rose-300"
            onClick={() => setConfirmDelete(true)}
          >
            <FiTrash2 aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* La ventana de confirmación para quitar. Aclara que sus resultados y fuentes se conservan. */}
      <ConfirmDialog
        open={confirmDelete}
        title="¿Quitar esta opción?"
        confirmLabel="Quitar"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(competitor.id, { onSettled: () => setConfirmDelete(false) })}
      >
        <p>
          <strong className="text-slate-100">{entity.name}</strong> dejará de aparecer en esta lista. Sus resultados y fuentes se conservan.
        </p>
      </ConfirmDialog>
    </article>
  );
}
