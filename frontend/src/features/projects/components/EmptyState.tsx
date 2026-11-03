/**
 * ARCHIVO: projects/components/EmptyState.tsx
 *
 * ¿Qué es?
 * Estado vacío con ilustración vectorial animada, icono, título claro y botón de acción.
 */

import type { ReactNode } from "react";
import type { IconType } from "react-icons";

import { EmptyIllustration } from "../../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../../components/ui/GlassPanel";

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassPanel className="stage-3d flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center animate-fade-up">
      <div className="relative flex flex-col items-center">
        <EmptyIllustration className="h-28 w-44" />
        <span className="neo-raised -mt-6 grid size-12 place-items-center rounded-2xl ring-1 ring-primary/25 shadow-sm">
          <Icon aria-hidden="true" className="size-5 text-primary" />
        </span>
      </div>
      <h2 className="font-display mt-1 text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-slate-300">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </GlassPanel>
  );
}
