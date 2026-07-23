"use client";

import React from "react";
import { NormalizedTrade } from "@/lib/engine/types";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { format, parseISO } from "date-fns";
import {
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Layers,
  Award,
  Calendar,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TradeDetailDrawerProps {
  trade: NormalizedTrade | null;
  onClose: () => void;
}

export const TradeDetailDrawer: React.FC<TradeDetailDrawerProps> = ({ trade, onClose }) => {
  const { format: formatCurrency } = useCurrencyFormatter();

  if (!trade) return null;

  const isWin = trade.status === "WIN";
  const isLoss = trade.status === "LOSS";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Drawer Slide */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative z-10 w-full max-w-lg bg-[#0F1420] border-l border-dark-border h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between"
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-border pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    trade.direction === "LONG"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {trade.direction === "LONG" ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
                    {trade.symbol}
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-dark-card border border-dark-border text-gray-300">
                      {trade.direction}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">Position Ticket: {trade.ticket}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main PnL Card */}
            <div
              className={`p-5 rounded-2xl border ${
                isWin
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isLoss
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-gray-800/40 border-gray-700 text-gray-300"
              }`}
            >
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400 block mb-1">
                Realized Net Profit
              </span>
              <div className="text-3xl font-extrabold font-mono tracking-tight flex items-baseline gap-2">
                <span>
                  {trade.profit >= 0 ? "+" : ""}
                  {formatCurrency(trade.profit)}
                </span>
                <span className="text-sm font-semibold text-brand-300">
                  {trade.rr !== null ? `(${trade.rr} R)` : "(R:R N/A)"}
                </span>
              </div>
            </div>

            {/* Execution Specifications Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase font-mono tracking-wider">
                Execution Parameters
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">VOLUME (LOTS)</span>
                  <span className="text-white font-bold text-sm">{trade.volume}</span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">RISK : REWARD</span>
                  <span className="text-brand-300 font-bold text-sm">
                    {trade.rr !== null ? `${trade.rr} R` : "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">OPEN ENTRY PRICE</span>
                  <span className="text-white font-bold text-sm">
                    {trade.openPrice !== null ? trade.openPrice : "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">CLOSE EXIT PRICE</span>
                  <span className="text-white font-bold text-sm">{trade.closePrice}</span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">STOP LOSS</span>
                  <span className="text-rose-400 font-bold text-sm">
                    {trade.stopLoss ? trade.stopLoss : "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">TAKE PROFIT</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {trade.takeProfit ? trade.takeProfit : "N/A"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">COMMISSION</span>
                  <span className="text-gray-300 font-bold text-sm">
                    {formatCurrency(trade.commission)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-gray-400 block text-[10px]">SWAP</span>
                  <span className="text-gray-300 font-bold text-sm">
                    {formatCurrency(trade.swap)}
                  </span>
                </div>
              </div>
            </div>

            {/* Date Timestamps */}
            <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-2 text-xs font-mono">
              <div className="flex justify-between text-gray-400">
                <span>Opened:</span>
                <span className="text-white">
                  {trade.openTime ? format(parseISO(trade.openTime), "yyyy-MM-dd HH:mm:ss") : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Closed:</span>
                <span className="text-white">
                  {trade.closeTime ? format(parseISO(trade.closeTime), "yyyy-MM-dd HH:mm:ss") : "N/A"}
                </span>
              </div>
            </div>

            {/* Comment Notes */}
            {trade.comment && (
              <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-1">
                <span className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1">
                  <FileText className="w-3 h-3 text-brand-400" /> Comments & Strategy Tag
                </span>
                <p className="text-xs text-gray-200">{trade.comment}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-dark-border text-center text-xs font-mono text-gray-500">
            Broker: {trade.broker} • Currency: {trade.currency} • Account: {trade.accountType}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
