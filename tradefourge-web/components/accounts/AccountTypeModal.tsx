"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet, Zap, Layers, ArrowRight, Lock, X } from "lucide-react";
import { useActiveAccount } from "@/context/ActiveAccountContext";

interface AccountTypeModalProps {
  open: boolean;
  onSelectCsv?: () => void;
  onSelectTfc?: () => void;
}

export const AccountTypeModal: React.FC<AccountTypeModalProps> = ({ open, onSelectCsv, onSelectTfc }) => {
  const router = useRouter();
  const { selectAccountType, closeAccountTypeModal } = useActiveAccount();

  // Listen for ESC key press to dismiss modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAccountTypeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeAccountTypeModal]);

  if (!open) return null;

  const handleContinueCsv = () => {
    selectAccountType("csv");
    if (onSelectCsv) {
      onSelectCsv();
    } else {
      router.push("/accounts");
    }
  };

  const handleContinueTfc = () => {
    selectAccountType("tfc");
    if (onSelectTfc) {
      onSelectTfc();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAccountTypeModal}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Centered Dark Institutional Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative z-10 w-full max-w-2xl p-6 sm:p-8 rounded-3xl bg-[#0F141C] border border-white/[0.08] shadow-2xl text-white space-y-6"
        >
          {/* Close Button X */}
          <button
            onClick={closeAccountTypeModal}
            className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1.5 text-center sm:text-left border-b border-white/[0.08] pb-5 pr-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
              Select Trading Workspace Mode
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 font-sans">
              Choose how you want to interact with your trading accounts.
            </p>
          </div>

          {/* Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            {/* 1. CSV Journal */}
            <div
              onClick={handleContinueCsv}
              className="relative p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all cursor-pointer flex flex-col justify-between space-y-5 shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold text-[10px] uppercase tracking-wider">
                    CSV MODE
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white font-sans">CSV Journal</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed font-sans">
                    Import CSV statement files & analyze historical trades.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueCsv}
                className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all group-hover:gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. TradeForge Companion */}
            <div
              onClick={handleContinueTfc}
              className="relative p-5 rounded-2xl border-2 border-blue-600 bg-blue-500/10 hover:bg-blue-500/15 transition-all cursor-pointer flex flex-col justify-between space-y-5 shadow-lg shadow-blue-600/10 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                    <Zap className="w-5 h-5 fill-white" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold text-[10px] uppercase tracking-wider">
                    LIVE TFC
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white font-sans">TradeForge Companion</h3>
                  <p className="text-xs text-blue-200/80 mt-1 leading-relaxed font-sans">
                    Discovered account manager & live synchronization workspace.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueTfc}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all group-hover:gap-2 shadow-sm"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. MetaTrader 5 Direct (DISABLED) */}
            <div className="relative p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] opacity-40 cursor-not-allowed flex flex-col justify-between space-y-5 select-none">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] text-gray-500 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-400 font-bold text-[9px] uppercase tracking-wider">
                    COMING SOON
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 font-sans">MT5 Direct API</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed font-sans">
                    Direct server-side API bridge for MetaTrader 5 terminals.
                  </p>
                </div>
              </div>

              <div className="py-2.5 px-3 rounded-xl bg-white/[0.04] text-gray-500 font-semibold text-xs text-center flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Disabled</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
