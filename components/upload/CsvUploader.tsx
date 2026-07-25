"use client";

import React, { useState, useRef } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { validateAndParseCsv } from "@/lib/engine/validator";
import { ParseValidationResult } from "@/lib/engine/types";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export const CsvUploader: React.FC = () => {
  const importCsvText  = useJournalStore(s => s.importCsvText);
  const warningMessage = useJournalStore(s => s.warningMessage);
  const clearAll       = useJournalStore(s => s.clearAll);

  const router = useRouter();

  const [dragActive, setDragActive]       = useState(false);
  const [file, setFile]                   = useState<File | null>(null);
  const [fileText, setFileText]           = useState<string>("");
  const [parseResult, setParseResult]     = useState<ParseValidationResult | null>(null);
  const [isImporting, setIsImporting]     = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [notification, setNotification]   = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setNotification({ type: "error", message: "Invalid file format. Please select a valid CSV file." });
      return;
    }

    setFile(selectedFile);
    setNotification(null);
    setDuplicateCount(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileText(text);

      const res = validateAndParseCsv(text, selectedFile.name.replace(/\.[^.]+$/, ""));
      setParseResult(res);

      if (!res.success) {
        setNotification({ type: "error", message: res.errors.join("; ") || "CSV parsing failed." });
      } else if (res.isCentAccount) {
        setNotification({
          type: "warning",
          message: `USC Cent account detected — monetary values will be normalized to USD (÷100) on import.`,
        });
      } else if (!res.isMatch) {
        setNotification({ type: "warning", message: res.warningMessage || "CSV parsing mismatch detected." });
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success || !fileText || !file) return;

    setIsImporting(true);
    setImportProgress(10);

    // Animate progress
    const interval = setInterval(() => {
      setImportProgress(prev => (prev < 85 ? prev + 15 : prev));
    }, 120);

    const res = await importCsvText(fileText, file.name);
    clearInterval(interval);
    setImportProgress(100);

    if (res.success) {
      const dupNote = res.duplicatesSkipped > 0 ? ` (${res.duplicatesSkipped} duplicates skipped)` : "";
      setDuplicateCount(res.duplicatesSkipped);
      setNotification({
        type: res.warning ? "warning" : "success",
        message: res.warning
          ? `Imported ${res.count} positions${dupNote}. Note: ${res.warning}`
          : `Successfully imported ${res.count} positions${dupNote}!`,
      });
      setTimeout(() => router.push("/"), 800);
    } else {
      setIsImporting(false);
      setImportProgress(0);
      setNotification({ type: "error", message: res.warning || "Import failed." });
    }
  };

  const resetUpload = () => {
    setFile(null); setFileText(""); setParseResult(null);
    setIsImporting(false); setImportProgress(0); setNotification(null); setDuplicateCount(0);
  };

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Upload TradeFourge CSV
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-600/20 text-brand-400 border border-brand-500/30">
              v1.2
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Each CSV creates an independent journal. Duplicate trades are auto-detected and skipped.
          </p>
        </div>
        <div className="p-3 rounded-xl bg-dark-card border border-dark-border hidden sm:flex items-center gap-2 text-xs font-mono text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Duplicate Detection + USC Normalization</span>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {(notification || warningMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
              notification?.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : notification?.type === "warning" || warningMessage
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification?.type === "success"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                : notification?.type === "warning" || warningMessage
                ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              }
              <span>{notification?.message || warningMessage}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:text-white flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone */}
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-12 md:p-16 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-300 glass-card flex flex-col items-center justify-center gap-4 ${
            dragActive
              ? "border-brand-500 bg-brand-500/10 shadow-glow scale-[1.01]"
              : "border-dark-border hover:border-brand-500/40 hover:bg-dark-hover/40"
          }`}
        >
          <input type="file" ref={fileInputRef} accept=".csv" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" />
          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-glow">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              Drop your CSV file here or <span className="text-brand-400 underline">browse</span>
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Exness MT5 / MT4 position history export. Each file creates a separate, independent journal.
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-mono text-gray-600">
            <span>✓ USC Cent normalization (÷100)</span>
            <span>✓ Duplicate detection</span>
            <span>✓ IndexedDB storage</span>
          </div>
        </div>
      ) : (
        /* Preview & Confirmation Screen */
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
          {/* File header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-card border border-dark-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-mono">{file.name}</h4>
                <span className="text-xs text-gray-400 font-mono">
                  {(file.size / 1024).toFixed(1)} KB · {parseResult?.trades.length ?? 0} trades parsed
                  {parseResult?.isCentAccount && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                      USC CENT ÷100
                    </span>
                  )}
                </span>
              </div>
            </div>
            <button onClick={resetUpload} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Parse validation summary */}
          {parseResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                <div className="text-gray-500 mb-1">Broker</div>
                <div className="text-white font-bold">{parseResult.broker}</div>
              </div>
              <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                <div className="text-gray-500 mb-1">Account Type</div>
                <div className="text-white font-bold">{parseResult.accountType}</div>
              </div>
              <div className="p-3 rounded-xl bg-dark-card border border-dark-border">
                <div className="text-gray-500 mb-1">Trades</div>
                <div className="text-emerald-400 font-bold">{parseResult.trades.length}</div>
              </div>
              <div className={`p-3 rounded-xl border ${parseResult.isMatch ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                <div className="text-gray-500 mb-1">Audit</div>
                <div className={`font-bold ${parseResult.isMatch ? "text-emerald-400" : "text-amber-400"}`}>
                  {parseResult.isMatch ? "✓ Verified" : `Δ ${parseResult.delta}`}
                </div>
              </div>
            </div>
          )}

          {/* Trade preview table */}
          {parseResult && parseResult.trades.length > 0 && (
            <div className="rounded-xl border border-dark-border overflow-hidden bg-dark-bg/60 max-h-52 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="sticky top-0 bg-dark-card text-gray-400 border-b border-dark-border">
                  <tr>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Dir</th>
                    <th className="py-2.5 px-3">Lots</th>
                    <th className="py-2.5 px-3">Net PnL (USD)</th>
                    <th className="py-2.5 px-3">R:R</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border text-gray-300">
                  {parseResult.trades.slice(0, 10).map((t) => (
                    <tr key={t.ticket} className="hover:bg-dark-hover/30 transition-colors">
                      <td className="py-2 px-3 text-gray-500">{t.ticket}</td>
                      <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                      <td className="py-2 px-3">{t.direction}</td>
                      <td className="py-2 px-3">{t.volume}</td>
                      <td className={`py-2 px-3 font-bold ${t.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ${t.profit.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-brand-300">{t.rr !== null ? `${t.rr}R` : "N/A"}</td>
                      <td className="py-2 px-3">{t.status}</td>
                    </tr>
                  ))}
                  {parseResult.trades.length > 10 && (
                    <tr>
                      <td colSpan={7} className="py-2 px-3 text-center text-gray-600">
                        +{parseResult.trades.length - 10} more trades…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Duplicate detection info */}
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
              <Copy className="w-3.5 h-3.5" />
              {duplicateCount} duplicate trades were detected and skipped
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-gray-300">
                <span>Creating new journal & persisting to IndexedDB…</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-card overflow-hidden">
                <div className="h-full bg-brand-500 shadow-glow transition-all duration-150" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                if (confirm("This will delete ALL journals and trade data. Continue?")) {
                  clearAll();
                }
              }}
              className="text-xs font-mono text-rose-400 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all data
            </button>
            <div className="flex gap-3">
              <button
                onClick={resetUpload}
                disabled={isImporting}
                className="px-4 py-2.5 rounded-xl bg-dark-card border border-dark-border text-xs font-semibold text-gray-300 hover:bg-dark-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!parseResult?.success || isImporting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isImporting ? "Importing…" : "Import as New Journal"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
