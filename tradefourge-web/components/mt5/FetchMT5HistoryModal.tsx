"use client";

import React, { useState } from "react";
import { X, Calendar, Check, Loader2 } from "lucide-react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { useTheme } from "@/context/ThemeContext";

interface FetchMT5HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

export const FetchMT5HistoryModal: React.FC<FetchMT5HistoryModalProps> = ({ open, onClose }) => {
  const { fetchHistoricalTrades } = useMT5Companion();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [mode, setMode] = useState<"RANGE" | "ALL">("RANGE");
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate] = useState("2026-08-11");
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  if (!open) return null;

  const handleFetch = async () => {
    setIsFetching(true);
    setProgress(20);

    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + 25));
    }, 250);

    try {
      const res = await fetchHistoricalTrades(fromDate, toDate);
      clearInterval(timer);
      setProgress(100);
      setSuccessMessage(`History fetched successfully (${res.addedCount} trade records loaded).`);
      setTimeout(() => {
        setIsFetching(false);
        setProgress(0);
        setSuccessMessage("");
        onClose();
      }, 1200);
    } catch {
      clearInterval(timer);
      setIsFetching(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className={`relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 font-mono ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 border-b pb-4 border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight font-sans">Fetch Historical Trades</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Retrieve past trade executions directly from your MT5 terminal history.
          </p>
        </div>

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-sans flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        {/* Form Options */}
        <div className="space-y-4 text-xs font-sans">
          <div className="space-y-2">
            <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
              Fetch Range Option
            </label>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <button
                type="button"
                onClick={() => setMode("RANGE")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  mode === "RANGE"
                    ? isLight
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-700"
                      : "bg-blue-500/10 border-blue-500 text-white"
                    : isLight
                    ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-white/[0.02] border-white/[0.08] text-gray-400"
                }`}
              >
                Selected Date Range
              </button>

              <button
                type="button"
                onClick={() => setMode("ALL")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  mode === "ALL"
                    ? isLight
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-700"
                      : "bg-blue-500/10 border-blue-500 text-white"
                    : isLight
                    ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-white/[0.02] border-white/[0.08] text-gray-400"
                }`}
              >
                All Available History
              </button>
            </div>
          </div>

          {mode === "RANGE" && (
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-500 dark:text-gray-400">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                    isLight
                      ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                      : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-500 dark:text-gray-400">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition-all ${
                    isLight
                      ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                      : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
                  }`}
                />
              </div>
            </div>
          )}

          {/* Progress Bar during fetch */}
          {isFetching && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> Fetching history...
                </span>
                <span className="font-bold">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 font-mono">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-white/[0.05] hover:bg-white/[0.1] text-gray-300"
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFetch}
              disabled={isFetching}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${
                isFetching ? "opacity-60 cursor-not-allowed bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-500 shadow-md"
              }`}
            >
              Fetch History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
