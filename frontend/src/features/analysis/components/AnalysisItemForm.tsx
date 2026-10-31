/**
 * ARCHIVO: analysis/components/AnalysisItemForm.tsx
 *
 * ¿Qué es?
 * Es el formulario para crear o editar un elemento del análisis. Sus campos cambian según el tipo:
 * - Oportunidad: título, descripción y potencial.
 * - Riesgo: título, descripción, categoría, probabilidad, impacto y mitigación.
 * - Suposición: qué comprobar, parte de la idea, cómo comprobarlo, qué resultado daría confianza y prioridad.
 * - Pregunta sin responder: qué falta, por qué importa, parte de la idea y prioridad.
 *
 * ¿Para qué sirve?
 * Permite que la persona agregue sus propios elementos al análisis, o corrija los que propuso la IA.
 *
 * ¿Quién lo usa?
 * AnalysisTab.tsx (crear) y AnalysisItemCard.tsx (editar).
 *
 * Qué pasa al enviar: el campo principal (título, enunciado o pregunta) no puede estar vacío.
 * Si al crear se eligieron resultados, se envían sus ids (finding_ids). Al editar, solo se envían
 * los campos cambiados del tipo, sin ids.
 */

/* "FormEvent" es el tipo del evento de enviar. "useState" guarda lo que escribe la persona. */
import { type FormEvent, useState } from "react";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
/* Convierte errores a texto. */
import { errorMessageFrom } from "../../../lib/formErrors";
/* Lista de atributos de la idea y sus nombres (de la carpeta de proyectos). */
import { ATTRIBUTE_TYPES, ATTRIBUTE_META } from "../../projects/constants";
import type { AttributeType } from "../../projects/types";
/* Ficha de resultado y nivel. */
import type { Finding, Level } from "../../findings/types";
/* Textos de niveles, prioridades y categorías. */
import { LEVEL_LABELS, PRIORITY_LABELS, RISK_CATEGORY_LABELS } from "../constants";
/* Tipos de la carpeta de análisis. */
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

/**
 * LEVEL_OPTIONS es la lista de niveles (alta, media, baja, indeterminada) para los menús de potencial,
 * probabilidad e impacto. Se arma a partir de LEVEL_LABELS.
 */
/** Define LEVEL_OPTIONS para el bloque de analisis. */
const LEVEL_OPTIONS = (Object.keys(LEVEL_LABELS) as Level[]).map((value) => ({ value, label: LEVEL_LABELS[value] }));
/** PRIORITY_OPTIONS es la lista de prioridades (alta, media, baja) para el menú de prioridad. */
/** Define PRIORITY_OPTIONS para el bloque de analisis. */
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({ value, label: PRIORITY_LABELS[value] }));
/** CATEGORY_OPTIONS es la lista de categorías de riesgo para el menú de categoría. */
/** Define CATEGORY_OPTIONS para el bloque de analisis. */
const CATEGORY_OPTIONS = (Object.keys(RISK_CATEGORY_LABELS) as RiskCategory[]).map((value) => ({ value, label: RISK_CATEGORY_LABELS[value] }));
/**
 * ATTRIBUTE_OPTIONS es la lista de partes de la idea para el menú "Parte de la idea relacionada".
 * La primera opción, "none" (sin atributo relacionado), se pone a mano, antes de las partes reales.
 */
/** Define ATTRIBUTE_OPTIONS para el bloque de analisis. */
const ATTRIBUTE_OPTIONS = [
  { value: "none", label: "Sin atributo relacionado" },
  ...ATTRIBUTE_TYPES.map((value) => ({ value, label: ATTRIBUTE_META[value].label })),
];

/**
 * AnalysisSubmission es lo que el formulario entrega al enviar. Puede ser:
 * - Una creación: AnalysisCreateInput (tipo y datos, sin id).
 * - Una edición: el tipo, el id del elemento ("itemId") y los datos cambiados.
 */
/** Describe el contrato analysis submission utilizado por analysis. */
export type AnalysisSubmission =
  | AnalysisCreateInput
  | { kind: AnalysisKindKey; itemId: string; data: AnalysisUpdate };

/**
 * AnalysisItemFormProps describe lo que recibe el formulario:
 * - kind: el tipo de elemento.
 * - initial (opcional): el elemento a editar. Si no viene, el formulario es para crear.
 * - findings: los resultados que se pueden vincular (solo al crear).
 * - pending: true mientras se guarda.
 * - error: el error del último intento de guardar.
 * - onSubmit: función que recibe la sumisión lista para guardar.
 * - onCancel: función para cerrar sin guardar.
 */
