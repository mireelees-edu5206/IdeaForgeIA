/**
 * ARCHIVO: frontend/src/features/projects/components/IdeaSection.tsx
 *
 * ¿Qué es?
 * La tarjeta "Tu idea": muestra el texto completo de la idea y permite editarlo.
 *
 * ¿Qué se ve en pantalla?
 * - Estado normal: el título "Tu idea", una etiqueta de origen ("Tú") y el texto de la idea con su
 *   botón "Editar".
 * - Estado editando: el mismo título, un cuadro de texto con contador de caracteres, botones "Cancelar"
 *   y "Guardar". Si la idea ya estaba estructurada, aparece una nota de que se volverá a revisar.
 *
 * ¿Qué pasa al guardar?
 * 1. Revisa que la idea tenga al menos RAW_IDEA_MIN_LENGTH caracteres (sin contar espacios sobrantes).
 * 2. Envía el cambio al backend con useUpdateProject.
 * 3. Si sale bien, cierra la edición. Si falla, muestra el mensaje del campo "raw_idea" o una alerta general.
 *
 * Datos que maneja:
 * - draft: el texto que la persona está escribiendo (no se guarda hasta pulsar Guardar).
 * - error: el mensaje de validación que se muestra debajo del cuadro de texto.
 *
 * ¿Quién lo usa?
 * ProjectIdeaTab.tsx.
 */
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

/**
 * Tarjeta de la idea del proyecto.
 *
 * Props:
 * - project: el proyecto completo. Su texto (raw_idea) es lo que se muestra y se edita.
 */
export function IdeaSection({ project }: { project: ProjectDetail }) {
  // Hook de React Query para guardar cambios en el proyecto. Al terminar, refresca los datos.
  const updateProject = useUpdateProject(project.id);
  // true cuando la persona está editando el texto.
  const [editing, setEditing] = useState(false);
  // Copia del texto que se está escribiendo. Empieza con la idea actual.
  const [draft, setDraft] = useState(project.raw_idea);
  // Mensaje de error de validación para mostrar debajo del cuadro de texto.
  const [error, setError] = useState<string | undefined>();

  /**
   * Se ejecuta al enviar el formulario (botón Guardar o Enter dentro del formulario).
   *
   * Primero valida en el navegador; si pasa, envía al servidor.
   */
  async function save(event: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página, que es el comportamiento por defecto de un formulario.
    event.preventDefault();
    // "trim" quita espacios al inicio y al final antes de contar. Así "   hola   " no cuenta como texto válido.
    if (draft.trim().length < RAW_IDEA_MIN_LENGTH) {
      setError(`Escribe una frase breve sobre tu idea (al menos ${RAW_IDEA_MIN_LENGTH} caracteres).`);
      return;
    }
    try {
      // Envía solo el campo raw_idea, sin espacios sobrantes. Si funciona, la caché del proyecto se actualiza.
      await updateProject.mutateAsync({ raw_idea: draft.trim() });
      setError(undefined);
      setEditing(false);
    } catch (err) {
      // Si el servidor marcó el campo raw_idea como inválido, se muestra debajo del cuadro.
      setError(fieldErrorsFrom(err).raw_idea);
    }
  }

  return (
    // "role=region" y "aria-labelledby" hacen que un lector de pantalla anuncie esta tarjeta con su título.
    <GlassPanel className="flex flex-col gap-4 p-5" role="region" aria-labelledby="tu-idea">
      {/* Encabezado: título y etiqueta de origen a la izquierda, botón Editar a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="tu-idea" className="font-semibold">
            Tu idea
          </h2>
          {/* La etiqueta "Tú" indica que el texto lo escribió la persona y ya está confirmado. */}
          <OriginBadge origin="user" confirmed />
        </div>
        {/* El botón Editar solo aparece cuando NO se está editando. */}
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            icon={<FiEdit2 aria-hidden="true" />}
            onClick={() => {
              // Al empezar a editar, el borrador vuelve a ser la idea guardada (descarta cambios anteriores sin guardar).
              setDraft(project.raw_idea);
              setEditing(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>

      {/* Si se está editando, muestra el formulario; si no, muestra el texto guardado. */}
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <TextArea
            label="Descripción de la idea"
            // "hideLabel" oculta la etiqueta visualmente, pero sigue disponible para lectores de pantalla.
            hideLabel
            rows={7}
            maxLength={RAW_IDEA_MAX_LENGTH}
            showCount
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={error}
            // Si el proyecto ya no está en borrador, avisa que se volverá a revisar la estructura al guardar.
            hint={
              project.status !== "draft"
                ? "Al guardar, revisaremos los datos básicos otra vez antes de buscar información."
                : undefined
            }
            // El cursor aparece dentro del cuadro en cuanto se abre la edición.
            autoFocus
          />
          {/* Alerta general solo si falló el guardado y el error no es de un campo concreto. */}
          {updateProject.isError && !error && <Alert>{errorMessageFrom(updateProject.error)}</Alert>}
          <div className="flex justify-end gap-2">
            {/* Cancelar descarta el borrador, quita el error y limpia el estado de la mutación. */}
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
            {/* "loading" muestra un indicador de carga mientras se guarda, y bloquea el botón. */}
            <Button type="submit" size="sm" loading={updateProject.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        // "whitespace-pre-wrap" respeta los saltos de línea que escribió la persona.
        <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">{project.raw_idea}</p>
      )}
    </GlassPanel>
  );
}
