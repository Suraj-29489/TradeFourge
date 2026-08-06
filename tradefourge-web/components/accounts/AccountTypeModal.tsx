"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet, Zap, Layers, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import { useActiveAccount } from "@/context/ActiveAccountContext";

interface AccountTypeModalProps {
  open: boolean;
  onSelectCsv?: () => void;
  onSelectTfc?: () => void;
}

export const AccountTypeModal: React.FC<AccountTypeModalProps> = ({ open, onSelectCsv, onSelectTfc }) => {
  const router = useRouter();
  const { selectAccountType } = useActiveAccount();

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
        {/* Backdrop - cannot close by clicking outside */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Centered Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative z-10 w-full max-w-2xl p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl text-slate-900 space-y-6"
        >
          {/* Header */}
          <div className="space-y-1.5 text-center sm:text-left border-b border-slate-100 pb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Create Your Trading Workspace
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Choose how you want to connect your trading account.
            </p>
          </div>

          {/* Account Type Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. CSV Journal */}
            <div
              onClick={handleContinueCsv}
              className="relative p-5 rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex flex-col justify-between space-y-5 shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-semibold text-[10px] uppercase tracking-wider">
                    CSV MODE
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">CSV Journal</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Import CSV files & analyze historical trades with institutional metrics.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueCsv}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all group-hover:gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. TradeForge Companion (NEW TFC WORKSPACE) */}
            <div
              onClick={handleContinueTfc}
              className="relative p-5 rounded-2xl border-2 border-blue-600 bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer flex flex-col justify-between space-y-5 shadow-md group"
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
                  <h3 className="text-sm font-bold text-blue-950">TradeForge Companion</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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

            {/* 3. MetaTrader 5 Direct (DISABLED PLACEHOLDER) */}
            <div className="relative p-5 rounded-2xl border border-slate-200 bg-slate-100/60 opacity-50 cursor-not-allowed flex flex-col justify-between space-y-5 select-none">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-300 text-slate-700 font-bold text-[9px] uppercase tracking-wider">
                    COMING SOON
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700">MT5 Direct API</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Direct server-side API bridge for MetaTrader 5 terminals.
                  </p>
                </div>
              </div>

              <div className="py-2.5 px-3 rounded-xl bg-slate-200/80 text-slate-500 font-semibold text-xs text-center flex items-center justify-center gap-1.5">
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
