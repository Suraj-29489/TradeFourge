"use client";
// app/(app)/api-keys/page.tsx
// Broker Integrations & API Keys placeholder page.

import React from "react";
import { Key, ShieldAlert } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 text-xs font-mono">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Broker Integrations & API Keys
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Automated trade synchronization and real-time execution tracking
        </p>
      </div>

      <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
          <Key className="w-6 h-6" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-lg font-bold text-white">
            Integrations Coming Soon
          </h2>
          <p className="text-gray-300 text-xs leading-relaxed">
            This feature will become available when broker integrations (MT4, MT5, cTrader, TradingView, etc.) are released.
          </p>
        </div>

        <div className="pt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Manual CSV upload & entry are active across TradeFourge v3.1</span>
        </div>
      </div>
    </div>
  );
}
