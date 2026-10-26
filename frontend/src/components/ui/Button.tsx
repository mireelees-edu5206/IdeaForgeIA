import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import { initLiquidGlass } from "../../lib/liquidGlass";
import { Spinner } from "./Spinner";

initLiquidGlass();

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "liquid-btn-primary bg-accent text-on-accent font-semibold " +
    "shadow-[0_12px_26px_-12px_var(--color-accent)] ring-1 ring-white/35 hover:brightness-105",
  secondary: "liquid-btn-glass neo-raised font-medium text-slate-100 hover:text-accent-cyan",
  ghost: "liquid-btn-ghost text-slate-300 hover:bg-slate-400/12 hover:text-slate-100",
  danger: "liquid-btn-glass bg-rose-500/14 text-rose-200 ring-1 ring-rose-400/35 hover:bg-rose-500/22",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-11 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "size-11 shrink-0",
};

export const buttonBase =
  "jelly liquid-host inline-flex items-center justify-center rounded-xl transition duration-200 " +
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
