"use client";
// components/ui/MixedCurrencyBanner.tsx
// TradeFourge v3.8.2 — Warning banner for mixed currency account selections.

import React from "react";
import { AlertTriangle } from "lucide-react";

interface MixedCurrencyBannerProps {
  className?: string;
}

export const MixedCurrencyBanner: React.FC<MixedCurrencyBannerProps> = ({ className = "" }) => {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-bold text-amber-300 font-mono">
          Mixed Currency Selection
        </h4>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          Analytics cannot combine different currencies. Please select accounts
          using the same currency for accurate calculations.
        </p>
      </div>
    </div>
  );
};
