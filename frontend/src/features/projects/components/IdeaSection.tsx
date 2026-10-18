import { type FormEvent, useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { TextArea } from "../../../components/ui/TextArea";
import { errorMessageFrom, fieldErrorsFrom } from "../../../lib/formErrors";
import { RAW_IDEA_MAX_LENGTH, RAW_IDEA_MIN_LENGTH } from "../constants";
import { useUpdateProject } from "../queries";
import type { ProjectDetail } from "../types";
import { OriginBadge } from "./badges";

export function IdeaSection({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.raw_idea);
  const [error, setError] = useState<string | undefined>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim().length < RAW_IDEA_MIN_LENGTH) {
      setError(`Describe tu idea con al menos ${RAW_IDEA_MIN_LENGTH} caracteres.`);
      return;
    }
    try {
      await updateProject.mutateAsync({ raw_idea: draft.trim() });
      setError(undefined);
      setEditing(false);
    } catch (err) {
      setError(fieldErrorsFrom(err).raw_idea);
    }
  }

  return (
    <GlassPanel className="flex flex-col gap-4 p-5" role="region" aria-labelledby="tu-idea">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="tu-idea" className="font-semibold">
            Tu idea
          </h2>
          <OriginBadge origin="user" confirmed />
        </div>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            icon={<FiEdit2 aria-hidden="true" />}
            onClick={() => {
              setDraft(project.raw_idea);
              setEditing(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <TextArea
            label="Descripción de la idea"
            hideLabel
            rows={7}
            maxLength={RAW_IDEA_MAX_LENGTH}
            showCount
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={error}
            hint={project.status !== "draft" ? "Al guardar, el proyecto volverá a Borrador." : undefined}
            autoFocus
          />
          {updateProject.isError && !error && <Alert>{errorMessageFrom(updateProject.error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setError(undefined);
                updateProject.reset();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={updateProject.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">{project.raw_idea}</p>
      )}
    </GlassPanel>
  );
}
