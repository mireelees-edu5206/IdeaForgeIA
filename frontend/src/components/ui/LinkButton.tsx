/**
 * ARCHIVO: LinkButton.tsx
 *
 * ¿Qué es?
 * Es un "botón que lleva a otra página". Se ve igual que un botón normal (Button.tsx),
 * pero al tocarlo, en vez de hacer una acción, te cambia de pantalla.
 *
 * ¿Para qué sirve?
 * Para los botones de navegación, como "Nueva idea", que deben llevar a una dirección.
 * Así usamos el mismo aspecto que los demás botones, sin repetir clases de estilo.
 *
 * ¿Quién lo usa?
 * Topbar.tsx y Sidebar.tsx lo usan para el botón "Nueva idea".
 *
 * Diferencia clave: Button.tsx hace acciones (guardar, borrar); LinkButton lleva a una dirección (como un enlace).
 */

/* Traemos el tipo "ReactNode": cualquier cosa que React puede dibujar. */
import type { ReactNode } from "react";
/* "Link" es el enlace de React Router. "LinkProps" es la lista de datos que acepta un enlace (como "to"). */
import { Link, type LinkProps } from "react-router";

/* "cn" une textos de clases de estilo. */
import { cn } from "../../lib/cn";
/* Del archivo Button.tsx tomamos las mismas piezas de estilo: tipos de variante y tamaño, y las clases comunes. */
import { type ButtonSize, type ButtonVariant, buttonBase, buttonSizes, buttonVariants } from "./Button";

/**
 * LinkButtonProps describe qué datos recibe el botón-enlace.
 * "extends LinkProps" significa que hereda todo lo que acepta un enlace normal (por ejemplo, "to" con la dirección).
 * Además agrega tres datos opcionales de estilo: variant, size e icon.
 */
/** Contrato de datos LinkButtonProps utilizado por interfaz compartida. */
interface LinkButtonProps extends LinkProps {
  /** El estilo de color del botón (primary, secondary, ghost o danger). */
  variant?: ButtonVariant;
  /** El tamaño del botón (sm, md, lg o icon). */
  size?: ButtonSize;
  /** Un icono opcional que aparece antes del texto. */
  icon?: ReactNode;
}

/**
 * LinkButton dibuja un enlace con apariencia de botón.
 *
 * Cómo se usa: <LinkButton to="/proyectos/nuevo" icon={<FiPlus />}>Nueva idea</LinkButton>
 *
 * Recibe: "to" (la dirección, obligatoria), y opcionalmente variant, size, icon, className y los textos.
 * Devuelve: un enlace <a> ya con el estilo de botón.
 */
/** Enlace con apariencia de botón (navegación, no acciones). */
export function LinkButton({ variant = "primary", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  // Dibujamos el enlace.
  // Armamos las clases finales: la base común + el color de la variante + el tamaño + las clases extra de quien lo usa.
  // Si no nos dieron variante ni tamaño, usamos "primary" y "md" (valores por defecto de arriba).
  // "...props" pasa al enlace todo lo demás que llegó, como "to" (la dirección a la que va).
  return (
    <Link className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props}>
      {/* El icono opcional, antes del texto. Si no llega, no se dibuja nada. */}
      {icon}
      {/* El texto del botón, lo que escribiste entre <LinkButton> y </LinkButton>. */}
      {children}
    </Link>
  );
}
