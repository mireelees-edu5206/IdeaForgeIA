/**
 * ARCHIVO: findings/components/CompetitorForm.tsx
 *
 * ¿Qué es?
 * Es el formulario para añadir una alternativa o competidor que la persona conoce: nombre, sitio
 * web (opcional), qué tan parecida es, qué tan fuerte parece y una justificación (opcional).
 *
 * ¿Para qué sirve?
 * Permite agregar una opción del mercado sin esperar a que la IA la encuentre.
 *
 * ¿Quién lo usa?
 * CompetitorsTab.tsx, dentro de la tarjeta "Añade una opción que conozcas".
 *
 * Reglas que revisa antes de enviar:
 * - El nombre es obligatorio.
 * - Si escribe un sitio web, debe ser una dirección completa (empezar con https:// o http://).
 *   Si no, se muestra un aviso: "Usa una URL completa, p. ej. https://ejemplo.com".
 */

/* "FormEvent" es el tipo del evento de enviar. "useState" guarda lo que escribe la persona. */
import { type FormEvent, useState } from "react";

/* Piezas visuales compartidas: aviso, botón, menús y campos. */
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { TextArea } from "../../../components/ui/TextArea";
import { TextField } from "../../../components/ui/TextField";
/* Convierte errores a texto. */
import { errorMessageFrom } from "../../../lib/formErrors";
/* Valida enlaces seguros (de la carpeta de investigación). */
import { safeHref } from "../../research/constants";
/* Textos de tipo, niveles y límite de la justificación. */
import { COMPETITOR_TYPE_META, COMPETITOR_TYPES, LEVEL_LABELS, LEVEL_VALUES, RATIONALE_MAX_LENGTH } from "../constants";
/* La acción que crea el competidor, desde la caché. */
import { useCreateCompetitor } from "../queries";
/* Tipos de tipo de competidor y de nivel. */
import type { CompetitorType, Level } from "../types";

/** TYPE_OPTIONS: los cuatro tipos de competidor para el menú "Qué tan parecida es". */
/** Catalogo TYPE_OPTIONS que define etiquetas o reglas de resultados. */
const TYPE_OPTIONS = COMPETITOR_TYPES.map((value) => ({ value, label: COMPETITOR_TYPE_META[value].label }));
/** THREAT_OPTIONS: los niveles de amenaza para el menú "Qué tan fuerte parece". */
/** Define THREAT_OPTIONS para el bloque de resultados. */
const THREAT_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));

/**
 * CompetitorForm dibuja el formulario para añadir un competidor.
 *
 * Recibe:
 * - projectId: el proyecto al que se agrega.
 * - onDone: función que se ejecuta al terminar (o al cancelar) para cerrar el formulario.
 */
/** Expone la funcion competitor form para el flujo de findings. */
export function CompetitorForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  // La acción de crear el competidor.
  const create = useCreateCompetitor(projectId);
  // Cada campo del formulario guarda lo que escribe la persona. Empiezan vacíos o con valores por defecto.
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState<CompetitorType>("direct");
  const [threat, setThreat] = useState<Level>("undetermined");
  const [rationale, setRationale] = useState("");
  // "touched": si la persona ya intentó enviar. Los errores de validación solo aparecen después de eso.
  const [touched, setTouched] = useState(false);

  // Error del nombre: solo si intentó enviar y el nombre está vacío.
  const nameError = touched && !name.trim() ? "Escribe el nombre de la opción." : undefined;
  // Error del sitio web: solo si intentó enviar, escribió algo y no es una dirección segura completa.
  const websiteError =
    touched && website.trim() && !safeHref(website.trim()) ? "Usa una URL completa, p. ej. https://ejemplo.com" : undefined;

  /**
   * submit se ejecuta al enviar. Revisa nombre y sitio web, y si todo está bien, crea el competidor.
   */
  /** Gestiona submit de resultados. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue.
    event.preventDefault();
    // Marcamos que ya intentó enviar, para que aparezcan los errores.
    setTouched(true);
    // Si falta el nombre, o el sitio web no es válido, no enviamos.
    /** Rama condicional: !name.trim() || (website.trim() && !safeHref(website.tr. */
    if (!name.trim() || (website.trim() && !safeHref(website.trim()))) return;
    // Intentamos crear. Si sale bien, avisamos a quien usa el formulario para que lo cierre.
    /** Maneja fallos de la operacion del bloque resultados. */
    try {
      await create.mutateAsync({
        name: name.trim(),
        // Si el sitio web está vacío, mandamos "undefined" (no se envía el campo).
        website: website.trim() || undefined,
        competitor_type: type,
        threat_level: threat,
        rationale: rationale.trim() || undefined,
      });
      onDone();
    } catch {
      // Si falla, el error se muestra con create.error más abajo.
    }
  }

  return (
    // "noValidate" desactiva las revisiones del navegador: usamos las nuestras, en español.
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* Nombre y sitio web, lado a lado en pantallas medianas. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Nombre" value={name} maxLength={200} error={nameError} onChange={(e) => setName(e.target.value)} />
        {/* type="url" y inputMode="url" ayudan al teclado del celular a mostrar la @ y el punto. */}
        <TextField
          label="Sitio web (opcional)"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={website}
          error={websiteError}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Select label="Qué tan parecida es" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <Select label="Qué tan fuerte parece" value={threat} options={THREAT_OPTIONS} onChange={setThreat} />
      </div>
      {/* La justificación, opcional. */}
      <TextArea
        label="¿Por qué podría ser una opción para tus clientes? (opcional)"
        rows={2}
        maxLength={RATIONALE_MAX_LENGTH}
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />
      {/* El error del servidor, si lo hubo. */}
      {create.isError && <Alert>{errorMessageFrom(create.error)}</Alert>}
      {/* Cancelar cierra sin guardar. Añadir envía y muestra la carga mientras guarda. */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={create.isPending}>
          Añadir opción
        </Button>
      </div>
    </form>
  );
}
