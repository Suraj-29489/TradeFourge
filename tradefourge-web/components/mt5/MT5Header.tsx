"use client";

import React from "react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5StatusBadge } from "./MT5StatusBadge";
import { RefreshCw, Layers, ChevronDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface MT5HeaderProps {
  title?: string;
  subtitle?: string;
}

export const MT5Header: React.FC<MT5HeaderProps> = ({
  title = "MT5 COMPANION",
  subtitle = "MetaTrader 5 Account Monitor & Companion Workspace",
}) => {
  const {
    accounts,
    selectedAccountId,
    selectedAccount,
    connectionStatus,
    selectAccount,
    refreshAccount,
    isRefreshing,
    lastUpdatedText,
  } = useMT5Companion();

  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      className={`p-4 sm:p-6 rounded-2xl border transition-colors shadow-sm ${
        isLight
          ? "bg-white border-slate-200 text-slate-900"
          : "bg-[#0F141C] border-white/[0.08] text-white"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Branding & Page Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-extrabold tracking-widest text-slate-500 dark:text-gray-400 uppercase">
                {title}
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight font-sans">
                {selectedAccount ? `${selectedAccount.accountNumber} • ${selectedAccount.server}` : "No Account Selected"}
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-sans pl-1">
            {subtitle}
          </p>
        </div>

        {/* Right Account Switcher & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Badge */}
          <MT5StatusBadge status={connectionStatus} size="md" />

          {/* Connected Account Selector Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedAccountId}
              onChange={(e) => selectAccount(e.target.value)}
              className={`w-full appearance-none px-3.5 py-2 pr-9 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer outline-none ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100 focus:border-emerald-500"
                  : "bg-white/[0.04] border-white/[0.1] text-gray-200 hover:bg-white/[0.08] focus:border-blue-500"
              }`}
            >
              {accounts.map((acc) => (
                <option
                  key={acc.id}
                  value={acc.id}
                  className={isLight ? "bg-white text-slate-900" : "bg-[#0F141C] text-white"}
                >
                  {acc.accountNumber} • {acc.accountType} ({acc.currency})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refreshAccount()}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
              isRefreshing
                ? "opacity-60 cursor-not-allowed bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10"
                : isLight
                ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                : "bg-white/[0.04] border-white/[0.1] text-gray-200 hover:bg-white/[0.08]"
            }`}
            title="Refresh MT5 Account Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Last Updated Footer Line */}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-400">
        <span>
          Server: <strong className="text-slate-800 dark:text-gray-200">{selectedAccount?.server || "N/A"}</strong>
        </span>
        <span>Last updated: {lastUpdatedText}</span>
      </div>
    </div>
  );
};
