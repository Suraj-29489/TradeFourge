"use client";

import React from "react";
import { motion } from "framer-motion";
import { TableProperties, TrendingUp, Building2, ShieldCheck } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useTheme } from "@/context/ThemeContext";

interface StatItemProps {
  label: string;
  end: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  change: string;
  icon: React.ElementType;
  badge?: string;
}

const StatCardItem: React.FC<StatItemProps> = ({
  label,
  end,
  decimals = 0,
  prefix = "",
  suffix = "",
  change,
  icon: Icon,
  badge,
}) => {
  const { displayValue, elementRef } = useAnimatedCounter({
    end,
    duration: 1600,
    decimals,
    prefix,
    suffix,
  });
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      ref={elementRef}
      className={`p-6 rounded-2xl border transition-all duration-300 group flex flex-col justify-between ${
        isLight
          ? "bg-white border-[#E5E7EB] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] hover:border-emerald-500/40"
          : "bg-[#131622] border-white/10 hover:border-blue-500/30"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-mono uppercase tracking-wider ${isLight ? "text-slate-600" : "text-gray-400"}`}>
          {label}
        </span>
        <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
          isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-[#0B0D13] border-white/10 text-gray-300 group-hover:text-blue-400"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {displayValue}
          </span>
          {badge && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-blue-600/20 text-blue-400 border-blue-500/30"
            }`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-emerald-500 font-mono font-medium mt-1">
          {change}
        </p>
      </div>
    </div>
  );
};

export const StatsSection: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section className={`py-12 relative z-10 border-t ${isLight ? "border-slate-200 bg-[#F8FAFC]" : "border-white/10 bg-[#0B0D13]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardItem
            label="Verified Trades Tracked"
            end={142850}
            change="↑ 12% this week"
            icon={TableProperties}
          />
          <StatCardItem
            label="Win Rate Improvement"
            end={14.2}
            decimals={1}
            suffix="%"
            change="↑ Avg trader growth"
            icon={TrendingUp}
            badge="Audited"
          />
          <StatCardItem
            label="Prop Accounts Managed"
            end={2840}
            change="↑ Active FTMO & Exness"
            icon={Building2}
          />
          <StatCardItem
            label="Audit Statement Rating"
            end={99.8}
            decimals={1}
            suffix="%"
            change="Institutional Accuracy"
            icon={ShieldCheck}
            badge="Verified"
          />
        </div>
      </div>
    </section>
  );
};
