import { type FormEvent, useState } from "react";
import { FiCheck, FiEdit2, FiPlus, FiRotateCcw, FiTrash2, FiX } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { TextArea } from "../../../components/ui/TextArea";
import { errorMessageFrom } from "../../../lib/formErrors";
import { ATTRIBUTE_META, ATTRIBUTE_VALUE_MAX_LENGTH, MAX_VALUES_PER_ATTRIBUTE } from "../constants";
import { useAddAttribute, useDeleteAttribute, useUpdateAttribute } from "../queries";
import type { AttributeType, IdeaAttribute } from "../types";
import { OriginBadge } from "./badges";

interface AttributeSectionProps {
  projectId: string;
  type: AttributeType;
  values: IdeaAttribute[];
  required: boolean;
}

function AttributeRow({ projectId, attribute, label }: { projectId: string; attribute: IdeaAttribute; label: string }) {
  const updateAttribute = useUpdateAttribute(projectId);
  const deleteAttribute = useDeleteAttribute(projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(attribute.value);
  const error = updateAttribute.error ?? deleteAttribute.error;
  const busy = updateAttribute.isPending || deleteAttribute.isPending;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      await updateAttribute.mutateAsync({ attributeId: attribute.id, value: draft.trim() });
      setEditing(false);
    } catch {
      // El error queda en updateAttribute.error y se muestra en el formulario.
    }
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="flex flex-col gap-2">
          <TextArea
            label={`Editar ${label.toLowerCase()}`}
            hideLabel
            rows={2}
            maxLength={ATTRIBUTE_VALUE_MAX_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          {updateAttribute.isError && <Alert>{errorMessageFrom(updateAttribute.error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(attribute.value);
                setEditing(false);
                updateAttribute.reset();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={updateAttribute.isPending} disabled={!draft.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  const pendingSuggestion = attribute.origin === "ai" && !attribute.is_confirmed;
  return (
    <li className="neo-inset flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{attribute.value}</p>
        <div className="mt-2">
          <OriginBadge origin={attribute.origin} confirmed={attribute.is_confirmed} />
        </div>
        {error && !editing && (
          <div className="mt-2">
            <Alert>{errorMessageFrom(error)}</Alert>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        {attribute.origin === "ai" && (
          <Button
            variant={pendingSuggestion ? "secondary" : "ghost"}
            size="sm"
            disabled={busy}
            onClick={() => updateAttribute.mutate({ attributeId: attribute.id, is_confirmed: pendingSuggestion })}
            icon={pendingSuggestion ? <FiCheck aria-hidden="true" /> : <FiRotateCcw aria-hidden="true" />}
          >
            {pendingSuggestion ? "Confirmar" : "Desconfirmar"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Editar valor de ${label.toLowerCase()}`}
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          <FiEdit2 aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Eliminar valor de ${label.toLowerCase()}`}
          disabled={busy}
          onClick={() => deleteAttribute.mutate(attribute.id)}
          className="hover:text-rose-300"
        >
          <FiTrash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function AttributeSection({ projectId, type, values, required }: AttributeSectionProps) {
  const { label, question, placeholder } = ATTRIBUTE_META[type];
  const addAttribute = useAddAttribute(projectId);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const canAdd = values.length < MAX_VALUES_PER_ATTRIBUTE;
  const headingId = `atributo-${type}`;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    try {
      await addAttribute.mutateAsync({ attribute_type: type, value: value.trim() });
      setValue("");
      setAdding(false);
    } catch {
      // El error queda en addAttribute.error y se muestra en el formulario.
    }
  }

  const hasConfirmed = values.some((item) => item.is_confirmed);

  return (
    <GlassPanel
      className={
        required && hasConfirmed
          ? "stage-3d flex flex-col gap-4 rounded-3xl p-5 ring-1 ring-accent-cyan/35"
          : required
            ? "fog-uncertain flex flex-col gap-4 rounded-3xl p-5"
            : "flex flex-col gap-4 rounded-2xl p-5"
      }
      aria-labelledby={headingId}
      role="region"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={headingId} className="font-semibold">
            {label}
          </h3>
          <p className="text-sm text-slate-400">{question}</p>
        </div>
        {required && (
          <Badge
            className={
              hasConfirmed
                ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/35"
                : "bg-accent-cyan/10 text-accent-cyan ring-accent-cyan/30"
            }
          >
            {hasConfirmed ? "Completo" : "Pendiente"}
          </Badge>
        )}
      </div>

      {values.length > 0 && (
        <ul className="flex flex-col gap-2">
          {values.map((attribute) => (
            <AttributeRow key={attribute.id} projectId={projectId} attribute={attribute} label={label} />
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={add} className="flex flex-col gap-2">
          <TextArea
            label={`Nuevo valor para ${label.toLowerCase()}`}
            hideLabel
            rows={2}
            maxLength={ATTRIBUTE_VALUE_MAX_LENGTH}
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          {addAttribute.isError && <Alert>{errorMessageFrom(addAttribute.error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<FiX aria-hidden="true" />}
              onClick={() => {
                setAdding(false);
                setValue("");
                addAttribute.reset();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={addAttribute.isPending} disabled={!value.trim()}>
              Añadir
            </Button>
          </div>
        </form>
      ) : canAdd ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<FiPlus aria-hidden="true" />}
          onClick={() => setAdding(true)}
        >
          {values.length === 0 ? `Añadir ${label.toLowerCase()}` : "Añadir otro valor"}
        </Button>
      ) : (
        <p className="text-xs text-slate-400">Has alcanzado el máximo de {MAX_VALUES_PER_ATTRIBUTE} valores.</p>
      )}
    </GlassPanel>
  );
}
