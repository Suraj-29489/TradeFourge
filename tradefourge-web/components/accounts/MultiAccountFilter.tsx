"use client";
// components/accounts/MultiAccountFilter.tsx
// Production Multi-Select Account Filter Component for Institutional Portfolio Filtering.

import React, { useState, useRef, useEffect } from "react";
import { Wallet, ChevronDown, Check, Layers, Filter } from "lucide-react";
import { getCurrencyShortLabel, getCurrencySymbol } from "@/lib/config/currencies";
import type { TradingAccount } from "@/types/database";

interface MultiAccountFilterProps {
  accounts: TradingAccount[];
  selectedAccountIds: string[]; // ["ALL"] or array of specific account IDs
  onChange: (selectedIds: string[]) => void;
  className?: string;
}

export const MultiAccountFilter: React.FC<MultiAccountFilterProps> = ({
  accounts,
  selectedAccountIds,
  onChange,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllSelected =
    selectedAccountIds.length === 0 ||
    selectedAccountIds.includes("ALL") ||
    selectedAccountIds.length === accounts.length;

  const activeAccountIds = isAllSelected
    ? accounts.map((a) => a.id)
    : selectedAccountIds;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]); // Select none
    } else {
      onChange(["ALL"]); // Select all
    }
  };

  const handleToggleAccount = (id: string) => {
    if (isAllSelected) {
      // Currently all selected, deselecting this single one
      const remaining = accounts.map((a) => a.id).filter((aid) => aid !== id);
      onChange(remaining);
    } else if (selectedAccountIds.includes(id)) {
      const remaining = selectedAccountIds.filter((aid) => aid !== id);
      onChange(remaining.length === 0 ? [] : remaining);
    } else {
      const next = [...selectedAccountIds, id];
      if (next.length === accounts.length) {
        onChange(["ALL"]);
      } else {
        onChange(next);
      }
    }
  };

  const getButtonLabel = () => {
    if (accounts.length === 0) return "No Accounts";
    if (isAllSelected) return `All Accounts (${accounts.length})`;
    if (selectedAccountIds.length === 0) return "No Accounts Selected";
    if (selectedAccountIds.length === 1) {
      const acc = accounts.find((a) => a.id === selectedAccountIds[0]);
      return acc ? acc.account_name : "1 Account";
    }
    return `${selectedAccountIds.length} Accounts Selected`;
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0F141C] border border-white/[0.08] hover:border-blue-500/40 text-xs font-mono font-bold text-gray-200 transition-all active:scale-95 shadow-sm"
      >
        <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="truncate max-w-[160px]">{getButtonLabel()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 p-2.5 rounded-2xl dropdown-menu z-50 space-y-1.5 shadow-2xl font-mono text-xs border border-white/[0.08] bg-[#0F141C]/95 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.08]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Filter className="w-3 h-3 text-blue-400" /> Account Portfolio Filter
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold">
              {accounts.length} Total
            </span>
          </div>

          {/* Toggle All Option */}
          <button
            type="button"
            onClick={handleToggleAll}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
              isAllSelected
                ? "bg-blue-600/20 text-white font-bold border border-blue-500/30"
                : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                isAllSelected ? "bg-blue-600 border-blue-500 text-white" : "border-gray-500"
              }`}>
                {isAllSelected && <Check className="w-3 h-3" />}
              </div>
              <span className="font-bold font-sans">Select All Accounts</span>
            </div>
            <Layers className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Individual Accounts List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
            {accounts.map((acc) => {
              const isChecked = isAllSelected || selectedAccountIds.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleToggleAccount(acc.id)}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    isChecked
                      ? "bg-white/[0.06] border-blue-500/30 text-white font-medium"
                      : "bg-white/[0.03] border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isChecked ? "bg-blue-600 border-blue-500 text-white" : "border-gray-600"
                    }`}>
                      {isChecked && <Check className="w-3 h-3" />}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-white truncate font-sans">{acc.account_name}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1.5 font-mono">
                        <span>{acc.broker}</span>
                        <span>•</span>
                        <span className="text-blue-300 font-bold">{getCurrencyShortLabel(acc.currency ?? "USD")}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold shrink-0 font-mono">
                    {getCurrencySymbol(acc.currency ?? "USD")}{(acc.current_balance ?? 0).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
