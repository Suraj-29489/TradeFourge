"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Zap,
  Server,
  Sparkles,
  Check,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";
import { useConnectionModeStore, ConnectionMode } from "@/lib/store/useConnectionModeStore";
import { useTheme } from "@/context/ThemeContext";

export const ConnectionModeModal: React.FC = () => {
  const router = useRouter();
  const {
    isConnectionHubOpen,
    closeConnectionHub,
    selectedMode,
    setSelectedMode,
  } = useConnectionModeStore();
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (!isConnectionHubOpen) return null;

  const handleSelect = (mode: ConnectionMode) => {
    if (mode === "mt5") return;
    setSelectedMode(mode);
    closeConnectionHub();

    if (mode === "csv") {
      router.push("/upload");
    } else if (mode === "companion") {
      router.push("/companion-setup");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-mono text-xs selection:bg-emerald-600 selection:text-white">
        {/* Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeConnectionHub}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative z-10 w-full max-w-4xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto scrollbar-thin ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
          }`}
        >
          {/* Close Button */}
          <button
            onClick={closeConnectionHub}
            className={`absolute top-6 right-6 p-2 rounded-xl transition-colors ${
              isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900" : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white"
            }`}
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Copy */}
          <div className="space-y-2 text-center max-w-lg mx-auto pt-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
              isLight ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600" : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
            }`}>
              <Layers className="w-6 h-6" />
            </div>
            <h2 className={`text-xl sm:text-2xl font-extrabold font-sans tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              Choose how you want to connect your trading account
            </h2>
            <p className={`text-xs leading-relaxed ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              You can switch between connection methods anytime from the TradeFourge navbar or sidebar.
            </p>
          </div>

          {/* 3 Large Connection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left pt-2">
            {/* CARD 1: CSV IMPORT */}
            <div
              onClick={() => handleSelect("csv")}
              className={`relative p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
                selectedMode === "csv"
                  ? isLight ? "bg-emerald-500/10 border-2 border-emerald-600 shadow-xl" : "bg-white/[0.03] border-blue-500 shadow-xl"
                  : isLight ? "bg-slate-50 border-slate-200 hover:border-emerald-500/60 hover:bg-slate-100" : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="space-y-4">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                  isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-white/[0.04] border-white/[0.08] text-blue-400"
                }`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold font-sans ${isLight ? "text-slate-900" : "text-white"}`}>CSV Import</h3>
                  <p className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                    Import trading history using broker-generated CSV statements.
                  </p>
                </div>

                <ul className={`space-y-2 text-[11px] pt-2 border-t ${isLight ? "border-slate-200 text-slate-700" : "border-white/[0.06] text-gray-300"}`}>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Manual Upload</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Historical Analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Offline Import</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Works with multiple brokers</span>
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t flex items-center justify-between font-bold text-xs ${
                isLight ? "border-slate-200 text-emerald-700" : "border-white/[0.06] text-blue-400"
              }`}>
                <span>Select CSV Import</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* CARD 2: TRADEFORGE COMPANION */}
            <div
              onClick={() => handleSelect("companion")}
              className={`relative p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
                selectedMode === "companion"
                  ? isLight ? "bg-emerald-500/10 border-2 border-emerald-600 shadow-xl" : "bg-white/[0.03] border-blue-500 shadow-xl"
                  : isLight ? "bg-slate-50 border-slate-200 hover:border-emerald-500/60 hover:bg-slate-100" : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                    isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  }`}>
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[10px] font-bold uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Recommended
                  </span>
                </div>

                <div>
                  <h3 className={`text-base font-bold font-sans ${isLight ? "text-slate-900" : "text-white"}`}>TradeForge Companion</h3>
                  <p className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                    Real-time automated sync using lightweight browser bridge extension.
                  </p>
                </div>

                <ul className={`space-y-2 text-[11px] pt-2 border-t ${isLight ? "border-slate-200 text-slate-700" : "border-white/[0.06] text-gray-300"}`}>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Automated Real-Time Sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>No CSV Upload Required</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Exness Web Terminal Bridge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Zero Password Disclosure</span>
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t flex items-center justify-between font-bold text-xs ${
                isLight ? "border-slate-200 text-emerald-700" : "border-white/[0.06] text-blue-400"
              }`}>
                <span>Connect Companion</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* CARD 3: MT5 DIRECT */}
            <div className={`relative p-6 rounded-2xl border transition-all opacity-50 cursor-not-allowed flex flex-col justify-between space-y-6 ${
              isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-white/[0.01] border-white/[0.06] text-gray-500"
            }`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                    isLight ? "bg-slate-200 border-slate-300 text-slate-600" : "bg-white/[0.04] border-white/[0.08] text-gray-500"
                  }`}>
                    <Server className="w-5 h-5" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isLight ? "bg-slate-200 border-slate-300 text-slate-600" : "bg-white/5 border-white/10 text-gray-400"
                  }`}>
                    COMING SOON
                  </span>
                </div>

                <div>
                  <h3 className={`text-base font-bold font-sans ${isLight ? "text-slate-700" : "text-gray-300"}`}>MT5 Direct</h3>
                  <p className={`text-[11px] mt-1.5 leading-relaxed ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                    Direct broker API connection for real-time MT5 account tracking.
                  </p>
                </div>

                <ul className={`space-y-2 text-[11px] pt-2 border-t ${isLight ? "border-slate-200 text-slate-500" : "border-white/[0.06] text-gray-500"}`}>
                  <li className="flex items-center gap-2">
                    <span>Direct Server Connection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>Multi-broker Support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>Real-Time Execution Logs</span>
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t flex items-center justify-between font-bold text-xs ${
                isLight ? "border-slate-200 text-slate-400" : "border-white/[0.06] text-gray-500"
              }`}>
                <span>Unavailable</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
