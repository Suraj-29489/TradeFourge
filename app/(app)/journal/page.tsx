"use client";

import React from "react";
import { TradesTable } from "@/components/trades/TradesTable";
import { TableProperties } from "lucide-react";

export default function JournalPage() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            TradeFourge Trade Log & Ledger
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              AUDITED LOG
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Filter, inspect, and audit detailed position executions across all connected journals
          </p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-purple-400">
          <TableProperties className="w-6 h-6" />
        </div>
      </div>

      <TradesTable />
    </div>
  );
}
