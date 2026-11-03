/**
 * ARCHIVO: Logo.tsx
 *
 * ¿Qué es?
 * Nuevo logo editorial de IdeaForge AI: insignia en carbón cálido con la brújula terracota/salvia
 * y tipografía geométrica Space Grotesk. Sin degradados morados.
 */

import { CrucibleGlyph } from "./ForgeGlyphs";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role={compact ? "img" : undefined}
      aria-label={compact ? "IdeaForge AI" : undefined}
      className="group inline-flex items-center gap-3"
    >
      <span className="brand-logo-mark relative grid size-10 shrink-0 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105">
        <CrucibleGlyph className="size-6 text-white" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none whitespace-nowrap">
          <span className="font-display text-lg font-bold tracking-tight">
            IdeaForge <span className="text-primary">Studio</span>
          </span>
          <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
            Validación con evidencia
          </span>
        </span>
      )}
    </span>
  );
}
