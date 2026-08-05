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
  ShieldCheck,
} from "lucide-react";
import { useConnectionModeStore, ConnectionMode } from "@/lib/store/useConnectionModeStore";

export const ConnectionModeModal: React.FC = () => {
  const router = useRouter();
  const {
    isConnectionHubOpen,
    closeConnectionHub,
    selectedMode,
    setSelectedMode,
  } = useConnectionModeStore();

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-mono text-xs selection:bg-blue-600 selection:text-white">
        {/* Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeConnectionHub}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-4xl p-6 sm:p-8 rounded-3xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
        >
          {/* Close Button */}
          <button
            onClick={closeConnectionHub}
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Copy */}
          <div className="space-y-2 text-center max-w-lg mx-auto pt-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white font-sans tracking-tight">
              Choose how you want to connect your trading account
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
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
                  ? "bg-white/[0.03] border-blue-500 shadow-xl"
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-gray-300 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">CSV Import</h3>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    Import trading history using broker-generated CSV statements.
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-gray-300 pt-2 border-t border-white/[0.06]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Manual Upload</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Historical Analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Offline Import</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Works with multiple brokers</span>
                  </li>
                </ul>
              </div>

              <button className="w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs transition-all flex items-center justify-center gap-2">
                <span>Continue with CSV</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* CARD 2: TRADEFOURGE COMPANION (RECOMMENDED) */}
            <div
              onClick={() => handleSelect("companion")}
              className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
                selectedMode === "companion"
                  ? "bg-[#0F141C] border-blue-500 shadow-2xl"
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Recommended
              </div>

              <div className="space-y-4 pt-1">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Zap className="w-5 h-5 fill-blue-400 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">TradeFourge Companion</h3>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    Automatically sync your trading accounts in real time using the TradeFourge Companion Extension.
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-gray-300 pt-2 border-t border-white/[0.06]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Automatic Account Discovery</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Live Trade Synchronization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Real-time Analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>No Manual CSV Upload</span>
                  </li>
                </ul>
              </div>

              <button className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2">
                <span>Continue with Companion</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* CARD 3: MT5 DIRECT CONNECTION (DISABLED) */}
            <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.04] opacity-40 flex flex-col justify-between space-y-6 cursor-not-allowed">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-gray-500 flex items-center justify-center">
                    <Server className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.05] text-gray-400 text-[9px] font-bold uppercase border border-white/[0.08]">
                    Coming Soon
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-400 font-sans">MT5 Direct Connection</h3>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                    Direct server API connection to MetaTrader 5 terminals.
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-gray-500 pt-2 border-t border-white/[0.04]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    <span>Direct REST API Bridge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    <span>Multi-broker MT5 Servers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    <span>Zero Extension Needed</span>
                  </li>
                </ul>
              </div>

              <button
                disabled
                className="w-full py-3 rounded-xl bg-white/[0.03] text-gray-500 font-bold text-xs cursor-not-allowed text-center"
              >
                Coming Soon
              </button>
            </div>
          </div>

          {/* Footer Security Copy */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-gray-400 font-mono">
            <span>Choose any mode. Switch anytime.</span>
            <span className="flex items-center gap-1 text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit Encrypted Data Isolation
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
