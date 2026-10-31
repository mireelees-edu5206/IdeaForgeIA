/**
 * ARCHIVO: TextArea.tsx
 *
 * ¿Qué es?
 * Es una casilla grande para escribir varios renglones de texto, como una hoja de cuaderno
 * donde cabe un párrafo completo. Es la versión "larga" del campo de una sola línea (TextField).
 *
 * ¿Para qué sirve?
 * - Para descripciones, justificaciones y textos largos (por ejemplo, la idea del proyecto).
 * - Muestra la etiqueta arriba, un mensaje de ayuda o de error debajo y, si se pide, un contador
 *   tipo "120 / 2000" para saber cuántos caracteres llevas.
 *
 * ¿Quién lo usa?
 * Formularios donde se escriben textos largos: crear o editar hallazgos, competidores, atributos de la idea
 * y el chat del asistente.
 */

/* "TextareaHTMLAttributes" es la lista de propiedades que acepta un <textarea> normal de HTML.
   "useId" crea un identificador único para unir etiqueta, casilla y mensajes. */
import { type TextareaHTMLAttributes, useId } from "react";

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";

/**
 * TextAreaProps describe los datos que recibe el campo largo:
 * - label: la etiqueta de arriba (obligatoria).
 * - hideLabel (opcional): si es true, la etiqueta existe pero no se ve (solo la leen los lectores de pantalla).
 * - error (opcional): mensaje de error en rojo.
 * - hint (opcional): ayuda en gris.
 * - showCount (opcional): si es true, muestra el contador "n / max". Necesita la prop "maxLength".
 * Además acepta todo lo que acepta un <textarea> normal.
 */
/** Contrato de datos TextAreaProps utilizado por interfaz compartida. */
interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: string;
  /** Muestra el contador "n / max" (usa maxLength). */
  showCount?: boolean;
}

/**
 * TextArea dibuja el campo largo con su etiqueta, su contador y sus mensajes.
 *
 * Cómo se usa (ejemplo):
 * <TextArea label="Justificación" maxLength={2000} showCount value={texto} onChange={(e) => setTexto(e.target.value)} />
 */
/** Expone la funcion text area para el flujo de shared frontend. */
export function TextArea({
  label,
  hideLabel = false,
  error,
  hint,
  showCount = false,
  maxLength,
  value,
  className,
  // "rows" es cuántos renglones se ven de entrada. Si no se indica, son 4.
  rows = 4,
  // Todas las demás propiedades (onChange, placeholder...) van directo al <textarea>.
  ...props
}: TextAreaProps) {
  // Identificador único del campo, para unir etiqueta y mensajes.
  const id = useId();
  // Contamos los caracteres solo si el valor es texto. Si no es texto, el conteo es 0.
  const length = typeof value === "string" ? value.length : 0;
  // Armamos la lista de ids de los mensajes que describen el campo (error y/o ayuda), separados por espacio.
  // ".filter(Boolean)" quita los que no existen; si al final no queda ninguno, guardamos "undefined" (no escribimos nada).
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* La etiqueta. Si "hideLabel" es true, la clase "sr-only" la esconde visualmente pero la deja para lectores de pantalla. */}
      <label htmlFor={id} className={cn("text-sm font-medium text-slate-300", hideLabel && "sr-only")}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        // El límite de caracteres. Si la persona llega al máximo, el navegador ya no deja escribir más.
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          // Aspecto "hundido", ancho completo, "resize-y" permite estirarlo hacia abajo, texto con buen interlineado.
          "neo-inset w-full resize-y rounded-xl px-4 py-3 leading-relaxed text-slate-100 placeholder:text-slate-500",
          // Anillo celeste al enfocar con teclado.
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
          // Anillo rojo si hay error.
          error && "ring-2 ring-rose-400/70",
        )}
        {...props}
      />
      {/* Fila inferior: a la izquierda el error o la ayuda, a la derecha el contador. */}
      <div className="flex items-start justify-between gap-3 text-xs">
        <div>
          {/* El error solo aparece si existe (el "&&" no dibuja nada si la condición es falsa). */}
          {error && (
            <p id={`${id}-error`} className="text-sm text-rose-300">
              {error}
            </p>
          )}
          {/* La ayuda solo aparece si existe. */}
          {hint && (
            <p id={`${id}-hint`} className="text-slate-400">
              {hint}
            </p>
          )}
        </div>
        {/* El contador "120 / 2000". Solo se muestra si piden el contador y hay un límite.
            "aria-live=polite" hace que el lector de pantalla lo anuncie de vez en cuando, sin interrumpir. */}
        {showCount && maxLength && (
          <span className="shrink-0 tabular-nums text-slate-400" aria-live="polite">
            {/* "toLocaleString('es')" pone separadores de miles según el idioma español (por ejemplo 2.000). */}
            {length.toLocaleString("es")} / {maxLength.toLocaleString("es")}
          </span>
        )}
      </div>
    </div>
  );
}
