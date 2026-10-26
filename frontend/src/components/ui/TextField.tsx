import { type InputHTMLAttributes, useId, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

import { cn } from "../../lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, type = "text", className, ...props }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "neo-inset h-11 w-full rounded-xl px-4 text-slate-100 placeholder:text-slate-500",
            "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
            error && "ring-2 ring-rose-400/70",
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="jelly mt-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            {revealed ? <FiEyeOff aria-hidden="true" className="size-4" /> : <FiEye aria-hidden="true" className="size-4" />}
            <span>{revealed ? "Ocultar contraseña" : "Mostrar contraseña"}</span>
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-300">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
