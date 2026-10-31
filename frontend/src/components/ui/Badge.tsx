/**
 * ARCHIVO: Badge.tsx
 *
 * ¿Qué es?
 * Es una "etiqueta" pequeña y redondita, como un sticker que pegas en un cuaderno para
 * marcar algo: "Listo", "Fallido", "Borrador", etc.
 *
 * ¿Para qué sirve?
 * Para mostrar de un vistazo el estado o la categoría de algo. El color de la etiqueta lo
 * decide quien la usa, mandándole clases de estilo en "className".
 *
 * ¿Quién lo usa?
 * Pantallas que muestran estados, por ejemplo ReportsTab.tsx o los badges de los proyectos.
 */

/* Traemos el tipo "ReactNode": cualquier cosa que React puede dibujar (texto, un icono, un elemento...). */
import type { ReactNode } from "react";

/* "cn" junta textos de clases de estilo en uno solo. */
import { cn } from "../../lib/cn";

/**
 * Badge dibuja la etiqueta.
 *
 * Cómo se usa: <Badge className="bg-emerald-400/15 text-emerald-200" icon={<FiCheck />}>Listo</Badge>
 *
 * Recibe:
 * - className (opcional): clases de color y estilo que da quien usa la etiqueta.
 * - icon (opcional): un dibujito que aparece antes del texto.
 * - children (obligatorio): el texto que dice la etiqueta, por ejemplo "Listo".
 *
 * Devuelve: un <span> (cuadro de texto pequeño) con el estilo de etiqueta.
 */
/** Expone la funcion badge para el flujo de shared frontend. */
export function Badge({ className, icon, children }: { className?: string; icon?: ReactNode; children: ReactNode }) {
  // Dibujamos un <span> con las clases de la etiqueta.
  return (
    <span
      // "cn" arma la lista final de clases: primero las base de la etiqueta y después las que llegaron desde afuera.
      className={cn(
        // "inline-flex items-center": la etiqueta se acomoda en una fila y su contenido queda centrado.
        // "gap-1.5": separación pequeña entre el icono y el texto.
        // "rounded-full": forma de píldora (esquinas completamente redondas).
        // "px-2.5 py-1": espacio interno a los lados y arriba y abajo.
        // "text-xs font-medium": letra pequeña y un poco gruesa.
        // "whitespace-nowrap": el texto no se parte en dos líneas.
        // "ring-1": un borde fino alrededor (el color del borde lo pone className).
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1",
        className,
      )}
    >
      {/* Si llegó un icono, lo dibujamos primero. Si no llegó, React no dibuja nada aquí. */}
      {icon}
      {/* Luego dibujamos el texto de la etiqueta. */}
      {children}
    </span>
  );
}
