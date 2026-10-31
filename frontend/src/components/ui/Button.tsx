/**
 * ARCHIVO: Button.tsx
 *
 * ¿Qué es?
 * Es el "botón estándar" de IdeaForge. Imagina una caja de piezas de Lego: en vez de
 * construir un botón nuevo cada vez, usamos siempre esta misma pieza y solo le cambiamos
 * el color, el tamaño o si está ocupada (cargando).
 *
 * ¿Para qué sirve?
 * Para que todos los botones de la aplicación se vean y funcionen igual:
 * - Cambia de color según su "variante": principal, secundario, fantasma o de peligro.
 * - Cambia de tamaño según su "talla": pequeño, mediano, grande o solo icono.
 * - Muestra una ruedita de carga mientras la acción todavía no termina.
 *
 * ¿Quién lo usa?
 * Casi todas las pantallas (formularios, listas, paneles) lo importan desde
 * "components/ui/Button" para mostrar sus botones.
 *
 * ¿Qué hace al cargarse el archivo?
 * Activa el efecto de "ondas líquidas" al hacer clic (ver lib/liquidGlass.ts).
 */

/* Importamos (traemos) del archivo propio "../../lib/cn" una ayuda que junta nombres de estilo. */
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* "cn" une varios textos de estilo en uno solo. Ejemplo: cn("a", "b", undefined) → "a b". */
import { cn } from "../../lib/cn";
/* Traemos la función que activa el efecto de ondas al tocar botones. */
import { initLiquidGlass } from "../../lib/liquidGlass";
/* Traemos la ruedita de carga que se muestra cuando el botón está "ocupado". */
import { Spinner } from "./Spinner";

/*
 * Llamamos a la función de ondas una sola vez, al cargar este archivo.
 * Es como encender la luz del salón antes de que entren los alumnos.
 * Si se llama otra vez, no pasa nada: la función revisa si ya estaba encendida.
 */
initLiquidGlass();

/**
 * ButtonVariant es una lista cerrada de cuatro "estilos de botón".
 * Solo se permiten estas palabras: "primary", "secondary", "ghost" o "danger".
 * Piensa en ella como un menú de helados con cuatro sabores; no puedes pedir un sabor que no esté.
 */
/** Describe el contrato button variant utilizado por shared frontend. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * ButtonSize es una lista cerrada de cuatro "tamaños": "sm" (pequeño), "md" (mediano),
 * "lg" (grande) e "icon" (cuadrado, solo para un icono).
 */
/** Describe el contrato button size utilizado por shared frontend. */
export type ButtonSize = "sm" | "md" | "lg" | "icon";

/**
 * buttonVariants es un "diccionario": una tabla donde cada nombre (primary, secondary...)
 * tiene asociada una cadena de texto con nombres de clases de estilo.
 * Para buscar un valor se escribe el nombre entre corchetes, por ejemplo buttonVariants["primary"].
 * Las clases son "etiquetas de pintura" que el navegador lee para dar color, tamaño o forma.
 *
 * Record<ButtonVariant, string> significa: "un diccionario donde cada clave es de ButtonVariant
 * y cada valor es un texto (string)". Así TypeScript nos obliga a no olvidar ninguna variante.
 */
