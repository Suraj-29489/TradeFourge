"use client";
// components/ui/Badge.tsx
// TradeFourge v3.9 — Institutional Badge Primitive (Linear/Vercel Pill Aesthetics)

import React from "react";
import { ImportStatus } from "@/types/database";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  className = "",
}) => {
  const baseStyles = "inline-flex items-center font-mono font-bold rounded-lg border tracking-wide uppercase";

  const variants = {
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    danger: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    info: "bg-sky-500/10 border-sky-500/30 text-sky-400",
    neutral: "bg-white/5 border-white/10 text-gray-300",
    accent: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[9px] gap-1",
    md: "px-2.5 py-1 text-[10px] gap-1.5",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

export const ImportStatusBadge: React.FC<{ status: ImportStatus | string }> = ({ status }) => {
  switch (status) {
    case "success":
      return <Badge variant="success">✓ Success</Badge>;
    case "partial":
      return <Badge variant="warning">⚠ Partial</Badge>;
    case "failed":
      return <Badge variant="danger">⛔ Failed</Badge>;
    case "processing":
      return <Badge variant="accent">⚡ Processing</Badge>;
    default:
      return <Badge variant="neutral">⏳ {status || "Pending"}</Badge>;
  }
};

export const OutcomeBadge: React.FC<{ outcome: string | null; className?: string }> = ({ outcome, className }) => {
  switch (outcome?.toUpperCase()) {
    case "WIN":
      return <Badge variant="success" className={className}>WIN</Badge>;
    case "LOSS":
      return <Badge variant="danger" className={className}>LOSS</Badge>;
    case "BREAKEVEN":
      return <Badge variant="warning" className={className}>BREAKEVEN</Badge>;
    default:
      return <Badge variant="neutral" className={className}>{outcome || "—"}</Badge>;
  }
};

export const AccountTypeBadge: React.FC<{ type: string | null; className?: string }> = ({ type, className }) => {
  return <Badge variant="accent" className={className}>{type || "Standard"}</Badge>;
};
