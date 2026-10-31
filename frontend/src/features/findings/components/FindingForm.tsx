/**
 * ARCHIVO: findings/components/FindingForm.tsx
 *
 * ¿Qué es?
 * Es el formulario para escribir un resultado: tema, texto del resultado, nivel de confianza y,
 * opcionalmente, por qué parece confiable. Se usa tanto para crear un resultado nuevo como para
 * editar uno existente.
 *
 * ¿Para qué sirve?
 * Permite que la persona agregue información que ya conoce, con los mismos campos que tiene un
 * resultado de la IA. Así sus datos quedan igual de ordenados.
 *
 * ¿Quién lo usa?
 * FindingsTab.tsx (crear) y FindingCard.tsx (editar).
 *
 * Qué pasa al enviar: si el texto del resultado está vacío, se muestra "Escribe el resultado." debajo
 * de la casilla y no se envía nada. Si los datos están bien, se llama a onSubmit.
 */

/* "FormEvent" es el tipo del evento al enviar. "useState" guarda lo que escribe la persona. */
import { type FormEvent, useState } from "react";

/* Piezas visuales compartidas. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
/* Convierte un error en texto mostrable. */
import { errorMessageFrom } from "../../../lib/formErrors";
/* Nombres en español de las categorías y su tipo. */
import { CATEGORY_LABELS } from "../../research/constants";
import type { ResearchCategory } from "../../research/types";
/* Textos de niveles y límites de longitud, y los tipos de entrada. */
import { LEVEL_LABELS, LEVEL_VALUES, RATIONALE_MAX_LENGTH, STATEMENT_MAX_LENGTH } from "../constants";
import type { FindingInput, Level } from "../types";

/**
 * CATEGORY_OPTIONS arma la lista de temas para el menú: cada categoría con su nombre en español.
 * Se calcula una sola vez al cargar el archivo, porque no cambia.
 */
/** Define CATEGORY_OPTIONS para el bloque de resultados. */
const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as ResearchCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));
/** LEVEL_OPTIONS arma la lista de niveles de confianza (alta, media, baja, indeterminada) para el menú. */
/** Define LEVEL_OPTIONS para el bloque de resultados. */
const LEVEL_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

/**
 * FindingFormProps describe lo que recibe el formulario:
 * - initial (opcional): los valores de partida (para editar). Si no viene, el formulario empieza vacío.
 * - submitLabel: el texto del botón de guardar ("Guardar resultado" o "Guardar").
 * - pending: true mientras se guarda (muestra la carga en el botón).
 * - error: el error del último intento de guardar, o null.
 * - note (opcional): un texto explicativo debajo de los campos.
 * - onSubmit: función que recibe los datos listos para guardar.
 * - onCancel: función para cerrar el formulario sin guardar.
 */
/** Contrato de datos FindingFormProps utilizado por resultados. */
interface FindingFormProps {
  initial?: FindingInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  note?: string;
  onSubmit: (data: FindingInput) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * FindingForm dibuja el formulario y maneja su envío.
 */
/** Expone la funcion finding form para el flujo de findings. */
export function FindingForm({ initial, submitLabel, pending, error, note, onSubmit, onCancel }: FindingFormProps) {
  // Cada campo tiene su propia memoria. Si hay valores iniciales (edición), los usamos; si no, valores por defecto.
  // "??" toma el valor por defecto solo si el inicial no existe.
  const [type, setType] = useState<ResearchCategory>(initial?.finding_type ?? "market");
  const [statement, setStatement] = useState(initial?.statement ?? "");
  const [level, setLevel] = useState<Level>(initial?.confidence_level ?? "undetermined");
  const [rationale, setRationale] = useState(initial?.confidence_rationale ?? "");
  // "touched" dice si la persona ya intentó enviar. Así el error de "vacío" no aparece antes de tiempo.
  const [touched, setTouched] = useState(false);
  // El mensaje de error del texto: solo aparece después de intentar enviar, y si el texto está vacío.
  const statementError = touched && !statement.trim() ? "Escribe el resultado." : undefined;

  /**
   * submit se ejecuta al enviar el formulario. Revisa que el texto no esté vacío y luego
   * manda los datos, quitando espacios sobrantes.
   */
  /** Gestiona submit de resultados. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    // Marcamos que ya intentó enviar, para que aparezca el error si hace falta.
    setTouched(true);
    // Si el texto está vacío (o solo tiene espacios), no enviamos.
    /** Rama condicional: !statement.trim(). */
    if (!statement.trim()) return;
    // Intentamos guardar. Si el guardado falla, el error lo muestra el propio formulario (vía "error").
    /** Maneja fallos de la operacion del bloque resultados. */
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
    // "noValidate" desactiva las revisiones automáticas del navegador: las hacemos nosotros, en español.
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* Tema y nivel de confianza, lado a lado en pantallas medianas. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Tema" value={type} options={CATEGORY_OPTIONS} onChange={setType} />
        <Select label="Qué tan confiable parece" value={level} options={LEVEL_OPTIONS} onChange={setLevel} />
      </div>
      {/* El texto del resultado. Tiene contador "n / 2000" y un ejemplo en la casilla. */}
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
      {/* La justificación. Es opcional, por eso no tiene error de vacío. */}
      <TextArea
        label="¿Qué te hace pensar que es cierto? (opcional)"
        rows={2}
        maxLength={RATIONALE_MAX_LENGTH}
        value={rationale}
        onChange={(event) => setRationale(event.target.value)}
      />
      {/* El texto explicativo que llega desde quien usa el formulario (por ejemplo, el origen de los datos). */}
      {note && <p className="text-xs text-slate-400">{note}</p>}
      {/* El error del servidor, si lo hubo. "!= null" es verdadero si el error existe (no es null ni undefined). */}
      {error != null && <Alert>{errorMessageFrom(error)}</Alert>}
      {/* Los botones: cancelar (sin guardar) y guardar (con carga mientras envía). */}
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
