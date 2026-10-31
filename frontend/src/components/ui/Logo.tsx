/**
 * ARCHIVO: Logo.tsx
 *
 * ¿Qué es?
 * Es el logo de IdeaForge: un cuadrito con el dibujo del crisol (la olla donde se funde el metal)
 * y, al lado, el nombre "IdeaForge AI" con el subtítulo "Estudio de ideas".
 *
 * ¿Para qué sirve?
 * Para que la marca aparezca igual en todas partes. Tiene dos versiones:
 * - Completa: icono + nombre + subtítulo. Se usa en el menú lateral de computadoras y en las pantallas de entrada.
 * - Compacta: solo el icono. Se usa en la barra superior de celulares, donde no cabe el nombre.
 *
 * ¿Quién lo usa?
 * Sidebar.tsx, Topbar.tsx y AuthLayout.tsx.
 */

/* Traemos el dibujo del crisol desde ForgeGlyphs.tsx (los dibujos SVG propios de la marca). */
import { CrucibleGlyph } from "./ForgeGlyphs";

/**
 * Logo dibuja la marca.
 *
 * Cómo se usa: <Logo />  (completa)   o   <Logo compact />  (solo icono)
 *
 * Recibe:
 * - compact (opcional, por defecto false): si es true, oculta el nombre y deja solo el icono.
 */
/** Expone la funcion logo para el flujo de shared frontend. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span
      // En la versión compacta, el logo se anuncia como una imagen con nombre para lectores de pantalla.
      // En la versión completa no hace falta: el texto ya se lee solo. Por eso, si no es compacta, "role" queda sin valor.
      role={compact ? "img" : undefined}
      aria-label={compact ? "IdeaForge AI" : undefined}
      // "inline-flex items-center" pone el icono y el texto en fila y centrados verticalmente.
      className="inline-flex items-center gap-2.5"
    >
      {/* El cuadrito con el icono. "neo-raised" le da aspecto de botón levantado y "ring-accent-cyan/30" un borde celeste suave. */}
      <span className="neo-raised grid size-9 place-items-center rounded-xl ring-1 ring-accent-cyan/30">
        <CrucibleGlyph className="size-5 text-accent-cyan" />
      </span>
      {/* El nombre y el subtítulo. Solo se dibujan si NO es la versión compacta ("!compact"). */}
      {!compact && (
        // "leading-none" quita el espacio extra entre las dos líneas de texto.
        <span className="flex flex-col leading-none">
          {/* "IdeaForge" en letra de títulos, y la palabra "AI" con el degradado de color (text-gradient, definido en index.css). */}
          <span className="font-display text-lg font-bold tracking-tight">
            IdeaForge <span className="text-gradient">AI</span>
          </span>
          {/* El subtítulo: letra pequeña, mayúsculas y con las letras separadas (tracking-widest). */}
          <span className="font-mono-tech mt-0.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
            Estudio de ideas
          </span>
        </span>
      )}
    </span>
  );
}
