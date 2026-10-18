import type { ReactNode } from "react";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

import { cn } from "../../lib/cn";

const tones = {
  error: { className: "border-rose-400/30 bg-rose-500/10 text-rose-100", Icon: FiAlertTriangle },
  info: { className: "border-sky-400/30 bg-sky-500/10 text-sky-100", Icon: FiInfo },
};

export function Alert({ tone = "error", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  const { className, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
