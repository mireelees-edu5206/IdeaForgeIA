import { type SelectHTMLAttributes, useId } from "react";

import { cn } from "../../lib/cn";

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  label: string;
  hideLabel?: boolean;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** Select nativo accesible (etiqueta asociada, foco visible) con el estilo neomórfico. */
export function Select<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  className,
  ...props
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium text-slate-400", hideLabel && "sr-only")}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="neo-inset h-10 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70 disabled:opacity-60"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
