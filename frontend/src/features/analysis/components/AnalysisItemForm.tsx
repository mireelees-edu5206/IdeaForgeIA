import { type FormEvent, useState } from "react";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { errorMessageFrom } from "../../../lib/formErrors";
import { ATTRIBUTE_TYPES, ATTRIBUTE_META } from "../../projects/constants";
import type { AttributeType } from "../../projects/types";
import type { Finding, Level } from "../../findings/types";
import { LEVEL_LABELS, PRIORITY_LABELS, RISK_CATEGORY_LABELS } from "../constants";
import type {
  AnalysisCreateInput,
  AnalysisItem,
  AnalysisKindKey,
  AnalysisUpdate,
  Priority,
  ResolutionStatus,
  RiskCategory,
  ValidationStatus,
} from "../types";

const LEVEL_OPTIONS = (Object.keys(LEVEL_LABELS) as Level[]).map((value) => ({ value, label: LEVEL_LABELS[value] }));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({ value, label: PRIORITY_LABELS[value] }));
const CATEGORY_OPTIONS = (Object.keys(RISK_CATEGORY_LABELS) as RiskCategory[]).map((value) => ({ value, label: RISK_CATEGORY_LABELS[value] }));
const ATTRIBUTE_OPTIONS = [
  { value: "none", label: "Sin atributo relacionado" },
  ...ATTRIBUTE_TYPES.map((value) => ({ value, label: ATTRIBUTE_META[value].label })),
];

export type AnalysisSubmission =
  | AnalysisCreateInput
  | { kind: AnalysisKindKey; itemId: string; data: AnalysisUpdate };

interface AnalysisItemFormProps {
  kind: AnalysisKindKey;
  initial?: AnalysisItem;
  findings: Finding[];
  pending: boolean;
  error: unknown;
  onSubmit: (submission: AnalysisSubmission) => Promise<unknown>;
  onCancel: () => void;
}

