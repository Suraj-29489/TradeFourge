"use client";
// components/ui/Button.tsx
// TradeFourge v3.9 — Institutional SaaS Button Primitive

import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold font-mono transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl";

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/30",
    secondary: "bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10",
    ghost: "bg-transparent hover:bg-white/5 text-gray-300 hover:text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 border border-rose-500/30",
    outline: "bg-transparent border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[11px] gap-1.5",
    md: "px-4 py-2 text-xs gap-2",
    lg: "px-6 py-2.5 text-xs gap-2.5",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
