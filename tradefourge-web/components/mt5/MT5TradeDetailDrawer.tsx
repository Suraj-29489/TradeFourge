"use client";

import React from "react";
import { MT5Trade, MT5Account } from "@/types/mt5";
import { X, ArrowUpRight, ArrowDownRight, Hash, Clock, Shield, Target, Tag } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTheme } from "@/context/ThemeContext";

interface MT5TradeDetailDrawerProps {
  trade: MT5Trade | null;
  account?: MT5Account | null;
  onClose: () => void;
}

export const MT5TradeDetailDrawer: React.FC<MT5TradeDetailDrawerProps> = ({ trade, account, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (!trade) return null;

  const isBuy = trade.side === "BUY";
  const isProfit = trade.profit >= 0;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "-";
    try {
      return format(parseISO(iso), "dd MMM yyyy, HH:mm:ss");
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen max-w-md border-l shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between font-mono ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
          }`}
        >
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span
                  className={`p-2 rounded-xl flex items-center justify-center font-bold ${
                    isBuy
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                  }`}
                >
                  {isBuy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-sans">{trade.symbol}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isBuy ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      }`}
                    >
                      {trade.side}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Ticket #{trade.ticket}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profit Card */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                isProfit
                  ? isLight
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isLight
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              <div>
                <span className="text-xs text-slate-500 dark:text-gray-400 font-sans block">Net Profit / Loss</span>
                <span className="text-2xl font-extrabold font-mono">
                  {isProfit ? "+" : ""}${trade.profit.toFixed(2)}
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  trade.status === "OPEN" ? "bg-amber-500/20 text-amber-600 dark:text-amber-300" : "bg-slate-500/20 text-slate-700 dark:text-gray-300"
                }`}
              >
                {trade.status}
              </span>
            </div>

            {/* Execution Details List */}
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                  <Tag className="w-3.5 h-3.5" /> Order ID:
                </span>
                <strong className="font-mono">{trade.orderId}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                  <Hash className="w-3.5 h-3.5" /> Volume (Lots):
                </span>
                <strong className="font-mono">{trade.volume} Lot</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-sans">Open Price:</span>
                <strong className="font-mono">{trade.openPrice}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-sans">Close Price:</span>
                <strong className="font-mono">{trade.closePrice ?? "Active"}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                  <Shield className="w-3.5 h-3.5 text-rose-400" /> Stop Loss:
                </span>
                <strong className="font-mono text-rose-500">{trade.stopLoss ?? "-"}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                  <Target className="w-3.5 h-3.5 text-emerald-400" /> Take Profit:
                </span>
                <strong className="font-mono text-emerald-500">{trade.takeProfit ?? "-"}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-sans">Commission:</span>
                <strong className="font-mono">${trade.commission.toFixed(2)}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-sans">Swap:</span>
                <strong className="font-mono">${trade.swap.toFixed(2)}</strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                  <Clock className="w-3.5 h-3.5" /> Open Time:
                </span>
                <strong className="font-mono text-[11px]">{formatDateTime(trade.openTime)}</strong>
              </div>

              {trade.closeTime && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 font-sans">
                    <Clock className="w-3.5 h-3.5" /> Close Time:
                  </span>
                  <strong className="font-mono text-[11px]">{formatDateTime(trade.closeTime)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Account Context Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] text-xs font-mono space-y-1 text-slate-500 dark:text-gray-400">
            <div>
              Account Number: <strong className="text-slate-900 dark:text-white">{trade.accountNumber}</strong>
            </div>
            <div>
              Server: <strong className="text-slate-900 dark:text-white">{account?.server || "Exness-MT5"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
