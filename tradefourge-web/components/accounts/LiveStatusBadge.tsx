"use client";
// components/accounts/LiveStatusBadge.tsx
// TradeFourge v4.0 Live Status Indicator Badge

import React from "react";
import { Activity, RefreshCw, AlertCircle, WifiOff } from "lucide-react";
import type { LiveConnectionStatus } from "@/types/database";

interface LiveStatusBadgeProps {
  status?: LiveConnectionStatus;
  lastSyncedAt?: string | null;
  className?: string;
}

export const LiveStatusBadge: React.FC<LiveStatusBadgeProps> = ({
  status = "Connected",
  lastSyncedAt,
  className = "",
}) => {
  if (status === "Connected") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold ${className}`}
        title={lastSyncedAt ? `Last Synced: ${new Date(lastSyncedAt).toLocaleString()}` : "Connected"}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span>Connected</span>
      </div>
    );
  }

  if (status === "Syncing") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-blue-400" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (status === "Reconnecting") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-amber-400" />
        <span>Reconnecting</span>
      </div>
    );
  }

  if (status === "Error") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
        <span>Connection Error</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400 text-xs font-mono font-bold ${className}`}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0 text-gray-400" />
      <span>Offline</span>
    </div>
  );
};
