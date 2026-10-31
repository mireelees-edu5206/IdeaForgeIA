/**
 * ARCHIVO: GlassPanel.tsx
 *
 * ¿Qué es?
 * Es una "tarjeta de cristal": una caja con esquinas redondeadas y un fondo que parece vidrio.
 * Imagina una hoja de papel transparente donde pones información para que se vea ordenada.
 *
 * ¿Para qué sirve?
 * Sirve para agrupar contenido relacionado (un formulario, una lista, un resultado) dentro de
 * un recuadro con el mismo aspecto en toda la aplicación. Si mañana cambiamos el estilo de las
 * tarjetas, basta con cambiarlo aquí.
 *
 * ¿Quién lo usa?
 * Muchas pantallas, por ejemplo ReportsTab.tsx, VisualizationsTab.tsx y AdminLabPage.tsx,
 * lo importan para envolver su contenido.
 */

/* Traemos el tipo "HTMLAttributes": la lista de propiedades que acepta un <div> normal de HTML (id, onClick, etc.). */
import type { HTMLAttributes } from "react";

/* Traemos "cn", la ayuda que junta textos de clases de estilo en uno solo. */
import { cn } from "../../lib/cn";

/**
 * GlassPanel es la tarjeta de cristal.
 *
 * Cómo se usa: <GlassPanel className="p-4">Tu contenido aquí</GlassPanel>
 *
 * Recibe: "className" (clases extra opcionales) y cualquier otra propiedad de un <div> normal.
 * Devuelve: un <div> con el estilo de cristal y el contenido que pongas dentro.
 */
/** Expone la funcion glass panel para el flujo de shared frontend. */
export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Dibujamos un <div> con:
  // - "surface-panel": clase de estilo de cristal definida en index.css (fondo, borde y sombra).
  // - "rounded-2xl": esquinas muy redondeadas.
  // - "className": clases extra que quien usa la tarjeta quiera agregar. "cn" las une con las anteriores.
  // - "{...props}": cualquier otra propiedad (como id u onClick) se pasa directo al <div>.
  return <div className={cn("surface-panel rounded-2xl", className)} {...props} />;
}
