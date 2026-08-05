"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  FileSpreadsheet,
  Check,
  Loader2,
  ChevronRight,
  Wallet,
  Activity,
  Layers,
  ArrowLeft,
  X,
  Database,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/context/UserProfileContext";
import { useOnboardingStore } from "@/lib/store/useOnboardingStore";
import { useCompanion } from "@/lib/companion/provider";
import { Checkbox } from "@/components/ui/Checkbox";

interface DiscoveredAccountCard {
  id: string;
  account_name: string;
  account_number: string;
  broker: string;
  platform: string;
  currency: string;
  balance: string;
  historyTrades: number;
  server: string;
  type: "Standard" | "Cent" | "Demo" | "Archived";
  status: "Ready" | "Syncing" | "Pending";
  selected: boolean;
}

const INITIAL_DISCOVERED_ACCOUNTS: DiscoveredAccountCard[] = [
  {
    id: "ex-mt5-std",
    account_name: "Standard MT5",
    account_number: "2200009441",
    broker: "Exness",
    platform: "MetaTrader 5",
    currency: "USC",
    balance: "15.32 USC",
    historyTrades: 843,
    server: "Exness-MT5Real6",
    type: "Standard",
    status: "Ready",
    selected: true,
  },
  {
    id: "ex-mt5-cent",
    account_name: "Standard Cent",
    account_number: "8830194002",
    broker: "Exness",
    platform: "MetaTrader 5",
    currency: "USD",
    balance: "$4,500.00",
    historyTrades: 1240,
    server: "Exness-MT5Cent2",
    type: "Cent",
    status: "Ready",
    selected: true,
  },
  {
    id: "ex-mt5-pro",
    account_name: "Pro Scalper",
    account_number: "7749102911",
    broker: "Exness",
    platform: "MetaTrader 5",
    currency: "USD",
    balance: "$12,450.80",
    historyTrades: 2779,
    server: "Exness-MT5Real",
    type: "Standard",
    status: "Ready",
    selected: true,
  },
  {
    id: "ex-mt5-demo",
    account_name: "Demo Test",
    account_number: "1928471004",
    broker: "Exness",
    platform: "MetaTrader 5",
    currency: "USD",
    balance: "$10,000.00",
    historyTrades: 0,
    server: "Exness-MT5Trial",
    type: "Demo",
    status: "Ready",
    selected: false,
  },
];

