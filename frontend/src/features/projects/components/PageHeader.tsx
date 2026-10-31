/**
 * ARCHIVO: projects/components/PageHeader.tsx
 *
 * ¿Qué es?
 * Es la "cabecera" de una pantalla: el bloque de arriba con el título grande, una frase de ayuda
 * y botones de acción. Como la portada de un capítulo: dice dónde estás y qué puedes hacer.
 *
 * ¿Para qué sirve?
 * Para que todas las pantallas de proyectos tengan la misma cabecera, con el mismo tamaño y acomodo.
 * Opcionalmente muestra una etiqueta pequeña arriba del título (eyebrow), por ejemplo "Centro de control".
 *
 * ¿Quién lo usa?
 * ProjectsPage, NewProjectPage y otras pantallas de proyectos y administración.
 */

/* "ReactNode" es cualquier contenido que React puede dibujar (texto, botones, enlaces). */
import type { ReactNode } from "react";

/**
 * PageHeader dibuja la cabecera.
 *
 * Recibe:
 * - title: el título principal (puede ser texto o algo con formato).
 * - description (opcional): la frase de ayuda debajo del título.
 * - actions (opcional): botones que aparecen a la derecha (en celulares, debajo).
 * - eyebrow (opcional): la etiqueta pequeña de color azul encima del título.
 */
/** Cabecera reutilizable de pagina. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    // "flex-col" en celulares (uno sobre otro) y "sm:flex-row" en pantallas medianas (lado a lado).
    // "sm:justify-between" empuja los botones a la derecha; "sm:items-end" los alinea abajo.
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {/* La etiqueta de arriba. Solo se dibuja si la pasaron ("eyebrow &&"). */}
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold tracking-wider text-accent-cyan uppercase">{eyebrow}</p>
        )}
        {/* El título principal de la pantalla (h1). Crece en pantallas grandes. */}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {/* La frase de ayuda. Solo si existe. */}
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-300 sm:text-base">{description}</p>}
      </div>
      {/* Los botones, si los hay. "flex-wrap" permite que bajen a otra línea si no caben. "shrink-0" evita que se achiquen. */}
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
