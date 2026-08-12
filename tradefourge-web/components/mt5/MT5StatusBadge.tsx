"use client";

import React from "react";
import { MT5ConnectionStatus } from "@/types/mt5";

interface MT5StatusBadgeProps {
  status: MT5ConnectionStatus;
  size?: "sm" | "md" | "lg";
}

export const MT5StatusBadge: React.FC<MT5StatusBadgeProps> = ({ status, size = "md" }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case "Connected":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "Connecting":
      case "Syncing":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Error":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "Disconnected":
      default:
        return "bg-slate-500/10 text-slate-500 dark:text-gray-400 border-slate-500/30";
    }
  };

  const getDotStyle = () => {
    switch (status) {
      case "Connected":
        return "bg-emerald-500 animate-pulse";
      case "Connecting":
      case "Syncing":
        return "bg-amber-500 animate-spin";
      case "Error":
        return "bg-rose-500";
      case "Disconnected":
      default:
        return "bg-slate-400 dark:bg-gray-500";
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return "px-2 py-0.5 text-[10px]";
      case "lg":
        return "px-3.5 py-1.5 text-xs";
      case "md":
      default:
        return "px-2.5 py-1 text-[11px]";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-bold border transition-colors ${getBadgeStyle()} ${getSizeStyle()}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${getDotStyle()}`} />
      <span>{status === "Syncing" ? "Syncing..." : status === "Connecting" ? "Connecting..." : status}</span>
    </span>
  );
};
