"use client";

import React, { useState, useEffect } from "react";
import { X, LucideIcon, Info, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface DismissibleBannerProps {
  storageKey: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "info" | "blue" | "warning" | "success";
  className?: string;
  children?: React.ReactNode;
}

export const DismissibleBanner: React.FC<DismissibleBannerProps> = ({
  storageKey,
  title,
  description,
  icon: Icon = Zap,
  variant = "blue",
  className,
  children,
}) => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDismissed = localStorage.getItem(storageKey) === "true";
    setDismissed(isDismissed);
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
    }
  };

  if (dismissed) return null;

  const variantStyles = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    info: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  };

  return (
    <div
      className={cn(
        "p-4 rounded-2xl border flex items-start justify-between gap-4 shadow-sm transition-all font-mono",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
          <Icon className="w-5 h-5 fill-blue-300" />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-bold text-white text-xs font-sans">{title}</h4>
          <p className="text-[11px] text-blue-200/90 leading-relaxed font-sans">{description}</p>
          {children && <div className="pt-2">{children}</div>}
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="p-1.5 rounded-xl text-blue-300/70 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
