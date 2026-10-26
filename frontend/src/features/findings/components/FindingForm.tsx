import { type FormEvent, useState } from "react";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { errorMessageFrom } from "../../../lib/formErrors";
import { CATEGORY_LABELS } from "../../research/constants";
import type { ResearchCategory } from "../../research/types";
import { LEVEL_LABELS, LEVEL_VALUES, RATIONALE_MAX_LENGTH, STATEMENT_MAX_LENGTH } from "../constants";
import type { FindingInput, Level } from "../types";

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as ResearchCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));
const LEVEL_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

interface FindingFormProps {
  initial?: FindingInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  note?: string;
  onSubmit: (data: FindingInput) => Promise<unknown>;
  onCancel: () => void;
}

export function FindingForm({ initial, submitLabel, pending, error, note, onSubmit, onCancel }: FindingFormProps) {
  const [type, setType] = useState<ResearchCategory>(initial?.finding_type ?? "market");
  const [statement, setStatement] = useState(initial?.statement ?? "");
  const [level, setLevel] = useState<Level>(initial?.confidence_level ?? "undetermined");
  const [rationale, setRationale] = useState(initial?.confidence_rationale ?? "");
  const [touched, setTouched] = useState(false);
  const statementError = touched && !statement.trim() ? "Escribe el resultado." : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!statement.trim()) return;
    try {
      await onSubmit({
        finding_type: type,
        statement: statement.trim(),
        confidence_level: level,
        confidence_rationale: rationale.trim(),
      });
    } catch {
      // El error se muestra debajo del formulario.
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Tema" value={type} options={CATEGORY_OPTIONS} onChange={setType} />
        <Select label="Qué tan confiable parece" value={level} options={LEVEL_OPTIONS} onChange={setLevel} />
      </div>
      <TextArea
        label="Resultado"
        rows={3}
        maxLength={STATEMENT_MAX_LENGTH}
        showCount
        value={statement}
        error={statementError}
        placeholder="Ej.: los restaurantes de la zona compran verdura dos veces por semana"
        onChange={(event) => setStatement(event.target.value)}
      />
      <TextArea
        label="¿Qué te hace pensar que es cierto? (opcional)"
        rows={2}
        maxLength={RATIONALE_MAX_LENGTH}
        value={rationale}
        onChange={(event) => setRationale(event.target.value)}
      />
      {note && <p className="text-xs text-slate-400">{note}</p>}
      {error != null && <Alert>{errorMessageFrom(error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
