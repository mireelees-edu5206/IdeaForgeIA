import { type TextareaHTMLAttributes, useId } from "react";

import { cn } from "../../lib/cn";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: string;
  /** Muestra el contador "n / max" (usa maxLength). */
  showCount?: boolean;
}

export function TextArea({
  label,
  hideLabel = false,
  error,
  hint,
  showCount = false,
  maxLength,
  value,
  className,
  rows = 4,
  ...props
}: TextAreaProps) {
  const id = useId();
  const length = typeof value === "string" ? value.length : 0;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium text-slate-300", hideLabel && "sr-only")}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "neo-inset w-full resize-y rounded-xl px-4 py-3 leading-relaxed text-slate-100 placeholder:text-slate-500",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
          error && "ring-2 ring-rose-400/70",
        )}
        {...props}
      />
      <div className="flex items-start justify-between gap-3 text-xs">
        <div>
          {error && (
            <p id={`${id}-error`} className="text-sm text-rose-300">
              {error}
            </p>
          )}
          {hint && (
            <p id={`${id}-hint`} className="text-slate-400">
              {hint}
            </p>
          )}
        </div>
        {showCount && maxLength && (
          <span className="shrink-0 tabular-nums text-slate-400" aria-live="polite">
            {length.toLocaleString("es")} / {maxLength.toLocaleString("es")}
          </span>
        )}
      </div>
    </div>
  );
}
