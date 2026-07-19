import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "success" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  success: "btn-success",
  danger: "btn-danger",
  ghost: "btn-ghost",
  outline: "btn-outline",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "",
  lg: "px-5 py-3 text-base",
};

/**
 * Shared button primitive wrapping the `.btn*` design tokens. Adds a
 * consistent loading state (with spinner) and full-width option so every
 * action across the app shares the same interaction model.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn("btn", variantClass[variant], sizeClass[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? (
        <Spinner size={16} />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
});
