"use client";

import React from "react";
import { BookOpen, Sparkles, Lock, Zap } from "lucide-react";
import { useCompanionAccount } from "@/context/CompanionAccountContext";

export const CompanionReportsView: React.FC = () => {
  const { currentAccount } = useCompanionAccount();

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto w-full text-gray-200 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08]">
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <span>TradeForge AI Reports</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1 font-sans">
          Reports will automatically generate from connected accounts ({currentAccount?.broker || "Companion"}).
        </p>
      </div>

      {/* Empty State / Coming Soon Container */}
      <div className="p-16 rounded-2xl bg-[#0F141C] border border-white/[0.08] text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-10 h-10 animate-pulse text-blue-400" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold font-sans text-white">
            Companion AI Reports Coming Soon
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed font-sans">
            Reports will automatically generate from connected accounts. Real-time drawdown alerts, prop firm audit certificates, and session win rates are currently in development.
          </p>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="px-6 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-500 font-bold text-xs inline-flex items-center gap-2 cursor-not-allowed select-none font-mono"
          >
            <Lock className="w-4 h-4" />
            <span>Coming Soon</span>
          </button>
        </div>
      </div>
    </div>
  );
};