/** Contrato de datos AnalysisItemFormProps utilizado por analisis. */
interface AnalysisItemFormProps {
  kind: AnalysisKindKey;
  initial?: AnalysisItem;
  findings: Finding[];
  pending: boolean;
  error: unknown;
  onSubmit: (submission: AnalysisSubmission) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * AnalysisItemForm dibuja el formulario según el tipo y maneja su envío.
 *
 * Cada campo empieza con el valor del elemento a editar (si existe). La mezcla de "&&" con "in"
 * significa: "si el elemento tiene ese campo, úsalo; si no, usa un valor por defecto".
 */
/** Expone la funcion analysis item form para el flujo de analysis. */
export function AnalysisItemForm({ kind, initial, findings, pending, error, onSubmit, onCancel }: AnalysisItemFormProps) {
  // Cada campo tiene su propia memoria. Si hay un elemento a editar, usamos sus valores; si no, valores por defecto.
  const [title, setTitle] = useState(initial && "title" in initial ? initial.title : "");
  const [description, setDescription] = useState(initial && "description" in initial ? initial.description : "");
  const [potential, setPotential] = useState(initial && "potential" in initial ? initial.potential : "undetermined");
  const [category, setCategory] = useState<RiskCategory>(initial && "category" in initial ? initial.category : "other");
  const [likelihood, setLikelihood] = useState(initial && "likelihood" in initial ? initial.likelihood : "undetermined");
  const [impact, setImpact] = useState(initial && "impact" in initial ? initial.impact : "undetermined");
  const [mitigation, setMitigation] = useState(initial && "mitigation" in initial ? (initial.mitigation ?? "") : "");
  const [statement, setStatement] = useState(initial && "statement" in initial ? initial.statement : "");
  // La parte de la idea relacionada: "none" significa que no hay ninguna.
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
  // Los ids de los resultados que la persona marcó para vincular (solo al crear).
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
  // "touched": si la persona ya intentó enviar. El error de "obligatorio" solo aparece después de eso.
  const [touched, setTouched] = useState(false);

  // El campo principal depende del tipo: título (oportunidad y riesgo), enunciado (suposición) o pregunta.
  const mainText = kind === "opportunities" || kind === "risks" ? title : kind === "hypotheses" ? statement : question;
  // Error del campo principal: solo si intentó enviar y está vacío.
  const mainError = touched && !mainText.trim() ? "Completa este campo obligatorio." : undefined;

  /**
   * submit arma la sumisión según el tipo y la envía. Si el campo principal está vacío, no envía.
   * Al editar, manda solo los campos del tipo con "as AnalysisUpdate"; al crear, agrega finding_ids.
   */
  /** Gestiona submit de analisis. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    // Marcamos que ya intentó enviar.
    setTouched(true);
    // Si el campo principal está vacío, no enviamos.
    /** Rama condicional: !mainText.trim(). */
    if (!mainText.trim()) return;
    let submission: AnalysisSubmission;
    // Oportunidad: al editar, solo título, descripción y potencial. Al crear, también los resultados vinculados.
    /** Rama condicional: kind === "opportunities". */
    if (kind === "opportunities") {
      const data = { title: title.trim(), description: description.trim(), potential };
      submission = initial
        ? { kind, itemId: initial.id, data: data as AnalysisUpdate }
        : { kind, data: { ...data, finding_ids: selectedFindings } };
    } else if (kind === "risks") {
      // Riesgo: la mitigación vacía se manda como null (sin dato), no como texto vacío.
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
      // Suposición: "none" se convierte en null (sin atributo). Los textos vacíos también van como null.
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
      // Pregunta sin responder: no lleva resultados vinculados, porque todavía no tiene respuestas.
      const data = {
        question: question.trim(),
        reason: reason.trim() || null,
        related_attribute: relatedAttribute === "none" ? null : relatedAttribute,
        priority,
      };
      submission = initial ? { kind, itemId: initial.id, data: data as AnalysisUpdate } : { kind, data };
    }
    // Intentamos guardar. Si falla, el error lo muestra el propio formulario (vía "error").
    /** Maneja fallos de la operacion del bloque analisis. */
    try {
      await onSubmit(submission);
    } catch {
      // El error de guardado se muestra debajo del formulario.
    }
  }

  /**
   * toggleFinding marca o desmarca un resultado para vincularlo. Si ya estaba, lo quita de la lista;
   * si no estaba, lo agrega. Así cada clic cambia el estado de esa casilla.
   */
  /** Gestiona toggle finding de analisis. */
  function toggleFinding(id: string) {
    setSelectedFindings((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    // "noValidate" desactiva las revisiones del navegador: usamos las nuestras, en español.
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* Oportunidad y riesgo: título y descripción. */}
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
      {/* Oportunidad: el potencial estimado. */}
      {kind === "opportunities" && (
        <Select label="Potencial estimado" value={potential} options={LEVEL_OPTIONS} onChange={setPotential} />
      )}
      {/* Riesgo: categoría, probabilidad e impacto en fila, y la mitigación posible. */}
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
      {/* Suposición: qué comprobar, parte de la idea, cómo comprobarlo, criterio de éxito y prioridad. */}
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
            // "as AttributeType | 'none'" le dice a TypeScript que el valor elegido es uno de esos dos tipos.
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
      {/* Pregunta sin responder: qué falta, importancia, parte de la idea y prioridad. */}
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

      {/* La lista de resultados para vincular: solo al crear, y solo para tipos que sí se vinculan. */}
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
                    {/* Casilla: marcada si el resultado ya está en la lista de seleccionados. */}
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
      {/* Aviso al editar una propuesta de la IA: al guardar, pasa a ser contenido de la persona. */}
      {initial?.origin === "ai" && (
        <p className="text-xs text-amber-200">Al editar, esta propuesta de IA pasará a ser contenido aportado por ti.</p>
      )}
      {/* El error del servidor, si lo hubo. */}
      {error != null && <Alert>{errorMessageFrom(error)}</Alert>}
      {/* Cancelar cierra sin guardar. Crear o Guardar cambios envía; el texto depende de si es edición. */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" loading={pending}>{initial ? "Guardar cambios" : "Crear"}</Button>
      </div>
    </form>
  );
}

// Reexporta los tipos de estado de validación y resolución para que otros archivos los puedan importar desde aquí.
export type { ValidationStatus, ResolutionStatus };
