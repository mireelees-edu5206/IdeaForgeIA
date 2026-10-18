import { useState } from "react";
import { FiCheck, FiEdit2, FiExternalLink, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { errorMessageFrom } from "../../../lib/formErrors";
import { safeHref } from "../../research/constants";
import type { Finding } from "../../findings/types";
import { ATTRIBUTE_LABELS, LEVEL_LABELS, PRIORITY_LABELS, RESOLUTION_STATUS_LABELS, RISK_CATEGORY_LABELS, VALIDATION_STATUS_LABELS } from "../constants";
import { useDeleteAnalysisItem, useUpdateAnalysisItem } from "../queries";
import type {
  AnalysisItem,
  AnalysisKindKey,
  AnalysisUpdate,
  FindingBrief,
  MissingInformation,
  Opportunity,
  ResolutionStatus,
  Risk,
  ValidationHypothesis,
  ValidationStatus,
} from "../types";
import { AnalysisItemForm } from "./AnalysisItemForm";

const VALIDATION_OPTIONS = (Object.keys(VALIDATION_STATUS_LABELS) as ValidationStatus[]).map((value) => ({
  value,
  label: VALIDATION_STATUS_LABELS[value],
}));
const RESOLUTION_OPTIONS = (Object.keys(RESOLUTION_STATUS_LABELS) as ResolutionStatus[]).map((value) => ({
  value,
  label: RESOLUTION_STATUS_LABELS[value],
}));

interface AnalysisItemCardProps {
  projectId: string;
  kind: AnalysisKindKey;
  item: AnalysisItem;
  findings: Finding[];
}

export function AnalysisItemCard({ projectId, kind, item, findings }: AnalysisItemCardProps) {
  const update = useUpdateAnalysisItem(projectId);
  const remove = useDeleteAnalysisItem(projectId);
  const [editing, setEditing] = useState(false);
  const headingId = `analysis-${item.id}`;
  const rejected = item.review_status === "rejected";
  const linkedFindings = item.findings;

  async function save(data: AnalysisUpdate) {
    await update.mutateAsync({ kind, itemId: item.id, data });
  }

  if (editing) {
    return (
      <article aria-labelledby={headingId} className="glass rounded-2xl p-5">
        <h3 id={headingId} className="mb-4 font-semibold">Editar análisis</h3>
        <AnalysisItemForm
          kind={kind}
          initial={item}
          findings={findings}
          pending={update.isPending}
          error={update.error}
          onSubmit={(submission) => {
            if (!("itemId" in submission)) return Promise.resolve();
            return save(submission.data);
          }}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </article>
    );
  }

  const title = "title" in item ? item.title : "statement" in item ? item.statement : (item as MissingInformation).question;
  return (
    <article aria-labelledby={headingId} className={cn("glass flex flex-col gap-3 rounded-2xl p-5", rejected && "opacity-60")}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs ring-1", item.origin === "ai" ? "bg-violet-400/10 text-violet-200 ring-violet-300/25" : "bg-slate-400/10 text-slate-300 ring-slate-300/20")}>
            {item.origin === "ai" ? "Análisis de IA" : "Aportado por ti"}
          </span>
          <span className="neo-inset rounded-full px-2.5 py-1 text-xs text-slate-300">{item.review_status === "proposed" ? "Sin revisar" : item.review_status === "accepted" ? "Aceptado" : "Rechazado"}</span>
        </div>
      </header>
      <h3 id={headingId} className={cn("font-semibold leading-relaxed text-slate-100", rejected && "line-through")}>{title}</h3>

      {kind === "opportunities" && <OpportunityDetails item={item as Opportunity} />}
      {kind === "risks" && <RiskDetails item={item as Risk} />}
      {kind === "hypotheses" && <HypothesisDetails item={item as ValidationHypothesis} onChange={(validation_status) => void save({ validation_status })} pending={update.isPending} />}
      {kind === "missing-information" && <MissingInformationDetails item={item as MissingInformation} onChange={(resolution_status) => void save({ resolution_status })} pending={update.isPending} />}

      {(kind === "opportunities" || kind === "risks") && (
        <EvidenceLinks itemFindings={linkedFindings} allFindings={findings} fromAi={item.origin === "ai"} />
      )}
      {(kind === "hypotheses" || kind === "missing-information") && linkedFindings.length > 0 && (
        <EvidenceLinks itemFindings={linkedFindings} allFindings={findings} fromAi={item.origin === "ai"} />
      )}

      {(update.isError || remove.isError) && <Alert>{errorMessageFrom(update.error ?? remove.error)}</Alert>}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {item.origin === "ai" && item.review_status !== "accepted" && (
          <Button size="sm" variant="secondary" disabled={update.isPending} icon={<FiCheck aria-hidden="true" />} onClick={() => void save({ review_status: "accepted" })}>Aceptar</Button>
        )}
        {item.origin === "ai" && item.review_status !== "rejected" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiX aria-hidden="true" />} onClick={() => void save({ review_status: "rejected" })}>Rechazar</Button>
        )}
        {item.origin === "ai" && item.review_status !== "proposed" && (
          <Button size="sm" variant="ghost" disabled={update.isPending} icon={<FiRotateCcw aria-hidden="true" />} onClick={() => void save({ review_status: "proposed" })}>Deshacer revisión</Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar análisis" onClick={() => setEditing(true)}><FiEdit2 aria-hidden="true" /></Button>
        {item.origin === "user" && (
          <Button size="icon" variant="ghost" aria-label="Eliminar análisis" className="hover:text-rose-300" onClick={() => void remove.mutateAsync({ kind, itemId: item.id }).catch(() => undefined)}>
            <FiTrash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </article>
  );
}

function OpportunityDetails({ item }: { item: Opportunity }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
      <p className="text-xs text-slate-400">Potencial estimado: <span className="text-slate-200">{LEVEL_LABELS[item.potential]}</span></p>
    </>
  );
}

function RiskDetails({ item }: { item: Risk }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-300">{item.description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="neo-inset rounded-full px-2.5 py-1">{RISK_CATEGORY_LABELS[item.category]}</span>
        <span className="neo-inset rounded-full px-2.5 py-1">Probabilidad: {LEVEL_LABELS[item.likelihood]}</span>
        <span className="neo-inset rounded-full px-2.5 py-1">Impacto: {LEVEL_LABELS[item.impact]}</span>
      </div>
      {item.mitigation && <p className="text-sm text-slate-300"><span className="font-medium text-slate-200">Mitigación posible: </span>{item.mitigation}</p>}
    </>
  );
}

function HypothesisDetails({ item, onChange, pending }: { item: ValidationHypothesis; onChange: (value: ValidationHypothesis["validation_status"]) => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-300">
      <div className="grid gap-3 sm:grid-cols-2">
        <p>Prioridad: <span className="text-slate-100">{PRIORITY_LABELS[item.priority]}</span></p>
        {item.related_attribute && <p>Atributo: <span className="text-slate-100">{ATTRIBUTE_LABELS[item.related_attribute]}</span></p>}
      </div>
      {item.validation_method && <p><span className="font-medium text-slate-200">Cómo validarla: </span>{item.validation_method}</p>}
      {item.success_criteria && <p><span className="font-medium text-slate-200">Criterio de éxito: </span>{item.success_criteria}</p>}
      {item.result_notes && <p><span className="font-medium text-slate-200">Notas del resultado: </span>{item.result_notes}</p>}
      <Select label="Estado de validación" value={item.validation_status} options={VALIDATION_OPTIONS} onChange={onChange} disabled={pending} />
    </div>
  );
}

function MissingInformationDetails({ item, onChange, pending }: { item: MissingInformation; onChange: (value: MissingInformation["resolution_status"]) => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-300">
      {item.reason && <p><span className="font-medium text-slate-200">Importancia / siguiente paso sugerido: </span>{item.reason}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>Prioridad: {PRIORITY_LABELS[item.priority]}{item.related_attribute ? ` · ${ATTRIBUTE_LABELS[item.related_attribute]}` : ""}</span>
        <Select label="Estado" value={item.resolution_status} options={RESOLUTION_OPTIONS} onChange={onChange} disabled={pending} className="w-full sm:min-w-40" />
      </div>
      {item.resolution_notes && <p><span className="font-medium text-slate-200">Notas: </span>{item.resolution_notes}</p>}
    </div>
  );
}

function EvidenceLinks({ itemFindings, allFindings, fromAi }: { itemFindings: FindingBrief[]; allFindings: Finding[]; fromAi: boolean }) {
  return (
    <section className="neo-inset rounded-xl p-3" aria-label="Trazabilidad de evidencia">
      <p className="mb-2 text-xs font-semibold text-slate-300">
        {fromAi ? "Interpretación de IA, no un hecho comprobado" : "Hallazgos relacionados"}
      </p>
      {itemFindings.length === 0 ? (
        <p className="text-xs text-amber-200">Pendiente de comprobar: no hay hallazgos asociados.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itemFindings.map((brief) => {
            const finding = allFindings.find((candidate) => candidate.id === brief.id);
            return (
              <li key={brief.id} className="border-l-2 border-accent-cyan/30 pl-3">
                <p className="text-sm text-slate-200">{brief.statement}</p>
                {finding?.evidence.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {finding.evidence.map((evidence) => {
                      const href = safeHref(evidence.source.url);
                      return (
                        <li key={evidence.evidence_id} className="text-xs text-slate-400">
                          <blockquote>«{evidence.content}»</blockquote>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 hover:text-accent-cyan hover:underline">
                              {evidence.source.title ?? evidence.source.domain} · {evidence.source.domain}
                              <FiExternalLink aria-hidden="true" className="size-3" />
                              <span className="sr-only">(se abre en una pestaña nueva)</span>
                            </a>
                          ) : <span>{evidence.source.domain}</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mt-1 text-xs text-slate-500">El hallazgo no tiene evidencia externa vinculada.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
