import { useState } from "react";
import { FiCheck, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
import { safeHref } from "../../research/constants";
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, ENTITY_TYPE_LABELS, LEVEL_LABELS, LEVEL_VALUES } from "../constants";
import { useDeleteCompetitor, useUpdateCompetitor } from "../queries";
import type { Competitor, ReviewStatus } from "../types";
import { ProvenanceBadge, ThreatBadge } from "./badges";

const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));
const THREAT_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

export function CompetitorCard({ projectId, competitor }: { projectId: string; competitor: Competitor }) {
  const update = useUpdateCompetitor(projectId);
  const remove = useDeleteCompetitor(projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { entity } = competitor;
  const href = entity.website ? safeHref(entity.website) : undefined;
  const headingId = `competidor-${competitor.id}`;
  const rejected = competitor.review_status === "rejected";
  const review = (review_status: ReviewStatus) => update.mutate({ competitorId: competitor.id, review_status });

  return (
    <article aria-labelledby={headingId} className={cn("surface-panel flex flex-col gap-3 rounded-2xl p-5", rejected && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={headingId} className={cn("font-semibold text-slate-100", rejected && "line-through")}>
            {entity.name}
          </h4>
          <p className="text-xs text-slate-400">
            {ENTITY_TYPE_LABELS[entity.entity_type]}
            {competitor.finding_count > 0 &&
              ` · aparece en ${competitor.finding_count} ${competitor.finding_count === 1 ? "resultado" : "resultados"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThreatBadge level={competitor.threat_level} />
          <ProvenanceBadge origin={competitor.origin} review={competitor.review_status} />
        </div>
      </div>

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
      {entity.description && <p className="text-sm text-slate-300">{entity.description}</p>}
      {competitor.rationale && (
        <p className="rounded-xl border-l-2 border-kind-analysis/50 bg-kind-analysis/5 px-3 py-2 text-sm text-slate-300">
          <span className="block text-xs font-medium text-kind-analysis">
            {competitor.origin === "ai" ? "Análisis de la IA (interpretación, no un hecho)" : "Tu análisis"}
          </span>
          {competitor.rationale}
        </p>
      )}

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

      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}

      <div className="flex flex-wrap justify-end gap-1">
        {competitor.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => review("accepted")}>
            Aceptar
          </Button>
        )}
        {competitor.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => review("rejected")}>
            Rechazar
          </Button>
        )}
        {competitor.origin === "ai" && competitor.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => review("proposed")}>
            Deshacer revisión
          </Button>
        )}
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
