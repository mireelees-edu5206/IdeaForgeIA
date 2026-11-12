/**
 * ARCHIVO: Select.tsx
 *
 * ¿Qué es?
 * Es una lista desplegable: la casilla que, al tocarla, muestra varias opciones para elegir una.
 * Es como la lista de sabores en una heladería: solo puedes escoger uno de los que están escritos.
 *
 * ¿Para qué sirve?
 * - Para elegir una opción de una lista cerrada (por ejemplo, el estado de un proyecto o el tipo de fuente).
 * - Usa el <select> nativo del navegador, así que funciona bien con teclado y lectores de pantalla.
 *
 * ¿Quién lo usa?
 * Los filtros de proyectos, la elección de algoritmo en el laboratorio, el tipo de
 * competidor, etc. Cualquier lugar donde haya que escoger de una lista.
 *
 * Nota técnica: el genérico <T extends string> significa "el valor puede ser cualquier texto,
 * pero TypeScript sabe cuál exactamente". Así, si la lista solo permite "exact" y
 * "nearest_neighbor", el código no deja pasar otra palabra por error.
 */

/* "SelectHTMLAttributes" es la lista de propiedades de un <select> normal. "useId" crea un identificador único. */
import { type SelectHTMLAttributes, useId } from "react";

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";

/**
 * SelectProps describe los datos que recibe la lista:
 * - label: el texto de la etiqueta de arriba (obligatorio).
 * - hideLabel (opcional): si es true, la etiqueta no se ve, pero la leen los lectores de pantalla.
 * - value: la opción que está elegida ahora mismo.
 * - options: la lista de opciones. Cada una tiene un "value" (dato interno) y un "label" (texto que se ve).
 * - onChange: la función que se ejecuta cuando la persona elige otra opción. Recibe el valor elegido.
 * "Omit<..., 'onChange' | 'value'>" quita esos dos de la lista normal porque aquí tienen otra forma.
 */
/** Contrato de datos SelectProps utilizado por interfaz compartida. */
interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/**
 * Select dibuja la etiqueta y la lista desplegable con sus opciones.
 *
 * Cómo se usa (ejemplo):
 * <Select label="Método" value={metodo} options={[{ value: "bfs", label: "Anchura" }]} onChange={setMetodo} />
 */
/** Select nativo accesible (etiqueta asociada, foco visible) con el estilo neomórfico. */
export function Select<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  className,
  // Cualquier otra propiedad (disabled, id...) va directo al <select>.
  ...props
}: SelectProps<T>) {
  // Identificador único para unir la etiqueta con la lista.
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* La etiqueta. "htmlFor" la une con la lista: al tocar el texto, se abre la lista. */}
      <label htmlFor={id} className={cn("text-xs font-medium text-slate-400", hideLabel && "sr-only")}>
        {label}
      </label>
      <select
        id={id}
        // Muestra como elegida la opción que coincide con "value".
        value={value}
        // Cuando cambia la selección, tomamos el valor de la opción elegida y lo mandamos a "onChange".
        // El "as T" le dice a TypeScript: "confía, este texto es una de nuestras opciones".
        onChange={(event) => onChange(event.target.value as T)}
        // Estilo: aspecto hundido, altura de 40 px, ocupa el ancho disponible y no se sale de su espacio.
        // "focus-visible:ring-2" pone un anillo celeste al enfocar con teclado. "disabled:opacity-60" lo atenúa si está bloqueado.
        className="neo-inset h-10 w-full min-w-0 max-w-full rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70 disabled:opacity-60"
        {...props}
      >
        {/* Dibujamos una opción (<option>) por cada elemento de la lista "options". "map" repite el dibujo para cada uno. */}
        {/* "key" es un nombre único de cada opción para que React sepa cuál es cuál al redibujar. */}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
