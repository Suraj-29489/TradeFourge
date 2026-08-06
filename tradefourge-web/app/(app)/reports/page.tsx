"use client";

import React from "react";
import { BookOpen, Sparkles, Lock } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6 font-mono text-gray-200 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08]">
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <span>Reports</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          AI generated trading reports will appear here after analyzing this account.
        </p>
      </div>

      {/* Empty State / Coming Soon Container */}
      <div className="p-16 rounded-2xl bg-[#0F141C] border border-white/[0.08] text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold font-sans text-white">
            AI Trading Reports Coming Soon
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            AI generated trading reports will appear here after analyzing this account. Automated performance audits, behavioral tilt alerts, and equity projections are currently in development.
          </p>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="px-6 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-500 font-bold text-xs inline-flex items-center gap-2 cursor-not-allowed select-none"
          >
            <Lock className="w-4 h-4" />
            <span>Coming Soon</span>
          </button>
        </div>
      </div>
    </div>
  );
}
