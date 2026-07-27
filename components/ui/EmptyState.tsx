"use client";
// components/ui/EmptyState.tsx
// Reusable premium empty states used across all pages.

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
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
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  const sizeStyles = {
    sm: { wrapper: "p-8 my-4", icon: "w-10 h-10", iconWrapper: "w-14 h-14 rounded-2xl", title: "text-lg", desc: "text-xs" },
    md: { wrapper: "p-12 my-8", icon: "w-12 h-12", iconWrapper: "w-20 h-20 rounded-3xl", title: "text-2xl", desc: "text-sm" },
    lg: { wrapper: "p-16 my-12", icon: "w-14 h-14", iconWrapper: "w-24 h-24 rounded-3xl", title: "text-3xl", desc: "text-base" },
  }[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-3xl glass-card border border-dark-border",
        sizeStyles.wrapper,
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center bg-purple-600/10 border border-purple-500/20 text-purple-400 shadow-glow mb-6",
          sizeStyles.iconWrapper
        )}
      >
        <Icon className={sizeStyles.icon} />
      </div>

      {/* Text */}
      <h2
        className={cn(
          "font-extrabold text-white tracking-tight mb-2",
          sizeStyles.title
        )}
      >
        {title}
      </h2>
      <p className={cn("text-gray-400 max-w-sm mx-auto", sizeStyles.desc)}>
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
          {action && (
            <>
              {action.href ? (
                <Link
                  href={action.href}
                  className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow flex items-center gap-2 transition-all"
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  onClick={action.onClick}
                  className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow flex items-center gap-2 transition-all"
                >
                  {action.label}
                </button>
              )}
            </>
          )}

          {secondaryAction && (
            <>
              {secondaryAction.href ? (
                <Link
                  href={secondaryAction.href}
                  className="px-6 py-3 rounded-2xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold text-sm flex items-center gap-2 transition-all"
                >
                  {secondaryAction.label}
                </Link>
              ) : (
                <button
                  onClick={secondaryAction.onClick}
                  className="px-6 py-3 rounded-2xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-bold text-sm flex items-center gap-2 transition-all"
                >
                  {secondaryAction.label}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
