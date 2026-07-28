"use client";

import React, { useState, useRef } from "react";
import { validateAndParseCsv } from "@/lib/engine/validator";
import { ParseValidationResult } from "@/lib/engine/types";
import { bulkInsertTrades } from "@/lib/supabase/trades";
import { createImportRecord, updateImportRecord } from "@/lib/supabase/csv-imports";
import { createClient } from "@/lib/supabase/client";
import { emitAppEvent } from "@/lib/events/event-bus";
import type { NewCloudTrade } from "@/types/database";
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

  const [dragActive, setDragActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFileItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = async (filesList: FileList | File[]) => {
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
        const res = validateAndParseCsv(text, f.name.replace(/\.[^.]+$/, ""));
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

  const handleConfirmImportAll = async () => {
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

        // Set status to importing
        setQueuedFiles(prev => prev.map(q => q.id === item.id ? { ...q, status: "importing", progress: 25 } : q));

        try {
          // 1. Create import record
          const { data: importRecord } = await createImportRecord(
            user.id,
            item.file.name,
            item.parseResult.trades.length
          );

          setQueuedFiles(prev => prev.map(q => q.id === item.id ? { ...q, progress: 50 } : q));

          // 2. Map trades with import_id
          const cloudTrades: NewCloudTrade[] = item.parseResult.trades.map(t => ({
            account_id:    null,
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

      // Centralized event dispatch
      emitAppEvent("tradefourge:import-created", { count: totalImportedAll });
      emitAppEvent("tradefourge:trade-created", { count: totalImportedAll });

      setNotification({
        type: "success",
        message: `Queue processed successfully. Total ${totalImportedAll} trade(s) imported.`,
      });

    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Import queue failed — please try again.",
      });
    } finally {
      // 🔒 ALWAYS GUARANTEE LOADING STATE IS CLEARED ON EVERY PATH!
      setIsImporting(false);
    }
  };

  const pendingCount = queuedFiles.filter(item => item.status === "queued" || item.status === "failed").length;

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Title Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Upload TradeFourge CSV Workstation
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
              v3.2.8
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Batch process single or multiple MetaTrader 4, MetaTrader 5, cTrader & TradingView CSV files with sequential queue execution.
          </p>
        </div>
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center gap-2 text-xs text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Multi-CSV Queue + Duplication Guard</span>
        </div>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-xl border flex items-center justify-between ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : notification.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : notification.type === "warning"
                ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              }
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:text-white shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-10 md:p-12 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-300 glass-card flex flex-col items-center justify-center gap-4 ${
          dragActive
            ? "border-purple-500 bg-purple-500/10 shadow-glow scale-[1.01]"
            : "border-dark-border hover:border-purple-500/40 hover:bg-dark-hover/40"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".csv"
          onChange={e => e.target.files && handleFilesSelect(e.target.files)}
          className="hidden"
        />
        <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-glow">
          <Upload className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">
            Drop CSV file(s) here or <span className="text-purple-400 underline">browse computer</span>
          </h3>
          <p className="text-xs text-gray-400 max-w-md">
            Select one or multiple CSV files to queue for sequential processing. Exness, MetaTrader, cTrader, and TradingView files are supported.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-500 pt-1">
          <span>✓ Multi-file selection</span>
          <span>✓ Independent import tracking</span>
          <span>✓ Automatic duplicate skipping</span>
        </div>
      </div>

      {/* Queue Workstation List */}
      {queuedFiles.length > 0 && (
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <ListCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Import Queue ({queuedFiles.length} File{queuedFiles.length > 1 ? "s" : ""})
                </h3>
                <span className="text-[11px] text-gray-400">
                  {pendingCount} file(s) ready for import
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearQueue}
                disabled={isImporting}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold hover:text-white transition-all disabled:opacity-50"
              >
                Clear Queue
              </button>
              <button
                onClick={handleConfirmImportAll}
                disabled={isImporting || pendingCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{isImporting ? "Processing Queue..." : `Import ${pendingCount} File(s)`}</span>
              </button>
            </div>
          </div>

          {/* Queue Items Breakdown */}
          <div className="space-y-3">
            {queuedFiles.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.status === "success"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : item.status === "failed"
                    ? "bg-rose-500/5 border-rose-500/20"
                    : item.status === "importing"
                    ? "bg-purple-500/10 border-purple-500/40 shadow-glow"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      item.status === "success" ? "bg-emerald-500/20 text-emerald-400" :
                      item.status === "failed" ? "bg-rose-500/20 text-rose-400" :
                      item.status === "importing" ? "bg-purple-600/20 text-purple-400 animate-pulse" :
                      "bg-white/10 text-gray-300"
                    }`}>
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{item.file.name}</span>
                        <span className="text-[10px] text-gray-400">({(item.file.size / 1024).toFixed(1)} KB)</span>
                        {item.parseResult?.isCentAccount && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                            USC CENT ÷100
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {item.parseResult?.success
                          ? `${item.parseResult.trades.length} trades parsed • Broker: ${item.parseResult.broker}`
                          : item.error || "Parsing failed"}
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {item.status === "importing" && (
                      <span className="text-purple-400 font-bold flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {item.progress}%
                      </span>
                    )}

                    {item.status === "success" && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Imported ({item.summary?.imported} trades)
                      </span>
                    )}

                    {item.status === "failed" && (
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400 font-bold">Failed</span>
                        <button
                          onClick={() => retryItem(item.id)}
                          disabled={isImporting}
                          className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-[10px] flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => removeFromQueue(item.id)}
                      disabled={isImporting}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Individual item progress bar */}
                {item.status === "importing" && (
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-3">
                    <div className="h-full bg-purple-500 shadow-glow transition-all duration-200" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
