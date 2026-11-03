/**
 * ARCHIVO: frontend/src/features/projects/components/AttributeSection.tsx
 *
 * ¿Qué es?
 * La tarjeta de una parte de la idea (por ejemplo "Problema", "Solución" o "Segmento de clientes").
 * Cada tarjeta muestra los valores que la persona o la IA escribieron para esa parte y permite gestionarlos.
 *
 * ¿Qué se ve en pantalla?
 * - Título de la parte, una pregunta guía debajo y, si es obligatoria, una etiqueta "Completo" o "Pendiente".
 * - La lista de valores. Cada valor tiene:
 *   - su texto y una etiqueta de origen (Tú o IA, confirmado o pendiente);
 *   - si lo propuso la IA y todavía no está confirmado, un botón "Confirmar";
 *     si ya está confirmado, un botón "Desconfirmar" (para deshacer);
 *   - un botón de lápiz para editar el texto y otro de papelera para borrarlo.
 * - Un botón "Añadir" para agregar otro valor, hasta un máximo de MAX_VALUES_PER_ATTRIBUTE.
 *
 * Estilo de la tarjeta según su estado:
 * - Obligatoria y completa: brilla con un anillo cian.
 * - Obligatoria y pendiente: borde con niebla (fog-uncertain), para indicar que falta algo.
 * - Opcional: tarjeta normal y más discreta.
 *
 * Componentes dentro del archivo:
 * - AttributeSection (exportado): la tarjeta completa.
 * - AttributeRow (interno): una fila de la lista, con su modo normal y su modo de edición.
 *
 * ¿Quién lo usa?
 * ProjectIdeaTab.tsx, una tarjeta por cada tipo de atributo.
 */
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

/**
 * Datos que recibe AttributeSection desde ProjectIdeaTab.
 *
 * - projectId: el proyecto al que pertenecen los valores (necesario para llamar a la API).
 * - type: qué parte de la idea es (problema, solución, etc.).
 * - values: los valores que ya existen para esa parte.
 * - required: true si la parte es obligatoria para investigar.
 */
interface AttributeSectionProps {
  projectId: string;
  type: AttributeType;
  values: IdeaAttribute[];
  required: boolean;
}

/**
 * Una fila de la lista: un valor existente de la parte de la idea.
 *
 * Tiene dos modos:
 * - Normal: muestra el texto, la etiqueta de origen y los botones de acción.
 * - Edición: cambia la fila por un cuadro de texto con "Cancelar" y "Guardar".
 *
 * Props:
 * - projectId: proyecto al que pertenece el valor.
 * - attribute: el valor que se muestra.
 * - label: el nombre de la parte (por ejemplo "Problema"), usado en las etiquetas de los botones para lectores de pantalla.
 */
