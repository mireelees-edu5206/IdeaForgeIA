import { useState } from "react";
import { FiCheck, FiChevronDown, FiEdit2, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
import { CategoryBadge } from "../../research/components/badges";
import { safeHref } from "../../research/constants";
import { ENTITY_TYPE_LABELS } from "../constants";
import { useDeleteFinding, useUpdateFinding } from "../queries";
import type { Finding, ReviewStatus } from "../types";
import { ConfidenceBadge, ProvenanceBadge, StanceBadge } from "./badges";
import { FindingForm } from "./FindingForm";

export function FindingCard({ projectId, finding }: { projectId: string; finding: Finding }) {
  const update = useUpdateFinding(projectId);
  const remove = useDeleteFinding(projectId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headingId = `resultado-${finding.id}`;
  const rejected = finding.review_status === "rejected";
  const review = (review_status: ReviewStatus) => update.mutate({ findingId: finding.id, review_status });

  if (editing) {
    return (
      <article aria-labelledby={headingId} className="surface-panel rounded-2xl p-5">
        <h3 id={headingId} className="mb-4 font-semibold">
          Editar resultado
        </h3>
        <FindingForm
          initial={{
            finding_type: finding.finding_type,
            statement: finding.statement,
            confidence_level: finding.confidence_level,
            confidence_rationale: finding.confidence_rationale ?? "",
          }}
          submitLabel="Guardar"
          pending={update.isPending}
          error={update.error}
          note={
            finding.origin === "ai"
              ? "Al guardar cambios, este resultado quedará como información tuya; la fuente vinculada se conserva."
              : undefined
          }
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

  const confidenceSurface =
    finding.confidence_level === "high"
      ? "stage-3d ring-1 ring-kind-finding/35"
      : finding.confidence_level === "medium"
        ? "surface-panel"
        : "fog-uncertain";

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "tilt-3d flex flex-col gap-3 rounded-3xl p-5",
        confidenceSurface,
        rejected && "opacity-55 saturate-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={finding.finding_type} />
        <ConfidenceBadge level={finding.confidence_level} />
        <ProvenanceBadge origin={finding.origin} review={finding.review_status} />
      </div>

      <h3 id={headingId} className={cn("leading-relaxed text-slate-100", rejected && "line-through")}>
        {finding.statement}
      </h3>

      {finding.confidence_rationale && (
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-300">Por qué parece confiable: </span>
          {finding.confidence_rationale}
        </p>
      )}

      {finding.entities.length > 0 && (
        <ul aria-label="Entidades relacionadas" className="flex flex-wrap gap-2">
          {finding.entities.map((entity) => (
            <li key={entity.id} className="neo-inset rounded-full px-3 py-1 text-xs text-slate-300">
              {entity.name} <span className="text-slate-500">· {ENTITY_TYPE_LABELS[entity.entity_type]}</span>
            </li>
          ))}
        </ul>
      )}

      {finding.evidence.length > 0 ? (
        <details className="neo-inset group rounded-xl">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 [&::-webkit-details-marker]:hidden">
            <FiChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" />
            Ver fuente y cita ({finding.evidence.length})
          </summary>
          <ul className="flex flex-col gap-3 px-3 pb-3">
            {finding.evidence.map((item) => {
              const href = safeHref(item.source.url);
              return (
                <li key={item.evidence_id} className="flex flex-col gap-1.5 border-l-2 border-kind-evidence/40 pl-3">
                  <StanceBadge stance={item.stance} />
                  <blockquote className="text-sm text-slate-200">«{item.content}»</blockquote>
                  {href ? (
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

      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}

      <div className="flex flex-wrap justify-end gap-1">
        {finding.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => review("accepted")}>
            Aceptar
          </Button>
        )}
        {finding.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => review("rejected")}>
            Rechazar
          </Button>
        )}
        {finding.origin === "ai" && finding.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => review("proposed")}>
            Deshacer revisión
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar resultado" onClick={() => setEditing(true)}>
          <FiEdit2 aria-hidden="true" />
        </Button>
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
