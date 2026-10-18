import { type FormEvent, useState } from "react";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { TextField } from "../../../components/ui/TextField";
import { errorMessageFrom } from "../../../lib/formErrors";
import { safeHref } from "../../research/constants";
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, LEVEL_LABELS, LEVEL_VALUES, RATIONALE_MAX_LENGTH } from "../constants";
import { useCreateCompetitor } from "../queries";
import type { CompetitorType, Level } from "../types";

const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));
const THREAT_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

export function CompetitorForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const create = useCreateCompetitor(projectId);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState<CompetitorType>("direct");
  const [threat, setThreat] = useState<Level>("undetermined");
  const [rationale, setRationale] = useState("");
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? "Escribe el nombre del competidor." : undefined;
  const websiteError =
    touched && website.trim() && !safeHref(website.trim()) ? "Usa una URL completa, p. ej. https://ejemplo.com" : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || (website.trim() && !safeHref(website.trim()))) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        website: website.trim() || undefined,
        competitor_type: type,
        threat_level: threat,
        rationale: rationale.trim() || undefined,
      });
      onDone();
    } catch {
      // Se muestra create.error.
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Nombre" value={name} maxLength={200} error={nameError} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Sitio web (opcional)"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={website}
          error={websiteError}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Select label="Tipo de competidor" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <Select label="Nivel de amenaza" value={threat} options={THREAT_OPTIONS} onChange={setThreat} />
      </div>
      <TextArea
        label="¿Por qué compite con tu idea? (opcional)"
        rows={2}
        maxLength={RATIONALE_MAX_LENGTH}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />
      {create.isError && <Alert>{errorMessageFrom(create.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={create.isPending}>
          Añadir competidor
        </Button>
      </div>
    </form>
  );
}
