"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={`p-12 sm:p-16 rounded-2xl border text-center space-y-4 font-mono w-full max-w-7xl mx-auto ${
      isLight
        ? "bg-white border-slate-200 shadow-sm text-slate-900"
        : "bg-[#0F141C] border-white/[0.08] shadow-xl text-white"
    }`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
        isLight
          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
      }`}>
        <Icon className="w-7 h-7" />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className={`text-base font-extrabold uppercase tracking-wide font-sans ${isLight ? "text-slate-900" : "text-white"}`}>{title}</h3>
        <p className={`text-xs leading-relaxed font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>{description}</p>
      </div>

      {(action || secondaryAction) && (
        <div className="pt-3 flex items-center justify-center gap-3">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isLight ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                }`}
              >
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isLight ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                }`}
              >
                <span>{action.label}</span>
              </button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span>{secondaryAction.label}</span>
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                }`}
              >
                <span>{secondaryAction.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
