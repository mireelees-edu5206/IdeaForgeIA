import type { ReactNode } from "react";
import type { IconType } from "react-icons";

import { GlassPanel } from "../../../components/ui/GlassPanel";

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassPanel className="stage-3d flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
      <span className="neo-raised tilt-3d grid size-16 place-items-center rounded-2xl ring-1 ring-accent-cyan/25">
        <Icon aria-hidden="true" className="size-7 text-accent-cyan" />
      </span>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-slate-300">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </GlassPanel>
  );
}
