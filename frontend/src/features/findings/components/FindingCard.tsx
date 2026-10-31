/**
 * ARCHIVO: findings/components/FindingCard.tsx
 *
 * ¿Qué es?
 * Es la tarjeta de un resultado. Muestra la frase, el tema, el nivel de confianza, de quién viene
 * y, al desplegar "Ver fuente y cita", las fuentes que lo respaldan o contradicen. También tiene
 * los botones para aceptar, rechazar, editar o borrar.
 *
 * ¿Para qué sirve?
 * Es donde la persona revisa cada resultado: lee la evidencia, decide si lo acepta y, si es suyo,
 * lo corrige o lo borra. Un resultado rechazado se ve tachado y apagado, para que no se confunda con uno vigente.
 *
 * ¿Quién la usa?
 * FindingsTab.tsx, una tarjeta por cada resultado de la lista.
 *
 * Qué ve la persona según el caso:
 * - Modo normal: la tarjeta con sus etiquetas, la frase, la evidencia desplegable y los botones.
 * - Modo edición: el formulario de FindingForm dentro de la misma tarjeta.
 * - Resultado sin fuente vinculada: un texto gris que lo dice.
 * - Resultado rechazado: tachado y con menos opacidad.
 */

/* "useState" guarda si la tarjeta está en modo edición y si la ventana de borrar está abierta. */
import { useState } from "react";
/* Iconos: palomita (aceptar), flecha (desplegar), lápiz (editar), enlace externo, deshacer, basura, X (rechazar). */
import { FiCheck, FiChevronDown, FiEdit2, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
/* Une clases de estilo que pueden o no aparecer. */
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
/* La etiqueta de tema (de la carpeta de investigación) y la función que valida enlaces seguros. */
import { CategoryBadge } from "../../research/components/badges";
import { safeHref } from "../../research/constants";
/* Nombres en español de los tipos de entidad. */
import { ENTITY_TYPE_LABELS } from "../constants";
/* Las acciones de cambiar y borrar un resultado, desde la caché. */
import { useDeleteFinding, useUpdateFinding } from "../queries";
/* Ficha del resultado y tipo de revisión. */
import type { Finding, ReviewStatus } from "../types";
/* Etiquetas de confianza, procedencia y postura de la evidencia. */
import { ConfidenceBadge, ProvenanceBadge, StanceBadge } from "./badges";
/* El formulario que se usa para editar el resultado. */
import { FindingForm } from "./FindingForm";

/**
 * FindingCard dibuja la tarjeta de un resultado (o su formulario de edición).
 *
 * Recibe:
 * - projectId: el proyecto al que pertenece el resultado.
 * - finding: el resultado completo con su evidencia.
 */
/** Expone la funcion finding card para el flujo de findings. */
export function FindingCard({ projectId, finding }: { projectId: string; finding: Finding }) {
  // La acción de cambiar el resultado (revisar, editar) y la de borrarlo.
  const update = useUpdateFinding(projectId);
  const remove = useDeleteFinding(projectId);
  // "editing": si la tarjeta está mostrando el formulario de edición.
  const [editing, setEditing] = useState(false);
  // "confirmDelete": si la ventana de "¿seguro?" está abierta.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Un identificador único para el título, para que la tarjeta se identifique ante lectores de pantalla.
  const headingId = `resultado-${finding.id}`;
  // ¿Está rechazado? Si sí, se ve tachado y apagado.
  const rejected = finding.review_status === "rejected";
  // Función corta para cambiar la revisión (aceptar, rechazar o volver a proponer).
  /** Define review para el bloque de resultados. */
  const review = (review_status: ReviewStatus) => update.mutate({ findingId: finding.id, review_status });

  // Modo edición: en lugar de la tarjeta, mostramos el formulario con los datos actuales.
  /** Rama condicional: editing. */
  if (editing) {
    return (
      <article aria-labelledby={headingId} className="surface-panel rounded-2xl p-5">
        <h3 id={headingId} className="mb-4 font-semibold">
          Editar resultado
        </h3>
        <FindingForm
          // Los valores de partida son los del resultado actual. "?? ''" usa texto vacío si no hay justificación.
          initial={{
            finding_type: finding.finding_type,
            statement: finding.statement,
            confidence_level: finding.confidence_level,
            confidence_rationale: finding.confidence_rationale ?? "",
          }}
          submitLabel="Guardar"
          pending={update.isPending}
          error={update.error}
          // Si es de la IA, avisamos que al editarlo pasa a ser información de la persona (la fuente se conserva).
          note={
            finding.origin === "ai"
              ? "Al guardar cambios, este resultado quedará como información tuya; la fuente vinculada se conserva."
              : undefined
          }
          // Al guardar bien, salimos del modo edición.
          onSubmit={(data) =>
            update.mutateAsync({ findingId: finding.id, ...data }).then(() => setEditing(false))
          }
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </article>
    );
  }

  // El estilo de la tarjeta depende de la confianza: alta destaca con un borde verde, media es normal,
  // y baja o indeterminada se ve "nublada" (fog-uncertain), para que nadie la tome como firme.
  const confidenceSurface =
    finding.confidence_level === "high"
      ? "stage-3d ring-1 ring-kind-finding/35"
      : finding.confidence_level === "medium"
        ? "surface-panel"
        : "fog-uncertain";

  return (
    // La tarjeta. "tilt-3d" le da un leve movimiento al pasar el mouse; "cn" añade el estilo de confianza y, si está rechazada, la apaga.
    <article
      aria-labelledby={headingId}
      className={cn(
        "tilt-3d flex flex-col gap-3 rounded-3xl p-5",
        confidenceSurface,
        rejected && "opacity-55 saturate-50",
      )}
    >
      {/* Las etiquetas de arriba: tema, confianza y procedencia con revisión. */}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={finding.finding_type} />
        <ConfidenceBadge level={finding.confidence_level} />
        <ProvenanceBadge origin={finding.origin} review={finding.review_status} />
      </div>

      {/* La frase del resultado. Si está rechazado, se tacha. */}
      <h3 id={headingId} className={cn("leading-relaxed text-slate-100", rejected && "line-through")}>
        {finding.statement}
      </h3>

      {/* La justificación de la confianza, solo si existe. */}
      {finding.confidence_rationale && (
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-300">Por qué parece confiable: </span>
          {finding.confidence_rationale}
        </p>
      )}

      {/* Los nombres que aparecen en el resultado, como etiquetas. Solo si hay alguno. */}
      {finding.entities.length > 0 && (
        <ul aria-label="Entidades relacionadas" className="flex flex-wrap gap-2">
          {finding.entities.map((entity) => (
            <li key={entity.id} className="neo-inset rounded-full px-3 py-1 text-xs text-slate-300">
              {entity.name} <span className="text-slate-500">· {ENTITY_TYPE_LABELS[entity.entity_type]}</span>
            </li>
          ))}
        </ul>
      )}

      {/* La evidencia: desplegable si hay fuentes; si no, un aviso de que todavía no hay fuente vinculada. */}
      {finding.evidence.length > 0 ? (
        <details className="neo-inset group rounded-xl">
          {/* El botón para desplegar. La flecha gira cuando está abierto. */}
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 [&::-webkit-details-marker]:hidden">
            <FiChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" />
            Ver fuente y cita ({finding.evidence.length})
          </summary>
          <ul className="flex flex-col gap-3 px-3 pb-3">
            {/* Cada pieza de evidencia: su postura, el fragmento citado y la fuente. */}
            {finding.evidence.map((item) => {
              // Dirección segura de la fuente, o null si no lo es.
              const href = safeHref(item.source.url);
              return (
                <li key={item.evidence_id} className="flex flex-col gap-1.5 border-l-2 border-kind-evidence/40 pl-3">
                  <StanceBadge stance={item.stance} />
                  {/* El fragmento tomado de la fuente, entre comillas latinas (« »). */}
                  <blockquote className="text-sm text-slate-200">«{item.content}»</blockquote>
                  {href ? (
                    // Enlace a la fuente, en pestaña nueva.
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 self-start text-xs text-slate-400 hover:text-accent-cyan hover:underline"
                    >
                      {item.source.title ?? item.source.domain} · {item.source.domain}
                      <FiExternalLink aria-hidden="true" className="size-3" />
                      <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                  ) : (
                    // Dirección no segura: solo el dominio, sin enlace.
                    <span className="text-xs text-slate-400">{item.source.domain}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : (
        <p className="text-xs text-slate-500">Todavía no hay una fuente vinculada.</p>
      )}

      {/* Si falló cambiar o borrar, mostramos el motivo. "??" toma el error de cambiar; si no hay, el de borrar. */}
      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}

      {/* Los botones de revisión. Cada uno aparece solo si tiene sentido en el estado actual. */}
      <div className="flex flex-wrap justify-end gap-1">
        {/* Aceptar: solo si todavía no está aceptado. */}
        {finding.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => review("accepted")}>
            Aceptar
          </Button>
        )}
        {/* Rechazar: solo si todavía no está rechazado. */}
        {finding.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => review("rejected")}>
            Rechazar
          </Button>
        )}
        {/* Deshacer: solo para resultados de la IA que ya fueron revisados. Vuelve a "sin revisar". */}
        {finding.origin === "ai" && finding.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => review("proposed")}>
            Deshacer revisión
          </Button>
        )}
        {/* Editar: siempre disponible. El botón solo tiene icono, por eso lleva "aria-label". */}
        <Button size="icon" variant="ghost" aria-label="Editar resultado" onClick={() => setEditing(true)}>
          <FiEdit2 aria-hidden="true" />
        </Button>
        {/* Borrar: solo para resultados que escribió la persona. Los de la IA no se borran, solo se rechazan. */}
        {finding.origin === "user" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Eliminar resultado"
            className="hover:text-rose-300"
            onClick={() => setConfirmDelete(true)}
          >
            <FiTrash2 aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* La ventana de confirmación para borrar. Al terminar (bien o mal), se cierra. */}
      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar este resultado?"
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(finding.id, { onSettled: () => setConfirmDelete(false) })}
      >
        <p>Se borrará el resultado que aportaste. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </article>
  );
}