/** Define button variants como dato o funcion publica de shared frontend. */
export const buttonVariants: Record<ButtonVariant, string> = {
  /*
   * Variante "primary": el botón principal, el que queremos que la persona note.
   * - "liquid-btn-primary": clase propia del efecto de ondas líquidas (definida en index.css).
   * - "bg-accent": color de fondo ámbar (el color "acento" definido en index.css).
   * - "text-on-accent": color del texto que se ve bien sobre el ámbar (casi negro).
   * - "font-semibold": letra un poco gruesa.
   * - "shadow-[...]": una sombra de color ámbar que hace que el botón parezca flotar.
   * - "ring-1 ring-white/35": un borde fino y medio transparente de color blanco.
   * - "hover:brightness-105": cuando el mouse pasa encima, el botón se ve un poquito más brillante.
   * Las dos líneas se unen con "+", porque el texto es muy largo y lo partimos en dos para leerlo mejor.
   */
  primary:
    "liquid-btn-primary bg-accent text-on-accent font-semibold " +
    "shadow-[0_12px_26px_-12px_var(--color-accent)] ring-1 ring-white/35 hover:brightness-105",
  /*
   * Variante "secondary": botón de cristal, para acciones que no son la principal.
   * - "liquid-btn-glass": efecto de cristal con ondas.
   * - "neo-raised": efecto de relieve (parece levantado de la pantalla).
   * - "text-slate-100": texto casi blanco.
   * - "hover:text-accent-cyan": al pasar el mouse, el texto cambia a azul claro.
   */
  secondary: "liquid-btn-glass neo-raised font-medium text-slate-100 hover:text-accent-cyan",
  /*
   * Variante "ghost" (fantasma): botón casi invisible, sin fondo, ideal para acciones suaves.
   * - "text-slate-300": texto gris claro.
   * - "hover:bg-slate-400/12": al pasar el mouse aparece un fondo gris muy suave.
   */
  ghost: "liquid-btn-ghost text-slate-300 hover:bg-slate-400/12 hover:text-slate-100",
  /*
   * Variante "danger" (peligro): para acciones que borran o que no se pueden deshacer.
   * - "bg-rose-500/14": fondo rojizo muy suave.
   * - "text-rose-200": texto rosado.
   * - "ring-rose-400/35": borde rosado.
   * Así la persona siente que debe pensarlo antes de tocar.
   */
  danger: "liquid-btn-glass bg-rose-500/14 text-rose-200 ring-1 ring-rose-400/35 hover:bg-rose-500/22",
};

/**
 * buttonSizes es otro diccionario: asocia cada tamaño con sus clases de medidas.
 * En Tailwind, un número como "h-11" significa 11 "pasos" de 4 píxeles = 44 píxeles de alto.
 */
/** Define button sizes como dato o funcion publica de shared frontend. */
export const buttonSizes: Record<ButtonSize, string> = {
  // "sm": alto de 44 px, espacio lateral chico (px-3), letra pequeña, separación chica entre piezas (gap-1.5).
  sm: "h-11 px-3 text-sm gap-1.5",
  // "md": alto de 44 px, espacio lateral normal (px-5), letra normal, separación normal (gap-2).
  md: "h-11 px-5 text-sm gap-2",
  // "lg": alto de 48 px (h-12), espacio lateral grande (px-6) y letra más grande (text-base).
  lg: "h-12 px-6 text-base gap-2",
  // "icon": cuadrado de 44 x 44 px (size-11) que no se encoge (shrink-0), ideal para un solo icono.
  icon: "size-11 shrink-0",
};

/**
 * buttonBase son las clases que TODOS los botones comparten, sin importar su color o tamaño.
 * Es como la base de una maceta: siempre está, y encima se le ponen flores de distintos colores.
 */
/** Define button base como dato o funcion publica de shared frontend. */
export const buttonBase =
  // "jelly": animación de rebote suave al tocar (definida en index.css).
  // "liquid-host": marca al botón como "contenedor de ondas" para que el efecto pueda dibujarse dentro.
  // "inline-flex items-center justify-center": acomoda icono y texto en una fila, centrados.
  // "rounded-xl": esquinas redondeadas.
  // "transition duration-200": los cambios de color o sombra se hacen poco a poco, en 0.2 segundos.
  "jelly liquid-host inline-flex items-center justify-center rounded-xl transition duration-200 " +
  // Cuando el botón está deshabilitado: el mouse se vuelve "prohibido" y se ve un poco transparente (60%).
  "disabled:cursor-not-allowed disabled:opacity-60";

