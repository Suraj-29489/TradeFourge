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
  History,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export const CsvUploader: React.FC = () => {
  const importCsvText = useJournalStore((state) => state.importCsvText);
  const history = useJournalStore((state) => state.history);
  const clearJournal = useJournalStore((state) => state.clearJournal);
  const warningMessage = useJournalStore((state) => state.warningMessage);

  const router = useRouter();

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setNotification({ type: "error", message: "Invalid file format. Please select a valid CSV file." });
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileText(text);

      const res = validateAndParseCsv(text, "Primary Account");
      setParseResult(res);

      if (!res.success) {
        setNotification({ type: "error", message: res.errors.join("; ") || "CSV parsing failed." });
      } else if (!res.isMatch) {
        setNotification({ type: "warning", message: res.warningMessage || "CSV parsing mismatch detected." });
      } else {
        setNotification(null);
      }
    };
    reader.readAsText(selectedFile);
  };


  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success || !fileText || !file) return;

    setIsImporting(true);
    setImportProgress(0);

    const interval = setInterval(async () => {
      setImportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          importCsvText(fileText, file.name).then((res) => {
            if (res.success) {
              setNotification({
                type: res.warning ? "warning" : "success",
                message: res.warning
                  ? `Imported ${res.count} positions with warning: ${res.warning}`
                  : `Successfully imported ${res.count} normalized position records!`,
              });

              setTimeout(() => {
                router.push("/");
              }, 600);
            }
          });
          return 100;
        }
        return prev + 25;
      });
    }, 120);
  };

  const resetUpload = () => {
    setFile(null);
    setFileText("");
    setParseResult(null);
    setIsImporting(false);
    setImportProgress(0);
    setNotification(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title Card */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Upload & Normalize Trading Journal CSV
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-600/20 text-brand-400 border border-brand-500/30">
              STRICT NORMALIZATION ENGINE
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Dynamic broker detection (Exness, MT5, TradeLocker, TradeZella) with total profit validation
          </p>
        </div>

        <div className="p-3 rounded-xl bg-dark-card border border-dark-border hidden sm:flex items-center gap-2 text-xs font-mono text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>IndexedDB Persistence</span>
        </div>
      </div>

      {/* Notifications Banner */}
      <AnimatePresence>
        {(notification || warningMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
              (notification?.type || (warningMessage ? "warning" : "info")) === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : (notification?.type || (warningMessage ? "warning" : "info")) === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification?.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : notification?.type === "warning" || warningMessage ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{notification?.message || warningMessage}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag and Drop Zone */}
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-12 md:p-16 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-300 glass-card flex flex-col items-center justify-center gap-4 ${
            dragActive
              ? "border-brand-500 bg-brand-500/10 shadow-glow scale-[1.01]"
              : "border-dark-border hover:border-brand-500/40 hover:bg-dark-hover/40"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-glow">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              Drop your CSV file here or <span className="text-brand-400 underline">browse</span>
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Supports Exness, MT5, TradeLocker & TradeZella exports. Dynamic column header mapping.
            </p>
          </div>
        </div>
      ) : (
        /* Preview & Confirmation Screen */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl glass-card border border-dark-border space-y-6"
        >
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-card border border-dark-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-mono">{file.name}</h4>
                <span className="text-xs text-gray-400 font-mono">
                  {(file.size / 1024).toFixed(1)} KB • Broker: {parseResult?.broker} • Currency: {parseResult?.currency} • Account Type: {parseResult?.accountType}
                </span>
              </div>
            </div>

            <button
              onClick={resetUpload}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Validation & Audit Summary */}
          {parseResult && parseResult.trades.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400 font-semibold uppercase">
                  Normalized Records ({parseResult.trades.length} positions)
                </span>
                <span className={`font-bold ${parseResult.isMatch ? "text-emerald-400" : "text-amber-400"}`}>
                  Audit PnL Match: {parseResult.isMatch ? "VERIFIED EXACT" : `MISMATCH (Delta: ${parseResult.currency} ${parseResult.delta})`}
                </span>
              </div>

              <div className="rounded-xl border border-dark-border overflow-hidden bg-dark-bg/60 max-h-56 overflow-y-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-[#0C1019] text-gray-400 border-b border-dark-border">
                    <tr>
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Lot</th>
                      <th className="py-2.5 px-3">Net PnL</th>
                      <th className="py-2.5 px-3">R:R</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border text-gray-300">
                    {parseResult.trades.slice(0, 8).map((t) => (
                      <tr key={t.ticket}>
                        <td className="py-2 px-3">{t.ticket}</td>
                        <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                        <td className="py-2 px-3">{t.direction}</td>
                        <td className="py-2 px-3">{t.volume}</td>
                        <td className={`py-2 px-3 font-bold ${t.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {parseResult.currency} {t.profit}
                        </td>
                        <td className="py-2 px-3 text-brand-300">
                          {t.rr !== null ? `${t.rr} R` : "N/A"}
                        </td>
                        <td className="py-2 px-3">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Progress Bar */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-gray-300">
                <span>Persisting normalized trades & calculating statistics...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-dark-card overflow-hidden">
                <div
                  className="h-full bg-brand-500 shadow-glow transition-all duration-150"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
              <span>{isImporting ? "Importing..." : "Confirm & Import Trades"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* History of Remembered Uploads */}
      {history.length > 0 && (
        <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              Imported Trading Journals History
            </h3>
            <button
              onClick={() => {
                if (confirm("Clear all imported trading journals from IndexedDB?")) {
                  clearJournal();
                }
              }}
              className="text-xs font-mono text-rose-400 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All Data
            </button>
          </div>

          <div className="rounded-xl border border-dark-border overflow-hidden">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
                <tr>
                  <th className="py-2.5 px-4">Filename</th>
                  <th className="py-2.5 px-4">Upload Date</th>
                  <th className="py-2.5 px-4">Records</th>
                  <th className="py-2.5 px-4">Broker</th>
                  <th className="py-2.5 px-4">Currency</th>
                  <th className="py-2.5 px-4">Account Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-4 font-bold text-white">{item.filename}</td>
                    <td className="py-2.5 px-4 text-gray-400">{new Date(item.uploadDate).toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-emerald-400 font-bold">{item.tradeCount} trades</td>
                    <td className="py-2.5 px-4">{item.broker}</td>
                    <td className="py-2.5 px-4 text-purple-300">{item.currency}</td>
                    <td className="py-2.5 px-4">{item.accountType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
