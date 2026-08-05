"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "profit" | "loss" | "brand";
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
}) => {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 md:p-5 glass-card glass-card-hover flex flex-col justify-between group",
        variant === "profit" && "border-emerald-500/30 hover:border-emerald-500/50",
        variant === "loss" && "border-rose-500/30 hover:border-rose-500/50",
        variant === "brand" && "border-brand-500/30 hover:border-brand-500/50"
      )}
    >
      <div
        className={cn(
          "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-25 pointer-events-none",
          variant === "profit" && "bg-emerald-500",
          variant === "loss" && "bg-rose-500",
          variant === "brand" && "bg-brand-500",
          variant === "default" && "bg-indigo-500"
        )}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <div
          className={cn(
            "p-2 rounded-xl border transition-transform duration-200 group-hover:scale-110",
            variant === "profit" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            variant === "loss" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
            variant === "brand" && "bg-brand-500/10 text-brand-400 border-brand-500/20",
            variant === "default" && "bg-gray-800/50 text-gray-300 border-gray-700/50"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-xl md:text-2xl font-bold font-mono tracking-tight",
              variant === "profit" && "text-emerald-400",
              variant === "loss" && "text-rose-400",
              variant === "brand" && "text-brand-300",
              variant === "default" && "text-white"
            )}
          >
            {value}
          </span>
          {trendValue && (
            <span
              className={cn(
                "text-xs font-mono font-semibold px-2 py-0.5 rounded-full border",
                trend === "up" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                trend === "down" && "bg-rose-500/10 text-rose-400 border-rose-500/30",
                trend === "neutral" && "bg-gray-800 text-gray-400 border-gray-700"
              )}
            >
              {trendValue}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-gray-400 mt-1 font-sans">{subtitle}</p>}
      </div>
    </motion.div>
  );
};