/* "Variant" es solo un nombre corto y cómodo para ButtonVariant dentro de este archivo. */
/** Contrato de datos Variant utilizado por interfaz compartida. */
type Variant = ButtonVariant;
/* "Size" es solo un nombre corto y cómodo para ButtonSize dentro de este archivo. */
/** Contrato de datos Size utilizado por interfaz compartida. */
type Size = ButtonSize;

/**
 * ButtonProps describe qué datos puede recibir el botón (sus "propiedades" o props).
 * Es como el formulario que se llena al pedir un botón a la fábrica:
 * - Hereda todo lo que un botón normal de HTML ya acepta (onClick, disabled, etc.).
 * - variant: el estilo (opcional; si no se pone, usa "primary").
 * - size: el tamaño (opcional; si no se pone, usa "md").
 * - loading: si es true, muestra la ruedita de carga (opcional; por defecto false).
 * - icon: un dibujito que se muestra antes del texto (opcional).
 * El signo "?" significa "opcional": puede faltar.
 */
/** Contrato de datos ButtonProps utilizado por interfaz compartida. */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estilo del botón: primary, secondary, ghost o danger. */
  variant?: Variant;
  /** Tamaño del botón: sm, md, lg o icon. */
  size?: Size;
  /** Si es true, el botón muestra carga y no se puede tocar. */
  loading?: boolean;
  /** Un icono opcional que aparece antes del texto. */
  icon?: ReactNode;
}

/**
 * Button es el componente que dibuja el botón en la pantalla.
 *
 * Cómo se usa: <Button variant="danger" onClick={borrar}>Borrar</Button>
 *
 * Qué recibe: las propiedades de ButtonProps. Todas son opcionales excepto los textos que pongas dentro.
 * Qué devuelve: un botón (<button>) ya listo para mostrarse.
 *
 * Qué pasa en cada caso:
 * - Normal: se ve con el estilo y tamaño elegidos.
 * - Cargando (loading = true): aparece la ruedita, el botón no se puede tocar y avisa que está ocupado.
 * - Deshabilitado (disabled): no se puede tocar y se ve apagado.
 */
/** Expone la funcion button para el flujo de shared frontend. */
export function Button({
  // Si no nos dicen el estilo, usamos "primary".
  variant = "primary",
  // Si no nos dicen el tamaño, usamos "md".
  size = "md",
  // Si no nos dicen si está cargando, suponemos que no (false).
  loading = false,
  // El icono es opcional; si no llega, queda undefined (vacío).
  icon,
  // Si llega un "disabled" desde afuera, lo guardamos aquí.
  disabled,
  // Un texto de clases extra que quien usa el botón quiere agregar.
  className,
  // Lo que va dentro del botón (el texto o las piezas que pongas entre <Button> y </Button>).
  children,
  // El tipo del botón. Por defecto es "button" para que NO envíe formularios por accidente.
  type = "button",
  // "...props" junta todas las demás propiedades (como onClick) en una sola bolsa para pasarlas al botón real.
  ...props
}: ButtonProps) {
  // Aquí empieza lo que se dibuja en pantalla.
  return (
    <button
      // El tipo de botón (por defecto "button"). Así no manda formularios sin querer.
      type={type}
      // Se bloquea si está deshabilitado a propósito O si está cargando.
      disabled={disabled || loading}
      // "aria-busy" le avisa a los lectores de pantalla (para personas ciegas) que el botón está ocupado.
      // "loading || undefined": si no está cargando, mandamos undefined para no escribir nada.
      aria-busy={loading || undefined}
      // Armamos la lista final de clases: la base + el color + el tamaño + las clases extra que llegaron.
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      // Pasamos al botón real todas las demás propiedades que llegaron (onClick, id, etc.).
      {...props}
    >
      {/* Si está cargando mostramos la ruedita; si no, mostramos el icono (que puede estar vacío). */}
      {loading ? <Spinner /> : icon}
      {/* El texto del botón, lo que el usuario escribió entre las etiquetas. */}
      {children}
    </button>
  );
}
