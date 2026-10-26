import { CrucibleGlyph } from "./ForgeGlyphs";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role={compact ? "img" : undefined}
      aria-label={compact ? "IdeaForge AI" : undefined}
      className="inline-flex items-center gap-2.5"
    >
      <span className="neo-raised grid size-9 place-items-center rounded-xl ring-1 ring-accent-cyan/30">
        <CrucibleGlyph className="size-5 text-accent-cyan" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight">
            IdeaForge <span className="text-gradient">AI</span>
          </span>
          <span className="font-mono-tech mt-0.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
            Estudio de ideas
          </span>
        </span>
      )}
    </span>
  );
}
