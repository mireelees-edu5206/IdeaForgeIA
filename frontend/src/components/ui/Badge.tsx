import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Badge({ className, icon, children }: { className?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
