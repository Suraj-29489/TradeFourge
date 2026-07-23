"use client";

import React from "react";
import { TradesTable } from "@/components/trades/TradesTable";
import { TableProperties } from "lucide-react";

export default function TradesPage() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Trades Journal & Log
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-600/20 text-brand-400 border border-brand-500/30">
              AUDITED TABLE
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Sort, filter, and inspect detailed trade executions and position metrics
          </p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-brand-400">
          <TableProperties className="w-6 h-6" />
        </div>
      </div>

      <TradesTable />
    </div>
  );
}