export function AnalysisItemForm({ kind, initial, findings, pending, error, onSubmit, onCancel }: AnalysisItemFormProps) {
  const [title, setTitle] = useState(initial && "title" in initial ? initial.title : "");
  const [description, setDescription] = useState(initial && "description" in initial ? initial.description : "");
  const [potential, setPotential] = useState(initial && "potential" in initial ? initial.potential : "undetermined");
  const [category, setCategory] = useState<RiskCategory>(initial && "category" in initial ? initial.category : "other");
  const [likelihood, setLikelihood] = useState(initial && "likelihood" in initial ? initial.likelihood : "undetermined");
  const [impact, setImpact] = useState(initial && "impact" in initial ? initial.impact : "undetermined");
  const [mitigation, setMitigation] = useState(initial && "mitigation" in initial ? (initial.mitigation ?? "") : "");
  const [statement, setStatement] = useState(initial && "statement" in initial ? initial.statement : "");
  const [relatedAttribute, setRelatedAttribute] = useState<AttributeType | "none">(
    initial && "related_attribute" in initial ? (initial.related_attribute ?? "none") : "none",
  );
  const [validationMethod, setValidationMethod] = useState(
    initial && "validation_method" in initial ? (initial.validation_method ?? "") : "",
  );
  const [successCriteria, setSuccessCriteria] = useState(
    initial && "success_criteria" in initial ? (initial.success_criteria ?? "") : "",
  );
  const [question, setQuestion] = useState(initial && "question" in initial ? initial.question : "");
  const [reason, setReason] = useState(initial && "reason" in initial ? (initial.reason ?? "") : "");
  const [priority, setPriority] = useState<Priority>(initial && "priority" in initial ? initial.priority : "medium");
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const mainText = kind === "opportunities" || kind === "risks" ? title : kind === "hypotheses" ? statement : question;
  const mainError = touched && !mainText.trim() ? "Completa este campo obligatorio." : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!mainText.trim()) return;
    let submission: AnalysisSubmission;
    if (kind === "opportunities") {
      const data = { title: title.trim(), description: description.trim(), potential };
      submission = initial
        ? { kind, itemId: initial.id, data: data as AnalysisUpdate }
        : { kind, data: { ...data, finding_ids: selectedFindings } };
    } else if (kind === "risks") {
      const data = {
        title: title.trim(),
        description: description.trim(),
        category,
        likelihood,
        impact,
        mitigation: mitigation.trim() || null,
      };
      submission = initial
        ? { kind, itemId: initial.id, data: data as AnalysisUpdate }
        : { kind, data: { ...data, finding_ids: selectedFindings } };
    } else if (kind === "hypotheses") {
      const data = {
        statement: statement.trim(),
        related_attribute: relatedAttribute === "none" ? null : relatedAttribute,
        validation_method: validationMethod.trim() || null,
        success_criteria: successCriteria.trim() || null,
        priority,
      };
      submission = initial
        ? { kind, itemId: initial.id, data: data as AnalysisUpdate }
        : { kind, data: { ...data, finding_ids: selectedFindings } };
    } else {
      const data = {
        question: question.trim(),
        reason: reason.trim() || null,
        related_attribute: relatedAttribute === "none" ? null : relatedAttribute,
        priority,
      };
      submission = initial ? { kind, itemId: initial.id, data: data as AnalysisUpdate } : { kind, data };
    }
    try {
      await onSubmit(submission);
    } catch {
      // El error de guardado se muestra debajo del formulario.
    }
  }

  function toggleFinding(id: string) {
    setSelectedFindings((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {(kind === "opportunities" || kind === "risks") && (
        <>
          <TextArea
            label={kind === "opportunities" ? "Oportunidad" : "Riesgo"}
            rows={2}
            maxLength={200}
            value={title}
            error={mainError}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <TextArea
            label="Descripción / interpretación"
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </>
      )}
      {kind === "opportunities" && (
        <Select label="Potencial estimado" value={potential} options={LEVEL_OPTIONS} onChange={setPotential} />
      )}
      {kind === "risks" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Categoría" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
            <Select label="Probabilidad estimada" value={likelihood} options={LEVEL_OPTIONS} onChange={setLikelihood} />
            <Select label="Impacto estimado" value={impact} options={LEVEL_OPTIONS} onChange={setImpact} />
          </div>
          <TextArea
            label="Mitigación posible (opcional)"
            rows={2}
            maxLength={4000}
            value={mitigation}
            onChange={(event) => setMitigation(event.target.value)}
          />
        </>
      )}
      {kind === "hypotheses" && (
        <>
          <TextArea
            label="¿Qué quieres comprobar?"
            rows={2}
            maxLength={4000}
            value={statement}
            error={mainError}
            onChange={(event) => setStatement(event.target.value)}
            required
          />
          <Select
            label="Parte de la idea relacionada"
            value={relatedAttribute}
            options={ATTRIBUTE_OPTIONS}
            onChange={(value) => setRelatedAttribute(value as AttributeType | "none")}
          />
          <TextArea
            label="¿Cómo podrías comprobarlo?"
            rows={2}
            maxLength={4000}
            value={validationMethod}
            onChange={(event) => setValidationMethod(event.target.value)}
          />
          <TextArea
            label="¿Qué resultado te daría confianza?"
            rows={2}
            maxLength={4000}
            value={successCriteria}
            onChange={(event) => setSuccessCriteria(event.target.value)}
          />
          <Select label="Prioridad" value={priority} options={PRIORITY_OPTIONS} onChange={(value) => setPriority(value as Priority)} />
        </>
      )}
      {kind === "missing-information" && (
        <>
          <TextArea
            label="¿Qué información falta?"
            rows={2}
            maxLength={4000}
            value={question}
            error={mainError}
            onChange={(event) => setQuestion(event.target.value)}
            required
          />
          <TextArea
            label="Importancia y cómo podría investigarse (opcional)"
            rows={3}
            maxLength={4000}
            value={reason}
            hint="Explica su impacto en el análisis y un posible siguiente paso para obtenerla."
            onChange={(event) => setReason(event.target.value)}
          />
          <Select
            label="Parte de la idea relacionada"
            value={relatedAttribute}
            options={ATTRIBUTE_OPTIONS}
            onChange={(value) => setRelatedAttribute(value as AttributeType | "none")}
          />
          <Select label="Prioridad" value={priority} options={PRIORITY_OPTIONS} onChange={(value) => setPriority(value as Priority)} />
        </>
      )}

      {!initial && kind !== "missing-information" && (
        <fieldset className="neo-inset flex flex-col gap-2 rounded-xl p-3">
          <legend className="px-1 text-sm font-medium text-slate-300">Resultados relacionados (opcional)</legend>
          {findings.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay resultados revisados que puedas vincular.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {findings.map((finding) => (
                <li key={finding.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedFindings.includes(finding.id)}
                      onChange={() => toggleFinding(finding.id)}
                      className="mt-1 accent-cyan-300"
                    />
                    <span>{finding.statement}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400">Sin resultados vinculados, esta sugerencia queda pendiente de revisión.</p>
        </fieldset>
      )}
      {initial?.origin === "ai" && (
        <p className="text-xs text-amber-200">Al editar, esta propuesta de IA pasará a ser contenido aportado por ti.</p>
      )}
      {error != null && <Alert>{errorMessageFrom(error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" loading={pending}>{initial ? "Guardar cambios" : "Crear"}</Button>
      </div>
    </form>
  );
}

export type { ValidationStatus, ResolutionStatus };
