"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  Layers,
  FileCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import type { SyncResult } from "@/context/CompanionAccountContext";

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  syncStage?: string;
  result: SyncResult | null;
}

export function SyncDiagnosticsModal({
  isOpen,
  onClose,
  isSyncing,
  syncStage = "Connecting to Exness...",
  result,
}: SyncDiagnosticsModalProps) {
  if (!isOpen) return null;

  const isSuccess = result && !result.error && (result.imported > 0 || result.totalReceived > 0);
  const isZeroRecords = result && result.totalReceived === 0 && !result.error;
  const isError = Boolean(result?.error);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#0B0F17] border border-white/10 shadow-2xl font-mono text-gray-200"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-[#0F141C]">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
                Historical Data Synchronization
              </h2>
            </div>
            {!isSyncing && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6">
            {/* LOADING STATE */}
            {isSyncing && (
              <div className="py-8 space-y-5 text-center">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">Synchronizing Broker Data</h3>
                  <p className="text-xs text-blue-400 font-semibold animate-pulse">{syncStage}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-gray-300">
                  Communicating with active Exness session for target account...
                </div>
              </div>
            )}

            {/* SYNC COMPLETED RESULT STATE */}
            {!isSyncing && result && (
              <div className="space-y-5">
                {/* Status Banner */}
                {isSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400">Data Sync Complete</h3>
                      <p className="text-xs text-gray-300">
                        Historical trade records successfully ingested and normalized into TradeForge store.
                      </p>
                    </div>
                  </div>
                )}

                {isZeroRecords && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-400">0 Historical Records Returned</h3>
                      <p className="text-xs text-gray-300 mt-1">
                        No closed orders were detected on the active Exness page.
                      </p>
                    </div>
                  </div>
                )}

                {isError && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-rose-400">Sync Unsuccessful</h3>
                      <p className="text-xs text-rose-300/90 mt-1">{result.error}</p>
                    </div>
                  </div>
                )}

                {/* Account Details Summary Grid */}
                <div className="p-4 rounded-xl bg-[#0F141C] border border-white/[0.08] space-y-3">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                    Account Target Info
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Account Number</span>
                      <span className="font-bold text-white">#{result.accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Account Type</span>
                      <span className="font-bold text-blue-400">{result.accountType || "Standard Cent"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Current Balance</span>
                      <span className="font-bold text-emerald-400">
                        {result.balance !== null ? `${result.balance} ${result.currency || "USC"}` : "Not detected"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Last Synchronized</span>
                      <span className="font-bold text-gray-300">{result.lastSyncedAt}</span>
                    </div>
                  </div>
                </div>

                {/* Ingestion & Deduplication Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold">
                      <span>Records Received</span>
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <p className="text-lg font-extrabold text-white">{result.totalReceived}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold">
                      <span>Trades Imported</span>
                      <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-lg font-extrabold text-emerald-400">{result.imported}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold">
                      <span>New Trades Added</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <p className="text-lg font-extrabold text-blue-400">{result.newTrades}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold">
                      <span>Duplicates Skipped</span>
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <p className="text-lg font-extrabold text-amber-400">{result.duplicatesSkipped}</p>
                  </div>
                </div>

                {/* Diagnostic Guidelines for 0 Records */}
                {(isZeroRecords || isError) && (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                    <span className="font-bold text-gray-300 block">Diagnostic Checklist:</span>
                    <ul className="space-y-1 text-gray-400 text-[11px] list-disc list-inside">
                      <li>Open Exness Personal Area in another browser tab.</li>
                      <li>Navigate to the <strong className="text-gray-200">"History of orders"</strong> tab for account #{result.accountNumber}.</li>
                      <li>Ensure history date filter is set to <strong className="text-gray-200">"All time"</strong>.</li>
                      <li>Click <strong className="text-blue-400">FETCH DATA</strong> again to re-sync.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {!isSyncing && (
            <div className="p-4 border-t border-white/[0.08] bg-[#0F141C] flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <span>Close</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