function AttributeRow({ projectId, attribute, label }: { projectId: string; attribute: IdeaAttribute; label: string }) {
  // Hooks de React Query para cambiar y borrar el valor.
  const updateAttribute = useUpdateAttribute(projectId);
  const deleteAttribute = useDeleteAttribute(projectId);
  // true cuando la fila está en modo edición.
  const [editing, setEditing] = useState(false);
  // Copia del texto que se está editando. Empieza con el valor actual.
  const [draft, setDraft] = useState(attribute.value);
  // Muestra el error de la última acción (editar o borrar), si hubo uno.
  const error = updateAttribute.error ?? deleteAttribute.error;
  // Mientras se guarda o se borra algo, se desactivan los botones de la fila para evitar dobles acciones.
  const busy = updateAttribute.isPending || deleteAttribute.isPending;

  /**
   * Guarda el texto editado. Si está vacío, no hace nada.
   * Si la API responde bien, sale del modo edición. Si falla, el error queda en updateAttribute.error.
   */
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

  // Modo edición: el texto se reemplaza por un cuadro editable.
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
            {/* Cancelar descarta el cambio: vuelve al texto original y limpia el error. */}
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
            {/* Guardar se desactiva si el texto está vacío. */}
            <Button type="submit" size="sm" loading={updateAttribute.isPending} disabled={!draft.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  // Un valor propuesto por la IA que todavía nadie ha confirmado. Cambia el botón de confirmación.
  const pendingSuggestion = attribute.origin === "ai" && !attribute.is_confirmed;
  // Modo normal: texto, etiqueta de origen y botones.
  return (
    <li className="neo-inset flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        {/* "whitespace-pre-wrap" respeta los saltos de línea que escribió la persona. */}
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
        {/* Solo los valores de la IA tienen botón de confirmar o desconfirmar. */}
        {attribute.origin === "ai" && (
          <Button
            // Si está pendiente, el botón es destacado ("secondary"); si ya está confirmado, es discreto ("ghost").
            variant={pendingSuggestion ? "secondary" : "ghost"}
            size="sm"
            disabled={busy}
            // Si está pendiente, se confirma (is_confirmed: true). Si ya estaba confirmado, se desconfirma (false).
            onClick={() => updateAttribute.mutate({ attributeId: attribute.id, is_confirmed: pendingSuggestion })}
            icon={pendingSuggestion ? <FiCheck aria-hidden="true" /> : <FiRotateCcw aria-hidden="true" />}
          >
            {pendingSuggestion ? "Confirmar" : "Desconfirmar"}
          </Button>
        )}
        {/* Botón de editar: solo icono, por eso lleva aria-label para explicar su función. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Editar valor de ${label.toLowerCase()}`}
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          <FiEdit2 aria-hidden="true" />
        </Button>
        {/* Botón de borrar: se pone rojizo al pasar el mouse para advertir que es destructivo. */}
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

/**
 * La tarjeta completa de una parte de la idea.
 *
 * Maneja el formulario para agregar un valor nuevo y decide el estilo de la tarjeta según si es obligatoria
 * y si ya tiene al menos un valor confirmado.
 */
export function AttributeSection({ projectId, type, values, required }: AttributeSectionProps) {
  // Textos de la parte (nombre, pregunta guía y ejemplo) tomados de ATTRIBUTE_META.
  const { label, question, placeholder } = ATTRIBUTE_META[type];
  const addAttribute = useAddAttribute(projectId);
  // true cuando el formulario de "agregar" está abierto.
  const [adding, setAdding] = useState(false);
  // Texto del valor nuevo que se está escribiendo.
  const [value, setValue] = useState("");
  // Todavía se puede agregar si no se llegó al máximo de valores.
  const canAdd = values.length < MAX_VALUES_PER_ATTRIBUTE;
  // Id único para enlazar el título con la tarjeta (aria-labelledby).
  const headingId = `atributo-${type}`;

  /**
   * Agrega el valor nuevo. Si tiene texto, lo envía; al terminar, cierra el formulario y limpia el campo.
   */
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

  // ¿Ya hay al menos un valor confirmado? Decide si la tarjeta se ve "completa" o "pendiente".
  const hasConfirmed = values.some((item) => item.is_confirmed);

  return (
    <GlassPanel
      // Tres estilos posibles: completa (brillante), pendiente obligatoria (niebla) u opcional (normal).
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
        {/* Solo las partes obligatorias muestran la etiqueta de estado. */}
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

      {/* La lista de valores solo aparece si hay al menos uno. */}
      {values.length > 0 && (
        <ul className="flex flex-col gap-2">
          {values.map((attribute) => (
            <AttributeRow key={attribute.id} projectId={projectId} attribute={attribute} label={label} />
          ))}
        </ul>
      )}

      {/* Lo que se muestra debajo: el formulario para agregar, el botón "Añadir" o el aviso de límite alcanzado. */}
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
          // Si la parte está vacía, el texto invita a agregar el primero; si no, "Añadir otro valor".
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
