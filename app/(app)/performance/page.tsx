"use client";

import React from "react";
import { StatisticsView } from "@/components/statistics/StatisticsView";
import { BarChart3 } from "lucide-react";

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            TradeFourge Performance Lab
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              INSTITUTIONAL METRICS
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Deep statistical breakdown of win rates, risk-reward ratios, and symbol performance
          </p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-purple-400">
          <BarChart3 className="w-6 h-6" />
        </div>
      </div>

      <StatisticsView />
    </div>
  );
}
