"use client";
// components/upload/CsvUploader.tsx
// Production Account-First CSV Import Pipeline with Account Selection & Blocking Overlay

import React, { useState, useRef, useEffect } from "react";
import { validateAndParseCsv } from "@/lib/engine/validator";
import { ParseValidationResult } from "@/lib/engine/types";
import { bulkInsertTrades } from "@/lib/supabase/trades";
import { createImportRecord, updateImportRecord } from "@/lib/supabase/csv-imports";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/context/UserProfileContext";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { createTradingAccount } from "@/lib/supabase/accounts";
import { emitAppEvent } from "@/lib/events/event-bus";
import type { NewCloudTrade, NewTradingAccount } from "@/types/database";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  ListCheck,
  Loader2,
  Check,
  AlertTriangle,
  Wallet,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export interface QueuedFileItem {
  id: string;
  file: File;
  fileText: string;
  parseResult: ParseValidationResult | null;
  status: "queued" | "parsing" | "importing" | "success" | "partial" | "failed";
  progress: number;
  summary: { imported: number; skippedDuplicates: number; failed: number } | null;
  error: string | null;
}

export const CsvUploader: React.FC = () => {
  const router = useRouter();
  const { accounts, defaultAccount, refreshAccounts, addNewAccount } = useUserProfile();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFileItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  // Account creation modal state for zero-account blocking flow
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default selected account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const def = defaultAccount?.id || accounts[0].id;
      setSelectedAccountId(def);
    }
  }, [accounts, defaultAccount, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;

  const handleFilesSelect = async (filesList: FileList | File[]) => {
    if (!selectedAccount) {
      setNotification({ type: "error", message: "Please select a Trading Account before importing." });
      return;
    }

    const validFiles: File[] = [];
    const filesArray = Array.from(filesList);

    for (const f of filesArray) {
      if (f.name.toLowerCase().endsWith(".csv")) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      setNotification({ type: "error", message: "Invalid file format. Please select valid CSV file(s)." });
      return;
    }

    setNotification(null);

    const newItems: QueuedFileItem[] = [];

    for (const f of validFiles) {
      try {
        const text = await f.text();
        const res = validateAndParseCsv(
          text,
          selectedAccount.account_name,
          selectedAccount.currency
        );
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          fileText: text,
          parseResult: res,
          status: res.success ? "queued" : "failed",
          progress: 0,
          summary: null,
          error: res.success ? null : (res.errors.join("; ") || "CSV parsing failed"),
        });
      } catch (err) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          fileText: "",
          parseResult: null,
          status: "failed",
          progress: 0,
          summary: null,
          error: "Failed to read CSV file text.",
        });
      }
    }

    setQueuedFiles(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (!selectedAccount) {
      setNotification({ type: "error", message: "Please select a Trading Account before importing." });
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueuedFiles(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setQueuedFiles([]);
    setNotification(null);
    setIsImporting(false);
  };

  const retryItem = (id: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, status: "queued", error: null, progress: 0 } : item));
  };

  const handleCreateAccountInModal = async (data: NewTradingAccount) => {
    const created = await addNewAccount(data);
    if (created) {
      setSelectedAccountId(created.id);
      setAddAccountModalOpen(false);
    }
  };

  const handleConfirmImportAll = async () => {
    if (!selectedAccount) {
      setNotification({ type: "error", message: "Please select a Trading Account before importing." });
      return;
    }

    const pendingItems = queuedFiles.filter(item => item.status === "queued" || item.status === "failed");
    if (pendingItems.length === 0) return;

    setIsImporting(true);
    setNotification(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let totalImportedAll = 0;

      for (const item of pendingItems) {
        if (!item.parseResult || !item.parseResult.success) continue;

        setQueuedFiles(prev => prev.map(q => q.id === item.id ? { ...q, status: "importing", progress: 25 } : q));

        try {
          // 1. Create import record with account_id
          const { data: importRecord } = await createImportRecord(
            user.id,
            item.file.name,
            item.parseResult.trades.length,
            undefined,
            selectedAccount.id
          );

          setQueuedFiles(prev => prev.map(q => q.id === item.id ? { ...q, progress: 50 } : q));

          // 2. Map trades with mandatory account_id and inherited currency
          const cloudTrades: NewCloudTrade[] = item.parseResult.trades.map(t => ({
            account_id:    selectedAccount.id,
            ticket:        t.ticket,
            symbol:        t.symbol,
            side:          (t.direction === "LONG" ? "BUY" : "SELL") as "BUY" | "SELL",
            volume:        t.volume,
            open_price:    t.openPrice,
            close_price:   t.closePrice,
            stop_loss:     t.stopLoss ?? null,
            take_profit:   t.takeProfit ?? null,
            open_time:     t.openTime,
            close_time:    t.closeTime,
            duration_seconds: t.holdDurationMs ? Math.round(t.holdDurationMs / 1000) : null,
            profit:        t.profit,
            commission:    t.commission,
            swap:          t.swap,
            risk_amount:   null,
            rr_ratio:      t.rr,
            outcome:       t.status as "WIN" | "LOSS" | "BREAKEVEN",
            source:        "csv_import",
            session:       null,
            strategy:      null,
            notes:         t.comment ?? null,
            emotions:      null,
            lessons:       null,
            mistakes:      null,
            magic_number:  null,
            import_id:     importRecord ? importRecord.id : null,
          }));

          // 3. Bulk insert trades
          const { inserted, skippedDuplicates, errors } = await bulkInsertTrades(user.id, cloudTrades);

          setQueuedFiles(prev => prev.map(q => q.id === item.id ? { ...q, progress: 80 } : q));

          const failedCount = Math.max(0, item.parseResult.trades.length - inserted - skippedDuplicates);
          const finalStatus = errors.length > 0 && inserted === 0 ? "failed" : errors.length > 0 ? "partial" : "success";

          // 4. Update import record
          if (importRecord) {
            await updateImportRecord(importRecord.id, user.id, {
              import_status: finalStatus,
              imported_rows: inserted,
              skipped_rows: skippedDuplicates,
              failed_rows: failedCount,
              error_log: errors.length > 0 ? errors : null,
              completed_at: new Date().toISOString(),
            });
          }

          totalImportedAll += inserted;

          // 5. Update item status
          setQueuedFiles(prev => prev.map(q => q.id === item.id ? {
            ...q,
            status: finalStatus,
            progress: 100,
            summary: { imported: inserted, skippedDuplicates, failed: failedCount },
            error: errors.length > 0 ? errors.join("; ") : null,
          } : q));

        } catch (itemErr: unknown) {
          const itemErrMsg = itemErr instanceof Error ? itemErr.message : "File import failed";
          setQueuedFiles(prev => prev.map(q => q.id === item.id ? {
            ...q,
            status: "failed",
            progress: 100,
            error: itemErrMsg,
          } : q));
        }
      }

      setNotification({
        type: "success",
        message: `Import complete for ${selectedAccount.account_name}. ${totalImportedAll} trade(s) successfully added to cloud database.`,
      });

      emitAppEvent("tradefourge:data-changed", { action: "bulkImport" });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setNotification({ type: "error", message: msg });
    } finally {
      setIsImporting(false);
    }
  };

  // ── BLOCKING CASE 1: No accounts exist ────────────────────────────────────
  if (accounts.length === 0) {
    return (
      <div className="space-y-6 font-mono text-xs max-w-4xl mx-auto py-8">
        <div className="p-8 rounded-2xl bg-[#111522] border border-amber-500/30 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Create Your First Trading Account</h2>
            <p className="text-gray-400 text-xs leading-relaxed">
              Every trade must belong to a Trading Account. Please create an account before importing CSV files.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setAddAccountModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all active:scale-95 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Create Account</span>
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs transition-all"
            >
              Cancel
            </button>
          </div>
        </div>

        <AccountFormModal
          open={addAccountModalOpen}
          onClose={() => setAddAccountModalOpen(false)}
          onSubmit={handleCreateAccountInModal}
        />
      </div>
    );
  }

  // ── CASE 2: Accounts exist — Account-First Import Workflow ─────────────────
  const hasQueued = queuedFiles.length > 0;
  const isAllDone = hasQueued && queuedFiles.every(q => q.status === "success" || q.status === "partial" || q.status === "failed");

  return (
    <div className="space-y-6 text-xs font-mono max-w-4xl mx-auto pb-12">
      {/* Notifications */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : notification.type === "warning"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-bold">{notification.message}</div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* STEP 1: CHOOSE TRADING ACCOUNT */}
      <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs">1</span>
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-400" />
              Choose Trading Account
            </h2>
          </div>
          <button
            onClick={() => setAddAccountModalOpen(true)}
            className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Account
          </button>
        </div>

        {/* Account Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {accounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? "bg-purple-600/15 border-purple-500 text-white font-bold shadow-lg"
                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="text-xs font-bold text-white truncate">{acc.account_name}</div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-2">
                    <span>{acc.broker || "Generic"}</span>
                    <span>•</span>
                    <span className="text-purple-300 font-bold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                      {acc.currency}
                    </span>
                  </div>
                </div>
                {isSelected && <Check className="w-5 h-5 text-purple-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: CHOOSE CSV FILES */}
      <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs">2</span>
            <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              Select CSV Statement Files
            </h2>
          </div>
          {selectedAccount && (
            <span className="text-xs text-gray-400">
              Importing into: <strong className="text-purple-300 font-bold">{selectedAccount.account_name} ({selectedAccount.currency})</strong>
            </span>
          )}
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-purple-500 bg-purple-500/10"
              : "border-white/10 hover:border-purple-500/40 bg-white/5 hover:bg-white/10"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv"
            onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-3 border border-purple-500/20">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-white">
            Drag & drop MT4, MT5, cTrader, or brokerage CSV statements
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Supports batch uploading multiple CSV files simultaneously · Exness, FTMO, ICMarkets, etc.
          </p>

          {selectedAccount?.currency === "USC" && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>USC Cent Account detected — monetary values automatically converted to USD (÷100)</span>
            </div>
          )}
        </div>
      </div>

      {/* QUEUED FILES PREVIEW & CONFIRMATION */}
      {hasQueued && (
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-400" />
              Queued Statements ({queuedFiles.length})
            </h3>

            <div className="flex items-center gap-2">
              <button
                onClick={clearQueue}
                disabled={isImporting}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition-colors"
              >
                Clear Queue
              </button>

              {!isAllDone && (
                <button
                  onClick={handleConfirmImportAll}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg active:scale-95"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Import All to {selectedAccount?.account_name}</span>
                </button>
              )}
            </div>
          </div>

          {/* Files List */}
          <div className="space-y-2">
            {queuedFiles.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="font-bold text-white truncate text-xs">{item.file.name}</span>
                    <span className="text-[10px] text-gray-400">({(item.file.size / 1024).toFixed(1)} KB)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                      item.status === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : item.status === "failed"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        : item.status === "importing"
                        ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                        : "bg-gray-500/10 border-gray-500/30 text-gray-400"
                    }`}>
                      {item.status}
                    </span>

                    <button
                      onClick={() => removeFromQueue(item.id)}
                      disabled={isImporting}
                      className="text-gray-400 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {item.status === "importing" && (
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                  </div>
                )}

                {/* Summary Details */}
                {item.summary && (
                  <div className="text-[10px] text-gray-300 flex items-center gap-3 pt-1">
                    <span className="text-emerald-400 font-bold">{item.summary.imported} imported</span>
                    <span>•</span>
                    <span className="text-amber-400">{item.summary.skippedDuplicates} duplicate skipped</span>
                    {item.summary.failed > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-rose-400 font-bold">{item.summary.failed} failed</span>
                      </>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {item.error && (
                  <div className="text-[10px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center justify-between">
                    <span>{item.error}</span>
                    <button onClick={() => retryItem(item.id)} className="underline text-rose-300 hover:text-white font-bold ml-2">
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      <AccountFormModal
        open={addAccountModalOpen}
        onClose={() => setAddAccountModalOpen(false)}
        onSubmit={handleCreateAccountInModal}
      />
    </div>
  );
};
