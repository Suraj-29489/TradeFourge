"use client";
// components/dashboard/TopMistakesWidget.tsx
// TradeFourge v4.2 Top Mistakes & Discipline Progress Dashboard Widget

import React from "react";
import { analyzeTradeMistakes } from "@/lib/toolkit/mistakes-engine";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import type { CloudTradeWithRelations } from "@/types/database";
import { AlertTriangle, ShieldCheck, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";

interface TopMistakesWidgetProps {
  trades: CloudTradeWithRelations[];
}

export const TopMistakesWidget: React.FC<TopMistakesWidgetProps> = ({ trades }) => {
  const { formatSigned } = useCurrencyFormatter();
  const { summaries, totalMistakesTagged, disciplineScore } = analyzeTradeMistakes(trades);

  return (
    <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Discipline & Mistake Audit</h3>
            <p className="text-[10px] text-gray-400">Behavioral rule violations & frequency breakdown</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-gray-400 block">Discipline Score</span>
          <span
            className={`text-base font-extrabold font-mono ${
              disciplineScore >= 80 ? "text-emerald-400" : disciplineScore >= 60 ? "text-amber-400" : "text-rose-400"
            }`}
          >
            {disciplineScore}%
          </span>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto" />
          <p className="text-xs font-bold text-emerald-300">Clean Execution Record</p>
          <p className="text-[10px] text-gray-400">No rule violations or mistake tags recorded across current trades.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {summaries.slice(0, 4).map((m) => (
            <div key={m.name} className="p-2.5 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span>{m.name}</span>
                </span>
                <span className="text-gray-400 text-[11px] font-bold">
                  {m.count} {m.count === 1 ? "trade" : "trades"} ({m.percentage}%)
                </span>
              </div>

              {/* Progress Bar & PnL Impact */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    style={{ width: `${Math.min(m.percentage, 100)}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold font-mono ${
                    m.pnlImpact >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatSigned(m.pnlImpact)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
