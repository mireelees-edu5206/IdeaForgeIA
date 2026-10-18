import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

import { cn } from "../../lib/cn";
import { type ButtonSize, type ButtonVariant, buttonBase, buttonSizes, buttonVariants } from "./Button";

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

/** Enlace con apariencia de botón (navegación, no acciones). */
export function LinkButton({ variant = "primary", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
