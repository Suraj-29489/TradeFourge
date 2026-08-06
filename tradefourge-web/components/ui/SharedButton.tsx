"use client";

import React from "react";
import { LucideIcon, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export interface SharedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  children: React.ReactNode;
}

export const SharedButton: React.FC<SharedButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconPosition = "left",
  className,
  disabled,
  children,
  ...props
}) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const variantStyles = {
    primary: isLight
      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-mono shadow-sm active:scale-95 border border-emerald-500/30"
      : "bg-blue-600 hover:bg-blue-500 text-white font-mono shadow-sm active:scale-95 border border-blue-500/30",
    secondary: isLight
      ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-mono active:scale-95"
      : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 border border-white/[0.08] font-mono active:scale-95",
    danger: "bg-rose-600 hover:bg-rose-500 text-white font-mono shadow-sm active:scale-95 border border-rose-500/30",
    ghost: isLight
      ? "bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-mono"
      : "bg-transparent hover:bg-white/[0.05] text-gray-300 hover:text-white font-mono",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-[11px] rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-xs rounded-xl gap-2",
    lg: "px-6 py-3 text-xs rounded-xl gap-2",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-bold transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="w-4 h-4 shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === "right" && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
};
