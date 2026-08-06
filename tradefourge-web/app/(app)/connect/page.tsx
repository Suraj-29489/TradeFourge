"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Upload,
  Radio,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Server,
  Check,
  Loader2,
  ChevronRight,
  X,
  Database,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useOnboardingStore } from "@/lib/store/useOnboardingStore";
import { useCompanion } from "@/lib/companion/provider";
import { Checkbox } from "@/components/ui/Checkbox";

export default function ConnectionWizardPage() {
  const router = useRouter();
  const { refreshAccounts } = useUserProfile();
  const setCompletedOnboarding = useOnboardingStore((s) => s.setCompletedOnboarding);
  const companion = useCompanion();

  // Wizard Steps: 1: Method Choice, 2: Companion Detection, 3: Account Discovery, 4: Import Progress, 5: Completion
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Selected method choice
  const [selectedMethod, setSelectedMethod] = useState<"companion" | "csv" | "api">("companion");

  // Checking state for manual retry
  const [isChecking, setIsChecking] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Trigger real account discovery when entering Step 3
  const handleProceedToDiscovery = async () => {
    setWizardStep(3);
    setIsDiscovering(true);
    await companion.discoverAccounts();
    setIsDiscovering(false);
  };

  // Trigger real history import when clicking Import Selected Accounts
  const handleStartRealImport = async () => {
    if (companion.selectedAccountIds.length === 0) return;
    setWizardStep(4);
    await companion.importSelectedAccounts(companion.selectedAccountIds);
  };

  // Transition to completion screen when historyStatus becomes "Imported"
  useEffect(() => {
    if (wizardStep === 4 && companion.historyStatus === "Imported") {
      setWizardStep(5);
    }
  }, [wizardStep, companion.historyStatus]);

  // Finish Onboarding and enter Dashboard
  const handleFinishOnboarding = async () => {
    setCompletedOnboarding(true);
    await refreshAccounts();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#090D14] text-white flex flex-col justify-between p-4 sm:p-8 font-mono selection:bg-blue-600 selection:text-white">
      {/* Top Header Navigation Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="inline-block group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_full.png"
              alt="TradeFourge Logo"
              className="h-8 w-auto object-contain mx-auto transition-transform group-hover:scale-105"
            />
          </Link>
          <span className="text-[10px] text-gray-400 font-mono border-l border-white/10 pl-2.5">
            Setup Wizard v2.0
          </span>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 font-mono"
        >
          <span>Cancel Setup</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="max-w-4xl mx-auto w-full my-auto py-8">
        <AnimatePresence mode="wait">
          {/* ── STEP 1: CHOOSE CONNECTION METHOD ────────────────────────────── */}
          {wizardStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 text-center"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                  <Database className="w-7 h-7" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
                  Welcome to TradeFourge
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                  Let's connect your trading data. Choose how you'd like to continue.
                </p>
              </div>

              {/* 3 Connection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
                {/* OPTION 1: TradeFourge Companion (RECOMMENDED) */}
                <div
                  onClick={() => setSelectedMethod("companion")}
                  className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
                    selectedMethod === "companion"
                      ? "bg-[#0F141C] border-blue-500 shadow-xl"
                      : "bg-[#0F141C]/60 border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Recommended
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-sans">TradeFourge Companion</h3>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                        Automatically discovers your Exness accounts. Imports complete history and keeps trades synchronized live with one-click setup.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center text-xs font-bold text-blue-400 gap-1.5">
                    <span>Selected</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                {/* OPTION 2: Import CSV */}
                <div
                  onClick={() => setSelectedMethod("csv")}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-6 ${
                    selectedMethod === "csv"
                      ? "bg-[#0F141C] border-blue-500 shadow-xl"
                      : "bg-[#0F141C]/60 border-white/[0.08] hover:border-white/20"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-sans">CSV Import</h3>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                        Upload exported trading history. Good for manual imports from broker statements anytime.
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-gray-400">Manual Upload</div>
                </div>

                {/* OPTION 3: Broker API (DISABLED - COMING SOON) */}
                <div className="p-6 rounded-2xl bg-[#0F141C]/30 border border-white/[0.04] opacity-50 flex flex-col justify-between space-y-6 cursor-not-allowed">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] text-gray-500 flex items-center justify-center">
                        <Server className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-gray-400 text-[9px] font-bold uppercase border border-white/[0.08]">
                        Coming Soon
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-300 font-sans">Broker API</h3>
                      <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                        Direct REST API integration for MT5, cTrader, and Binance servers.
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-500 font-bold uppercase">Disabled</div>
                </div>
              </div>

              {/* Navigation Action Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-white/[0.08]">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (selectedMethod === "companion") {
                      setWizardStep(2);
                      companion.checkExtension();
                    } else if (selectedMethod === "csv") {
                      router.push("/upload");
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: REAL EXTENSION DETECTION (PHASE 4) ──────────────────── */}
          {wizardStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-8 text-center max-w-lg mx-auto font-mono"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                  {companion.isConnected ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  )}
                </div>
                <h2 className="text-xl font-bold text-white font-sans">TradeFourge Companion Detection</h2>
                <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                  {companion.isConnected
                    ? "TradeFourge Companion Extension detected and verified! Ready to discover trading accounts."
                    : "Waiting for TradeFourge Companion... To continue, install and enable the TradeFourge Companion Extension."}
                </p>
              </div>

              {/* Real Connection Status Banner */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Extension Bridge:</span>
                  <span className={companion.isConnected ? "text-emerald-400 font-bold" : "text-amber-400 font-bold flex items-center gap-1.5"}>
                    {!companion.isConnected && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {companion.isConnected ? "🟢 Extension Connected" : "🟡 Listening for Extension..."}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Target Browser:</span>
                  <span className="text-gray-200 font-bold">{companion.browser}</span>
                </div>
                {companion.isConnected && (
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                    <span className="text-gray-400">Extension Version:</span>
                    <span className="text-blue-400 font-bold">{companion.version}</span>
                  </div>
                )}
              </div>

              {/* Detection Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-bold transition-all"
                >
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setIsChecking(true);
                      await companion.checkExtension();
                      setIsChecking(false);
                    }}
                    disabled={isChecking}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
                    <span>Retry Detection</span>
                  </button>

                  <button
                    onClick={handleProceedToDiscovery}
                    disabled={!companion.isConnected || isDiscovering}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Discover Accounts</span>}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: REAL ACCOUNT DISCOVERY (PHASE 5) ─────────────────────── */}
          {wizardStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-6 sm:p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6 font-mono"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real Exness Account Bridge Active
                  </div>
                  <h2 className="text-xl font-bold text-white font-sans">Discovered Trading Accounts</h2>
                  <p className="text-xs text-gray-400">
                    Accounts read directly from your Exness Companion Extension integration.
                  </p>
                </div>

                <button
                  onClick={async () => {
                    setIsDiscovering(true);
                    await companion.discoverAccounts();
                    setIsDiscovering(false);
                  }}
                  disabled={isDiscovering}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-blue-400 flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiscovering ? "animate-spin" : ""}`} />
                  <span>Refresh Discovery</span>
                </button>
              </div>

              {/* Discovered Account Cards List */}
              {isDiscovering ? (
                <div className="p-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                  <p className="text-xs text-gray-400">Reading Exness accounts from Companion Extension...</p>
                </div>
              ) : companion.discoveredAccounts.length === 0 ? (
                <div className="p-10 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center space-y-4">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-sm font-bold text-white font-sans">No Exness Accounts Discovered</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Please ensure your Exness Web Terminal is logged in, then click Refresh Discovery.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companion.discoveredAccounts.map((acc) => {
                    const isSelected = companion.selectedAccountIds.includes(acc.account_number);

                    return (
                      <div
                        key={acc.account_number}
                        onClick={() => companion.toggleAccountSelection(acc.account_number)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500 text-white shadow-lg"
                            : "bg-white/[0.02] border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base font-sans">{acc.account_name}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300">
                                {acc.account_type}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 font-mono">Account #{acc.account_number}</div>
                          </div>

                          <Checkbox
                            checked={isSelected}
                            onChange={() => companion.toggleAccountSelection(acc.account_number)}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase">Currency</div>
                            <div className="font-bold text-gray-200">{acc.currency}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase">Balance</div>
                            <div className="font-bold text-white">
                              {acc.currency === "USC"
                                ? `${acc.balance} USC`
                                : `$${acc.balance.toLocaleString()}`}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase">History</div>
                            <div className="font-bold text-blue-400">{acc.history_count} Trades</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                          <span>Server: {acc.server}</span>
                          <span className="text-emerald-400 font-bold">● {acc.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Bar Selection Summary & CTA */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                <div className="text-xs font-mono text-gray-300">
                  Selected{" "}
                  <strong className="text-white font-bold">{companion.selectedAccountIds.length} Accounts</strong>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-bold transition-all"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleStartRealImport}
                    disabled={companion.selectedAccountIds.length === 0}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all disabled:opacity-40"
                  >
                    <span>Import Selected Accounts ({companion.selectedAccountIds.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: REAL HISTORY IMPORT PROGRESS (PHASE 6) ────────────────── */}
          {wizardStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-8 text-center max-w-xl mx-auto font-mono"
            >
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-white font-sans">Synchronizing History via Extension</h2>
                <p className="text-xs text-gray-400">
                  Receiving live history batches directly from TradeFourge Companion.
                </p>
              </div>

              {/* Live Import Progress Bar */}
              <div className="space-y-3 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Import Progress:</span>
                  <span className="text-blue-400 font-bold">{companion.importProgress?.percentage || 0}%</span>
                </div>

                <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${companion.importProgress?.percentage || 5}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>
                    Fetched Position:{" "}
                    <strong className="text-white">
                      {companion.importProgress?.fetchedTrades || 0} / {companion.importProgress?.totalTrades || 4862}
                    </strong>
                  </span>
                  <span className="text-emerald-400 font-bold uppercase">
                    Stage: {companion.importProgress?.stage || "Connecting"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 5: COMPLETION SCREEN (PHASE 7) ─────────────────────────── */}
          {wizardStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="p-8 sm:p-10 rounded-2xl bg-[#0F141C] border border-emerald-500/40 shadow-2xl space-y-8 text-center max-w-xl mx-auto font-mono"
            >
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-white font-sans tracking-tight">You're Ready!</h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  Your Exness trading accounts are synchronized. Realtime event pipeline is active.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-left font-mono text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Accounts Connected</div>
                  <div className="text-lg font-bold text-white">
                    {companion.selectedAccountIds.length} Accounts
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold">✓ Exness Bridge Active</div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Trades Imported</div>
                  <div className="text-lg font-bold text-white">
                    {companion.importProgress?.totalTrades || 4862} Trades
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold">✓ Complete History</div>
                </div>
              </div>

              {/* Go to Dashboard CTA */}
              <div className="pt-4">
                <button
                  onClick={handleFinishOnboarding}
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span>Go To Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Security Banner */}
      <div className="max-w-4xl mx-auto w-full pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-gray-400 font-mono">
        <span>© {new Date().getFullYear()} TradeFourge Platform</span>
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <ShieldCheck className="w-3.5 h-3.5" /> Direct Chrome Extension Bridge
        </span>
      </div>
    </div>
  );
}
