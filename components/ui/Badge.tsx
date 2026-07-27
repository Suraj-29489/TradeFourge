"use client";
// components/ui/Badge.tsx
// Consistent status/type badges used across accounts, imports, trades, etc.

import React from "react";
import { cn } from "@/utils/cn";
import type { ImportStatus, AccountType, TradeOutcome } from "@/types/database";

type BadgeVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "neutral"
  | "brand"
  | "live"
  | "demo"
  | "prop"
  | "win"
  | "loss"
  | "breakeven"
  | "open";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error:     "bg-rose-500/10    text-rose-400    border-rose-500/30",
  warning:   "bg-amber-500/10   text-amber-400   border-amber-500/30",
  info:      "bg-sky-500/10     text-sky-400     border-sky-500/30",
  neutral:   "bg-gray-500/10    text-gray-400    border-gray-500/20",
  brand:     "bg-purple-600/20  text-purple-400  border-purple-500/30",
  live:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  demo:      "bg-amber-500/10   text-amber-400   border-amber-500/30",
  prop:      "bg-sky-500/10     text-sky-400     border-sky-500/30",
  win:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  loss:      "bg-rose-500/10    text-rose-400    border-rose-500/30",
  breakeven: "bg-gray-500/10    text-gray-400    border-gray-500/20",
  open:      "bg-sky-500/10     text-sky-400     border-sky-500/30",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = "neutral", children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border font-mono uppercase tracking-wide",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", {
          "bg-emerald-400": variant === "success" || variant === "live" || variant === "win",
          "bg-rose-400": variant === "error" || variant === "loss",
          "bg-amber-400": variant === "warning" || variant === "demo",
          "bg-sky-400": variant === "info" || variant === "prop" || variant === "open",
          "bg-gray-400": variant === "neutral" || variant === "breakeven",
          "bg-purple-400": variant === "brand",
        })} />
      )}
      {children}
    </span>
  );
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const map: Record<ImportStatus, { variant: BadgeVariant; label: string }> = {
    success:    { variant: "success", label: "Success" },
    partial:    { variant: "warning", label: "Partial" },
    failed:     { variant: "error",   label: "Failed" },
    processing: { variant: "info",    label: "Processing" },
    pending:    { variant: "neutral", label: "Pending" },
  };
  const { variant, label } = map[status] ?? map.pending;
  return <Badge variant={variant} dot>{label}</Badge>;
}

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const map: Record<AccountType, BadgeVariant> = {
    Live:    "live",
    Demo:    "demo",
    Prop:    "prop",
    Contest: "brand",
  };
  return <Badge variant={map[type] ?? "neutral"} dot>{type}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: TradeOutcome | null }) {
  if (!outcome) return <Badge variant="neutral">—</Badge>;
  const map: Record<TradeOutcome, BadgeVariant> = {
    WIN:       "win",
    LOSS:      "loss",
    BREAKEVEN: "breakeven",
    OPEN:      "open",
  };
  return <Badge variant={map[outcome]} dot>{outcome}</Badge>;
}
