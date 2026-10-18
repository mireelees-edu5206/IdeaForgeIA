import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-accent-cyan to-accent-violet text-white font-semibold " +
    "shadow-[0_14px_30px_-14px_var(--color-accent-violet)] ring-1 ring-white/25 hover:brightness-105",
  secondary: "neo-raised font-medium text-slate-100 hover:text-accent-cyan",
  ghost: "text-slate-300 hover:bg-slate-400/10 hover:text-slate-100",
  danger: "bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/20",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "size-9 shrink-0",
};

export const buttonBase =
  "jelly inline-flex items-center justify-center rounded-xl transition duration-200 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

type Variant = ButtonVariant;
type Size = ButtonSize;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
