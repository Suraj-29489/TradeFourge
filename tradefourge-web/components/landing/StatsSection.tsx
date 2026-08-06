"use client";

import React from "react";
import { motion } from "framer-motion";
import { TableProperties, TrendingUp, Building2, ShieldCheck } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

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

  return (
    <div
      ref={elementRef}
      className="p-6 rounded-2xl bg-[#131622] border border-white/10 hover:border-blue-500/30 transition-all duration-300 group flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="p-2.5 rounded-xl bg-[#0B0D13] border border-white/10 text-gray-300 shrink-0 group-hover:text-blue-400 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
            {displayValue}
          </span>
          {badge && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-400 font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{change}</span>
        </div>
      </div>
    </div>
  );
};

export const StatsSection: React.FC = () => {
  return (
    <section className="py-14 relative z-10 border-y border-white/10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardItem
            label="Trades Analyzed"
            end={25000}
            suffix="+"
            change="Across active trading accounts"
            icon={TableProperties}
          />
          <StatCardItem
            label="Consistency Improvement"
            end={94}
            suffix="%"
            change="Average risk parameter discipline"
            icon={TrendingUp}
          />
          <StatCardItem
            label="Supported Brokers"
            end={50}
            suffix="+"
            badge="Coming Soon"
            change="Exness, MT4/MT5, cTrader sync"
            icon={Building2}
          />
          <StatCardItem
            label="Platform Uptime"
            end={99.9}
            suffix="%"
            decimals={1}
            change="Client-side & cloud availability"
            icon={ShieldCheck}
          />
        </div>
      </div>
    </section>
  );
};