export default function ConnectionWizardPage() {
  const router = useRouter();
  const { refreshAccounts } = useUserProfile();
  const setCompletedOnboarding = useOnboardingStore((s) => s.setCompletedOnboarding);
  const updateCompanionInfo = useOnboardingStore((s) => s.updateCompanionInfo);
  const companion = useCompanion();

  // Wizard Steps: 1: Method Choice, 2: Companion Waiting, 3: Account Discovery, 4: Import Progress, 5: Completion
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Connection Method choice
  const [selectedMethod, setSelectedMethod] = useState<"companion" | "csv" | "api">("companion");

  // Checking state for manual ping
  const [isChecking, setIsChecking] = useState(false);

  // Account discovery selection list
  const [accounts, setAccounts] = useState<DiscoveredAccountCard[]>(INITIAL_DISCOVERED_ACCOUNTS);

  // Import Progress Index
  const [importStageIndex, setImportStageIndex] = useState(0);

  const importStages = [
    { title: "Connecting", desc: "Establishing secure bridge protocol" },
    { title: "Discovering Accounts", desc: "Found 4 trading accounts" },
    { title: "Fetching History", desc: "Downloading closed positions and orders" },
    { title: "Importing Trades", desc: "Parsing tickets and commissions" },
    { title: "Building Analytics", desc: "Calculating win rates and equity curve" },
    { title: "Realtime Connection", desc: "WebSocket streaming ready" },
  ];

  // Open Companion Step 2 (Honest Waiting screen)
  const startCompanionHandshake = () => {
    setWizardStep(2);
  };

  // Toggle Account selection
  const toggleAccount = (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, selected: !acc.selected } : acc))
    );
  };

  const selectedCount = accounts.filter((a) => a.selected).length;

  // Execute Import Sequence
  const handleStartImportSequence = async () => {
    setWizardStep(4);
    setImportStageIndex(0);

    for (let i = 1; i < importStages.length; i++) {
      await new Promise((res) => setTimeout(res, 900));
      setImportStageIndex(i);
    }

    await new Promise((res) => setTimeout(res, 700));
    updateCompanionInfo({
      status: "connected",
      accountsCount: selectedCount,
      tradesCount: 4862,
    });
    setWizardStep(5); // Completion Screen
  };

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
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white font-sans">
            TRADE<span className="text-blue-400">FOURGE</span>
          </span>
          <span className="text-[10px] text-gray-400 font-mono border-l border-white/10 pl-2.5">
            Setup Wizard
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
              {/* Header Icon + Copy */}
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

                  <div className="text-xs font-medium text-gray-400">
                    Manual Upload
                  </div>
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

                  <div className="text-[10px] text-gray-500 font-bold uppercase">
                    Disabled
                  </div>
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
                      startCompanionHandshake();
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

          {/* ── STEP 2: COMPANION SETUP WIZARD (HONEST WAITING SCREEN) ────────── */}
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
                <h2 className="text-xl font-bold text-white font-sans">TradeFourge Companion</h2>
                <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                  {companion.isConnected
                    ? "Companion Extension verified! Ready to discover trading accounts."
                    : "Waiting for Companion Extension... To continue, install and enable the TradeFourge Companion Extension. The setup wizard will automatically continue once the extension responds."}
                </p>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Runtime Status:</span>
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

              {/* Action Buttons */}
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
                    <span>Check Again</span>
                  </button>

                  {companion.isConnected ? (
                    <button
                      onClick={() => setWizardStep(3)}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      <span>Continue to Accounts</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => companion.toggleMockInstallation()}
                      className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs transition-all"
                    >
                      Simulate Extension Found
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: ACCOUNT DISCOVERY SCREEN ─────────────────────────────── */}
          {wizardStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-6 sm:p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Companion Extension Connected
                  </div>
                  <h2 className="text-xl font-bold text-white font-sans">Discovered Trading Accounts</h2>
                  <p className="text-xs text-gray-400">
                    Select which discovered accounts to include in your centralized database.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center gap-2 shrink-0">
                  <Radio className="w-4 h-4 animate-pulse text-blue-400" />
                  <span>Exness Engine Active</span>
                </div>
              </div>

              {/* Account Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => toggleAccount(acc.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      acc.selected
                        ? "bg-blue-500/10 border-blue-500 text-white shadow-lg"
                        : "bg-white/[0.02] border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base font-sans">{acc.account_name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300">
                            {acc.type}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">Account #{acc.account_number}</div>
                      </div>

                      <Checkbox
                        checked={acc.selected}
                        onChange={() => toggleAccount(acc.id)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase">Currency</div>
                        <div className="font-bold text-gray-200">{acc.currency}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase">Balance</div>
                        <div className="font-bold text-white">{acc.balance}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase">History</div>
                        <div className="font-bold text-blue-400">{acc.historyTrades} Trades</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                      <span>Server: {acc.server}</span>
                      <span className="text-emerald-400 font-bold">● {acc.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Bar Selection Summary & CTA */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                <div className="text-xs font-mono text-gray-300">
                  Selected <strong className="text-white font-bold">{selectedCount} Accounts</strong>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-bold transition-all"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleStartImportSequence}
                    disabled={selectedCount === 0}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all disabled:opacity-40"
                  >
                    <span>Import Selected Accounts ({selectedCount})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: IMPORT PROGRESS EXPERIENCE ──────────────────────────── */}
          {wizardStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-8 text-center max-w-xl mx-auto"
            >
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-white font-sans">Synchronizing Account Data</h2>
                <p className="text-xs text-gray-400">
                  Please wait while TradeFourge builds analytics and synchronizes historical trades.
                </p>
              </div>

              {/* Progress Stepper List */}
              <div className="space-y-3 text-left">
                {importStages.map((stage, idx) => {
                  const isPassed = importStageIndex > idx;
                  const isCurrent = importStageIndex === idx;

                  return (
                    <div
                      key={stage.title}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-xs transition-all ${
                        isPassed
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : isCurrent
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-300 font-bold shadow-sm"
                          : "bg-white/[0.02] border-white/[0.05] text-gray-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isPassed ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-gray-600 flex items-center justify-center shrink-0 text-[10px]">
                            {idx + 1}
                          </div>
                        )}
                        <div>
                          <div className="font-bold">{stage.title}</div>
                          <div className="text-[10px] opacity-80 font-mono">{stage.desc}</div>
                        </div>
                      </div>

                      <div className="text-[10px] uppercase font-bold">
                        {isPassed ? "Complete" : isCurrent ? "Processing" : "Waiting"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 5: COMPLETION SCREEN (PHASE 6) ─────────────────────────── */}
          {wizardStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="p-8 sm:p-10 rounded-2xl bg-[#0F141C] border border-emerald-500/40 shadow-2xl space-y-8 text-center max-w-xl mx-auto"
            >
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-white font-sans tracking-tight">
                  You're Ready!
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  Your trading accounts are connected. All historical trades have been synchronized into your database.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-left font-mono text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Accounts Connected</div>
                  <div className="text-lg font-bold text-white">{selectedCount} Accounts</div>
                  <div className="text-[10px] text-emerald-400 font-bold">✓ Discovery Active</div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Trades Imported</div>
                  <div className="text-lg font-bold text-white">4,862 Trades</div>
                  <div className="text-[10px] text-emerald-400 font-bold">✓ Analytics Built</div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Realtime Bridge</div>
                  <div className="text-base font-bold text-blue-400">WebSocket Live</div>
                  <div className="text-[10px] text-gray-400">Extension v1.2</div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase">Database Status</div>
                  <div className="text-base font-bold text-emerald-400">Dashboard Ready</div>
                  <div className="text-[10px] text-gray-400">Unified Schema</div>
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

      {/* Footer Branding Security Banner */}
      <div className="max-w-4xl mx-auto w-full pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-gray-400 font-mono">
        <span>© {new Date().getFullYear()} TradeFourge Platform</span>
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit Encrypted Client Bridge
        </span>
      </div>
    </div>
  );
}
