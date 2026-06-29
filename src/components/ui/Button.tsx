"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "accent" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark active:scale-[0.98] disabled:opacity-60",
  secondary:
    "bg-white text-primary border-2 border-primary hover:bg-primary/5 active:scale-[0.98] disabled:opacity-60",
  accent:
    "bg-accent text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60",
  ghost:
    "bg-transparent text-primary hover:bg-primary/10 active:scale-[0.98] disabled:opacity-60",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded px-4 py-2 text-base font-medium transition ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
