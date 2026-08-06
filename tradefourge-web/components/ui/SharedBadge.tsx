"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SharedBadgeProps {
  label: string;
  variant?: "primary" | "success" | "danger" | "warning" | "neutral";
  size?: "sm" | "md";
  icon?: LucideIcon;
  className?: string;
}

export const SharedBadge: React.FC<SharedBadgeProps> = ({
  label,
  variant = "primary",
  size = "sm",
  icon: Icon,
  className,
}) => {
  const variantStyles = {
    primary: "bg-blue-600/20 text-blue-300 border-blue-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    neutral: "bg-white/[0.04] text-gray-300 border-white/[0.08]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono font-bold rounded-full border tracking-wide uppercase transition-colors shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {Icon && <Icon className={cn("shrink-0", size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5")} />}
      <span>{label}</span>
    </span>
  );
};
