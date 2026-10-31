/**
 * ARCHIVO: TextField.tsx
 *
 * ¿Qué es?
 * Es una casilla para escribir una línea de texto, con su etiqueta arriba. Imagina una hoja de
 * formulario donde hay un renglón con su nombre impreso encima ("Correo", "Contraseña") y un
 * espacio para escribir.
 *
 * ¿Para qué sirve?
 * - Muestra la etiqueta, la casilla y, si hace falta, un mensaje de ayuda (hint) o de error.
 * - Si el campo es una contraseña, agrega un botón para mostrar u ocultar lo que se escribe.
 * - Marca el campo en rojo cuando hay un error, y lo conecta con su mensaje para lectores de pantalla.
 *
 * ¿Quién lo usa?
 * Los formularios de inicio de sesión, registro, crear proyecto, configuración de la cuenta, etc.
 *
 * Nota: todo lo que no se reconoce como prop propia (por ejemplo "value", "onChange", "placeholder")
 * se pasa directo a la casilla <input>. Por eso el componente puede usarse como un input normal.
 */

/* "InputHTMLAttributes" es la lista de propiedades que acepta un <input> normal de HTML.
   "useId" crea un identificador único. "useState" guarda un valor que puede cambiar (aquí: mostrar contraseña o no). */
import { type InputHTMLAttributes, useId, useState } from "react";
/* Dos iconos de ojo: uno abierto (mostrar) y uno tachado (ocultar). */
import { FiEye, FiEyeOff } from "react-icons/fi";

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";

/**
 * TextFieldProps describe los datos que recibe el campo:
 * - label: el texto de la etiqueta de arriba (obligatorio).
 * - error (opcional): un mensaje de error. Si existe, el campo se pone rojo y muestra el mensaje.
 * - hint (opcional): una ayuda gris. Solo se ve si no hay error.
 * "extends InputHTMLAttributes" significa que además acepta todo lo que acepta un <input>.
 */
/** Contrato de datos TextFieldProps utilizado por interfaz compartida. */
interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * TextField dibuja la etiqueta, la casilla y el mensaje (de error o de ayuda).
 *
 * Cómo se usa (ejemplo):
 * <TextField label="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errorCorreo} />
 */
/** Expone la funcion text field para el flujo de shared frontend. */
export function TextField({ label, error, hint, type = "text", className, ...props }: TextFieldProps) {
  // Un identificador único para este campo. Lo usamos para unir la etiqueta con la casilla.
  const id = useId();
  // "revealed" dice si la contraseña está visible (true) u oculta (false). Empieza oculta.
  const [revealed, setRevealed] = useState(false);
  // "isPassword" es true solo si el tipo del campo es "password" (contraseña).
  const isPassword = type === "password";
  // Decidimos qué mensaje "describe" el campo para lectores de pantalla: primero el error, si no la ayuda, y si no hay ninguno, nada.
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    // Contenedor en columna: etiqueta arriba, casilla en medio, mensaje abajo. "className" permite ajustar el espacio desde afuera.
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* La etiqueta. "htmlFor={id}" la une con la casilla: al tocar el texto de la etiqueta, el cursor entra en la casilla. */}
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      {/* "relative" permite poner el botón de ojo encima de la casilla, a la derecha. */}
      <div className="relative">
        <input
          id={id}
          // Si es contraseña y el usuario pidió verla, cambiamos el tipo a "text" para que se lea. Si no, usamos el tipo normal.
          type={isPassword && revealed ? "text" : type}
          // "aria-invalid" avisa a lectores de pantalla que el dato tiene un problema. Si no hay error, no escribimos nada (undefined).
          aria-invalid={error ? true : undefined}
          // Conecta la casilla con su mensaje (error o ayuda) para que el lector lo lea al enfocarla.
          aria-describedby={describedBy}
          className={cn(
            // Estilo base: aspecto "hundido" (neo-inset), altura de 44 px (fácil de tocar), esquinas redondeadas,
            // texto claro y el texto de ayuda dentro de la casilla (placeholder) en gris oscuro.
            "neo-inset h-11 w-full rounded-xl px-4 text-slate-100 placeholder:text-slate-500",
            // Al enfocar con teclado: aparece un anillo celeste para saber dónde estás.
            "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
            // Si hay error: anillo rojo alrededor. Si no hay error, esta parte se ignora (false).
            error && "ring-2 ring-rose-400/70",
          )}
          // Todas las demás propiedades que llegaron (value, onChange, autoComplete...) van directo a la casilla.
          {...props}
        />
        {/* El botón de mostrar/ocultar contraseña: solo existe si el campo es de contraseña. */}
        {isPassword && (
          <button
            // "button" evita que este botón envíe el formulario sin querer.
            type="button"
            // Al pulsarlo, invertimos "revealed": si estaba oculta se muestra, y si estaba visible se oculta.
            onClick={() => setRevealed((value) => !value)}
            // El nombre que escuchan los lectores de pantalla cambia según el estado actual.
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="jelly mt-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            {/* El icono: ojo tachado si la contraseña está visible (para ocultarla), ojo abierto si está oculta. */}
            {revealed ? <FiEyeOff aria-hidden="true" className="size-4" /> : <FiEye aria-hidden="true" className="size-4" />}
            {/* El texto visible del botón, igual que el nombre para lectores de pantalla. */}
            <span>{revealed ? "Ocultar contraseña" : "Mostrar contraseña"}</span>
          </button>
        )}
      </div>
      {/* Mensaje debajo del campo. Si hay error, se muestra en rojo; si no, se muestra la ayuda en gris (si existe). */}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-300">
          {error}
        </p>
      ) : (
        // "hint && (...)": si hay ayuda, la dibujamos; si no hay, React no dibuja nada.
        hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
