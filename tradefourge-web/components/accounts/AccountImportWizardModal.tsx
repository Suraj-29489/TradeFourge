"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Radio,
  Server,
  Layers,
  Wallet,
  ArrowRight,
  X,
  Loader2,
  ShieldCheck,
  Check,
  RotateCw,
} from "lucide-react";
import type { DiscoveredAccount } from "@/lib/companion/protocol";
import type { TradingAccount } from "@/types/database";

interface ImportProgress {
  current: number;
  total: number;
  currentAccountName: string;
  stage: string;
  percentage: number;
}

interface AccountImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredAccounts: DiscoveredAccount[];
  existingAccounts: TradingAccount[];
  isDiscovering: boolean;
  discoveryError: string | null;
  onRunDiscovery: () => Promise<any>;
  onImportSelected: (selectedAccounts: DiscoveredAccount[]) => Promise<void>;
}

export const AccountImportWizardModal: React.FC<AccountImportWizardModalProps> = ({
  isOpen,
  onClose,
  discoveredAccounts,
  existingAccounts,
  isDiscovering,
  discoveryError,
  onRunDiscovery,
  onImportSelected,
}) => {
  const [selectedAccNumbers, setSelectedAccNumbers] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Set of existing account numbers for duplicate detection
  const existingAccNumbers = new Set(
    existingAccounts.map((a) => String(a.account_number || a.display_id).replace(/\D/g, ""))
  );

  // Initialize selected accounts when discovered accounts update
  useEffect(() => {
    if (discoveredAccounts.length > 0) {
      const initial = new Set<string>();
      discoveredAccounts.forEach((acc) => {
        const cleanNum = String(acc.account_number).replace(/\D/g, "");
        // Pre-select new unimported accounts by default
        if (!existingAccNumbers.has(cleanNum)) {
          initial.add(cleanNum);
        }
      });
      setSelectedAccNumbers(initial);
    }
  }, [discoveredAccounts]);

  if (!isOpen) return null;

  const toggleAccountSelection = (accNum: string) => {
    const cleanNum = String(accNum).replace(/\D/g, "");
    if (existingAccNumbers.has(cleanNum)) return; // Already imported

    setSelectedAccNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(cleanNum)) {
        next.delete(cleanNum);
      } else {
        next.add(cleanNum);
      }
      return next;
    });
  };

  const selectAllNew = () => {
    const next = new Set<string>();
    discoveredAccounts.forEach((acc) => {
      const cleanNum = String(acc.account_number).replace(/\D/g, "");
      if (!existingAccNumbers.has(cleanNum)) {
        next.add(cleanNum);
      }
    });
    setSelectedAccNumbers(next);
  };

  const deselectAll = () => {
    setSelectedAccNumbers(new Set());
  };

  const handleStartImport = async () => {
    const selectedList = discoveredAccounts.filter((acc) =>
      selectedAccNumbers.has(String(acc.account_number).replace(/\D/g, ""))
    );

    if (selectedList.length === 0) return;

    setIsImporting(true);
    setImportedCount(selectedList.length);

    try {
      // Simulate/Report real step-by-step progress per selected account
      for (let i = 0; i < selectedList.length; i++) {
        const acc = selectedList[i];
        const accName = acc.account_name || `Exness ${acc.account_type || "Account"} #${acc.account_number}`;

        setImportProgress({
          current: i + 1,
          total: selectedList.length,
          currentAccountName: accName,
          stage: "Writing account record to canonical store...",
          percentage: Math.round(((i + 0.3) / selectedList.length) * 100),
        });

        await new Promise((r) => setTimeout(r, 400));

        setImportProgress({
          current: i + 1,
          total: selectedList.length,
          currentAccountName: accName,
          stage: "Fetching historical trades from Exness terminal...",
          percentage: Math.round(((i + 0.7) / selectedList.length) * 100),
        });

        await new Promise((r) => setTimeout(r, 400));
      }

      await onImportSelected(selectedList);

      setImportProgress({
        current: selectedList.length,
        total: selectedList.length,
        currentAccountName: "All accounts",
        stage: "Updating Journal, Calendar, Analytics & Dashboard...",
        percentage: 100,
      });

      await new Promise((r) => setTimeout(r, 300));

      setIsComplete(true);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setIsImporting(false);
    }
  };

  const newAccountsCount = discoveredAccounts.filter(
    (a) => !existingAccNumbers.has(String(a.account_number).replace(/\D/g, ""))
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity" />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-[#0B0F17] border border-white/10 shadow-2xl overflow-hidden font-mono text-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
                <span>Exness Account Discovery Wizard</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                  Manifest V3 Live
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-sans mt-0.5">
                Scan, discover, and select Exness accounts to integrate with TradeForge.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* State 1: Discovery Scanning Animation */}
          {isDiscovering && (
            <div className="p-12 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-blue-500/40 animate-spin border-t-blue-500" />
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/50 text-blue-400 flex items-center justify-center">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white font-sans">Scanning Connected Exness Environment...</h3>
                <p className="text-xs text-gray-400 font-sans leading-relaxed">
                  Reading active account numbers, servers, raw account types, leverage, and balances from your logged-in Exness session.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-gray-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Intercepting Exness Personal Area DOM & State...</span>
              </div>
            </div>
          )}

          {/* State 2: Discovery Error Banner */}
          {!isDiscovering && discoveryError && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3 font-sans">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <strong className="text-white font-bold block text-sm">Exness Tab Not Reachable</strong>
                  <p className="leading-relaxed text-xs text-amber-200/90">{discoveryError}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-amber-500/20">
                <button
                  onClick={onRunDiscovery}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-2 hover:bg-amber-400 transition-colors shadow-sm font-mono"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry Discovery</span>
                </button>
              </div>
            </div>
          )}

          {/* State 3: Import Progress */}
          {isImporting && importProgress && (
            <div className="p-8 text-center space-y-6 font-sans">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold font-mono border border-blue-500/30">
                  IMPORTING {importProgress.current} OF {importProgress.total}
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">{importProgress.currentAccountName}</h3>
                <p className="text-xs text-gray-400 font-mono">{importProgress.stage}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/[0.05] rounded-full h-3 overflow-hidden border border-white/[0.08]">
                <motion.div
                  className="bg-gradient-to-r from-blue-600 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>

              <div className="text-right text-xs text-gray-400 font-mono">{importProgress.percentage}% Complete</div>
            </div>
          )}

          {/* State 4: Import Complete Summary */}
          {isComplete && (
            <div className="p-8 text-center space-y-6 font-sans">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">Import Complete!</h3>
                <p className="text-xs text-gray-300 max-w-md mx-auto">
                  Successfully imported {importedCount} Exness account(s). Historical closed trades, Journal metrics, Calendar activity, and Dashboard equity have been updated.
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2 font-mono"
                >
                  <span>Done / View Accounts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* State 5: Discovery Results Grid & Selection UI */}
          {!isDiscovering && !isImporting && !isComplete && !discoveryError && (
            <div className="space-y-5">
              {discoveredAccounts.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-gray-400 flex items-center justify-center mx-auto">
                    <Radio className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 font-sans">
                    <h3 className="text-base font-bold text-white">No Exness Accounts Found</h3>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      Make sure you are logged into my.exness.com in another browser tab, then click &quot;Rescan Accounts&quot;.
                    </p>
                  </div>
                  <button
                    onClick={onRunDiscovery}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-2 font-mono"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rescan Accounts</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary Bar & Select Actions */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.08] flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white font-sans text-sm">
                        Discovered Accounts ({discoveredAccounts.length})
                      </span>
                      <span className="text-[11px] text-gray-400 block font-sans">
                        {newAccountsCount} new account(s) available to add.
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={selectAllNew}
                        className="text-blue-400 hover:text-blue-300 font-bold text-[11px] hover:underline"
                      >
                        Select New
                      </button>
                      <span className="text-gray-600">·</span>
                      <button
                        onClick={deselectAll}
                        className="text-gray-400 hover:text-gray-300 font-medium text-[11px] hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Discovered Account Cards List */}
                  <div className="grid grid-cols-1 gap-3">
                    {discoveredAccounts.map((account) => {
                      const cleanNum = String(account.account_number).replace(/\D/g, "");
                      const isAlreadyImported = existingAccNumbers.has(cleanNum);
                      const isSelected = selectedAccNumbers.has(cleanNum);

                      return (
                        <div
                          key={account.id || cleanNum}
                          onClick={() => toggleAccountSelection(cleanNum)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isAlreadyImported
                              ? "bg-white/[0.02] border-white/[0.06] opacity-75 cursor-not-allowed"
                              : isSelected
                              ? "bg-blue-500/10 border-blue-500/60 shadow-md shadow-blue-500/5"
                              : "bg-[#0F141C] border-white/[0.08] hover:border-white/20"
                          }`}
                        >
                          {/* Left Details */}
                          <div className="flex items-start gap-3.5">
                            {/* Custom Checkbox */}
                            <div className="pt-1">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                  isAlreadyImported
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : isSelected
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "bg-white/[0.04] border-white/20"
                                }`}
                              >
                                {(isAlreadyImported || isSelected) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white font-sans text-sm">
                                  Exness {account.account_type || "Standard"}
                                </span>

                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                  {account.platform || "MT5"}
                                </span>

                                {isAlreadyImported && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Already Added</span>
                                  </span>
                                )}
                              </div>

                              {/* Raw Metadata Details Grid */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 pt-0.5">
                                <span>Account No: <strong className="text-white">#{cleanNum}</strong></span>
                                <span>·</span>
                                <span>Server: <strong className="text-gray-200">{account.server || "Server unavailable"}</strong></span>
                                <span>·</span>
                                <span>Leverage: <strong className="text-amber-400">{account.leverage || "Unavailable"}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Right Balance & Currency */}
                          <div className="text-right sm:border-l sm:border-white/[0.08] sm:pl-4">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Discovered Balance</div>
                            <div className="text-base font-extrabold text-white font-mono">
                              {account.balance !== undefined && account.balance !== null
                                ? `${account.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${account.currency || "USD"}`
                                : "Balance unavailable"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isDiscovering && !isImporting && !isComplete && (
          <div className="p-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-gray-300 text-xs font-bold transition-all"
            >
              Cancel
            </button>

            {discoveredAccounts.length > 0 && !discoveryError && (
              <button
                onClick={handleStartImport}
                disabled={selectedAccNumbers.size === 0}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all font-mono"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Import Selected ({selectedAccNumbers.size})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
