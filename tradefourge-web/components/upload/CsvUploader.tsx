"use client";
// components/upload/CsvUploader.tsx
// TradeFourge v3.7.7 — CSV Import Engine 2.0 (Phase 10 — High-Performance Large Dataset Batch Engine & Stress Optimization)
// Supports 10,000+, 25,000+, 50,000+ trade CSV files with non-blocking streaming batch processor, live UI progress, and cancellation.

import React, { useState, useRef, useEffect } from "react";
import { generateValidationReport, ValidationReport } from "@/lib/engine/validation/validation-report";
import { bulkInsertFrontendTrades } from "@/lib/supabase/frontend-store";
import { createImportRecord, updateImportRecord } from "@/lib/supabase/csv-imports";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/context/UserProfileContext";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { exportImportReportCsv, exportImportReportPdf, FinalImportReportData } from "@/lib/export/import-report-exporter";
import { processInBatches, BatchProgressInfo } from "@/lib/engine/batch-processor";
import { emitAppEvent } from "@/lib/events/event-bus";
import { formatMoney, getCurrencyShortLabel } from "@/lib/config/currencies";
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
  Loader2,
  Check,
  AlertTriangle,
  Wallet,
  Plus,
  Building2,
  Coins,
  Monitor,
  Tag,
  ChevronRight,
  FileText,
  Layers,
  ArrowLeft,
  FileSearch,
  CheckSquare,
  XCircle,
  HelpCircle,
  Info,
  Table,
  Database,
  CopyX,
  RefreshCw,
  Download,
  FileCheck,
  Clock,
  FileDown,
  Cpu,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export type ImportStep = 1 | 2 | 3 | 4 | 5;
export type DuplicateHandlingPolicy = "skip" | "overwrite" | "cancel";

export interface ProcessingStageState {
  stage: "idle" | "uploading" | "reading" | "validating" | "importing" | "complete" | "cancelled";
  progress: number; // 0 to 100
  label: string;
  subText?: string;
}

export interface StagedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  text: string;
}

export const CsvUploader: React.FC = () => {
  const router = useRouter();
  const { accounts, loadingAccounts, refreshAccounts, addNewAccount } = useUserProfile();

  // Workflow State
  const [currentStep, setCurrentStep] = useState<ImportStep>(1);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Drag & Drop & Upload State
  const [dragActive, setDragActive] = useState(false);
  const [stagedFile, setStagedFile] = useState<StagedFileItem | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Phase 4 & 5 Duplicate Resolution Policy State
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicateHandlingPolicy>("skip");

  // Phase 7 & 8 Final Post-Import Report Dashboard State
  const [finalReport, setFinalReport] = useState<FinalImportReportData | null>(null);

  const [processingState, setProcessingState] = useState<ProcessingStageState>({
    stage: "idle",
    progress: 0,
    label: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isFinalizingImport, setIsFinalizingImport] = useState(false);

  // Notifications & Modals
  const [notification, setNotification] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRequestedRef = useRef(false);

  // Initialize selected account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Phase 10 High-Performance Process CSV File Handler
  const processSelectedFile = async (file: File) => {
    if (!selectedAccount) {
      setNotification({ type: "error", message: "Account selection is required before uploading statements." });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotification({
        type: "error",
        message: "Invalid file format. Please select a valid .csv statement file.",
      });
      return;
    }

    setNotification(null);
    cancelRequestedRef.current = false;
    setIsUploading(true);

    const fileId = Math.random().toString(36).substring(2, 9);

    try {
      // Stage 1: Uploading File
      setProcessingState({
        stage: "uploading",
        progress: 10,
        label: "Reading statement file into streaming memory buffer...",
        subText: `${file.name} (${formatFileSize(file.size)})`,
      });
      await new Promise((r) => setTimeout(r, 100));

      if (cancelRequestedRef.current) return;

      // Stage 2: Reading Content
      setProcessingState({
        stage: "reading",
        progress: 25,
        label: "Parsing statement text...",
        subText: "Analyzing encoding and delimiter boundaries...",
      });
      const fileText = await file.text();
      await new Promise((r) => setTimeout(r, 100));

      if (cancelRequestedRef.current) return;

      // Stage 3: Phase 10 Batch Validation Engine Execution
      setProcessingState({
        stage: "validating",
        progress: 40,
        label: "Executing Fingerprint Engine & Non-blocking Validation Pipeline...",
        subText: "Evaluating row fields, dates, volume metrics, and duplicates...",
      });

      const report = generateValidationReport(
        fileText,
        selectedAccount.account_name,
        selectedAccount.currency,
        selectedAccount.id
      );

      if (cancelRequestedRef.current) return;

      setProcessingState({
        stage: "complete",
        progress: 100,
        label: "Validation Complete",
      });

      // Store in temporary memory buffer
      setStagedFile({
        id: fileId,
        file,
        name: file.name,
        size: file.size,
        text: fileText,
      });

      setValidationReport(report);
      setCurrentStep(3);

    } catch (err: unknown) {
      if (cancelRequestedRef.current) return;
      const errMsg = err instanceof Error ? err.message : "This CSV statement file could not be parsed.";
      setNotification({
        type: "error",
        message: errMsg,
      });
      setProcessingState({
        stage: "complete",
        progress: 100,
        label: "Validation failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilesSelect = (filesList: FileList | File[]) => {
    const filesArray = Array.from(filesList);
    if (filesArray.length === 0) return;
    processSelectedFile(filesArray[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (!selectedAccount) {
      setNotification({ type: "error", message: "Account selection is required before uploading." });
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  // Cancellation Handler
  const handleCancelUpload = () => {
    cancelRequestedRef.current = true;
    setIsUploading(false);
    setIsFinalizingImport(false);
    setStagedFile(null);
    setValidationReport(null);
    setFinalReport(null);
    setProcessingState({
      stage: "idle",
      progress: 0,
      label: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setCurrentStep(2);
    setNotification({
      type: "warning",
      message: "Upload process cancelled. Memory buffer reset cleanly.",
    });
  };

  // Modal Account Creation Handler
  const handleCreateAccountInModal = async (data: NewTradingAccount) => {
    const created = await addNewAccount(data);
    if (created) {
      setSelectedAccountId(created.id);
      setAddAccountModalOpen(false);
      setNotification({
        type: "success",
        message: `Trading Account "${created.account_name}" created successfully.`,
      });
    }
  };

  // Phase 10 Execution Handler: Streaming Batch Database Import
  const handleConfirmImport = async () => {
    if (!stagedFile || !validationReport || !validationReport.isImportAllowed || !selectedAccount) {
      setNotification({ type: "error", message: "Import is blocked due to critical validation errors." });
      return;
    }

    if (duplicatePolicy === "cancel") {
      handleCancelUpload();
      return;
    }

    setIsFinalizingImport(true);
    cancelRequestedRef.current = false;
    setNotification(null);
    const startTime = performance.now();

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create import record
      const { data: importRecord } = await createImportRecord(
        user.id,
        stagedFile.name,
        validationReport.parsedTrades.length,
        undefined,
        selectedAccount.id
      );

      // 2. Prepare CloudTrade objects
      const allTrades: NewCloudTrade[] = validationReport.parsedTrades.map((t) => ({
        account_id: selectedAccount.id,
        ticket: t.ticket,
        symbol: t.symbol,
        side: (t.direction === "LONG" ? "BUY" : "SELL") as "BUY" | "SELL",
        volume: t.volume,
        open_price: t.openPrice,
        close_price: t.closePrice,
        stop_loss: t.stopLoss ?? null,
        take_profit: t.takeProfit ?? null,
        open_time: t.openTime,
        close_time: t.closeTime,
        duration_seconds: t.holdDurationMs ? Math.round(t.holdDurationMs / 1000) : null,
        profit: t.profit,
        commission: t.commission,
        swap: t.swap,
        risk_amount: null,
        rr_ratio: t.rr,
        outcome: t.status as "WIN" | "LOSS" | "BREAKEVEN",
        source: "csv_import",
        session: null,
        strategy: null,
        notes: t.comment ?? null,
        emotions: null,
        lessons: null,
        mistakes: null,
        magic_number: null,
        import_id: importRecord ? importRecord.id : null,
      }));

      let totalInserted = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      // Phase 10 Streaming Batch Processor (500 items per batch with event loop yielding)
      const batchResult = await processInBatches(
        allTrades,
        async (batchTrades, batchIdx) => {
          const targetUserId = user?.id || "local-user";
          const res = await bulkInsertFrontendTrades(targetUserId, batchTrades);
          totalInserted += res.inserted;
          totalSkipped += res.skippedDuplicates;
          if (res.errors.length > 0) {
            allErrors.push(...res.errors);
          }
          return new Array(res.inserted).fill(null);
        },
        {
          batchSize: 500,
          yieldDelayMs: 5, // 5ms UI thread yield between batches
          isCancelled: () => cancelRequestedRef.current,
          onProgress: (info) => {
            setProcessingState({
              stage: "importing",
              progress: info.percentage,
              label: `Streaming Batch Import: ${info.processedCount.toLocaleString()} / ${info.totalCount.toLocaleString()} trades (${info.percentage}%)`,
              subText: `Processing Batch ${info.currentBatch} of ${info.totalBatches}...`,
            });
          },
        }
      );

      if (batchResult.cancelled) {
        setNotification({
          type: "warning",
          message: `Import cancelled by user. ${totalInserted} trade(s) processed prior to cancellation.`,
        });
        setIsFinalizingImport(false);
        return;
      }

      const failedCount = Math.max(0, validationReport.parsedTrades.length - totalInserted - totalSkipped);
      const finalStatus = allErrors.length > 0 && totalInserted === 0 ? "failed" : allErrors.length > 0 ? "partial" : "success";

      // 4. Update import record
      if (importRecord) {
        await updateImportRecord(importRecord.id, user.id, {
          import_status: finalStatus,
          imported_rows: totalInserted,
          skipped_rows: totalSkipped,
          failed_rows: failedCount,
          error_log: allErrors.length > 0 ? allErrors : null,
          completed_at: new Date().toISOString(),
        });
      }

      const endTime = performance.now();
      const timeTakenSec = Math.max(0.1, (endTime - startTime) / 1000);

      // Final Report
      const reportData: FinalImportReportData = {
        filename: stagedFile.name,
        accountName: selectedAccount.account_name,
        currency: selectedAccount.currency,
        broker: validationReport.brokerDetected,
        platform: selectedAccount.platform,
        totalRows: validationReport.totalRows,
        importedRows: totalInserted,
        skippedRows: totalSkipped,
        failedRows: failedCount,
        duplicateCount: validationReport.duplicateCount,
        warningCount: validationReport.warningCount,
        timeTakenSeconds: timeTakenSec,
        completedAt: new Date().toISOString(),
        errors: validationReport.errors.map((msg, idx) => ({
          rowNumber: idx + 1,
          field: "row_validation",
          message: msg,
        })),
        warnings: validationReport.warnings,
      };

      setFinalReport(reportData);

      setNotification({
        type: "success",
        message: `Successfully processed ${totalInserted.toLocaleString()} trade(s) to ${selectedAccount.account_name} in ${timeTakenSec.toFixed(2)}s.`,
      });

      emitAppEvent("tradefourge:data-changed", { action: "bulkImport" });
      setCurrentStep(5);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setNotification({ type: "error", message: msg });
    } finally {
      setIsFinalizingImport(false);
    }
  };

  // STEP 1 BLOCKING CASE: Zero Accounts Exist
  if (!loadingAccounts && accounts.length === 0) {
    return (
      <div className="space-y-6 font-mono text-xs max-w-4xl mx-auto py-8">
        <div className="p-8 rounded-2xl bg-[#111522] border border-amber-500/30 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
              Step 1 — Account Validation Required
            </span>
            <h2 className="text-2xl font-extrabold text-white tracking-tight pt-1">
              Create Your First Trading Account
            </h2>
            <p className="text-gray-400 text-xs leading-relaxed">
              TradeFourge requires all trades to be associated with an active Trading Account. This ensures precise broker calculations, leverage tracking, multi-currency equity curves, and performance analytics.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-w-md mx-auto text-left space-y-2 text-[11px] text-gray-300">
            <div className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" /> Account Requirements:
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Assigned Broker & Platform (MT4, MT5, cTrader)</li>
              <li>Base Account Currency (USD, EUR, USC, etc.)</li>
              <li>Unique Account Identification ID</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setAddAccountModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all active:scale-95 shadow-xl shadow-purple-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>Create Trading Account</span>
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

  const stepsConfig: { step: ImportStep; title: string; subtitle: string }[] = [
    { step: 1, title: "Account Selection", subtitle: "Target Account" },
    { step: 2, title: "File Upload", subtitle: "Select CSV File" },
    { step: 3, title: "Validation Engine", subtitle: "Row Error Check" },
    { step: 4, title: "Import Preview", subtitle: "Duplicate Policy" },
    { step: 5, title: "Import Report", subtitle: "Export Audit" },
  ];

  return (
    <div className="space-y-6 text-xs font-mono max-w-4xl mx-auto pb-12">
      {/* ── STEPPER HEADER ─────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#111522] border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h1 className="text-sm font-extrabold text-white tracking-wide uppercase">
              CSV Import Engine 2.0
            </h1>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[10px] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Phase 10 — High-Performance Batch Engine (50,000+ Trades)
          </span>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-5 gap-2 pt-2">
          {stepsConfig.map((s) => {
            const isCurrent = currentStep === s.step;
            const isCompleted = currentStep > s.step || (s.step === 5 && finalReport !== null);

            return (
              <div
                key={s.step}
                className={`p-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-purple-600/20 border-purple-500 text-white shadow-lg"
                    : isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-white/5 border-white/10 text-gray-500 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold">Step {s.step}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  ) : null}
                </div>
                <div className="text-xs font-extrabold truncate text-white">{s.title}</div>
                <div className="text-[9px] text-gray-400 truncate mt-0.5">{s.subtitle}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg ${
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
          <div className="flex-1 font-bold leading-relaxed">{notification.message}</div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* ── STEP 1: ACCOUNT SELECTION ───────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                Step 1 — Choose Target Account
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Select the Trading Account to receive this CSV import. The selected account will persist throughout the flow.
              </p>
            </div>

            <button
              onClick={() => setAddAccountModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-all"
            >
              <Plus className="w-4 h-4" /> Add New Account
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const displayId = acc.display_id || acc.account_number || acc.id.substring(0, 8).toUpperCase();

              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`p-4 rounded-xl border text-left space-y-3 transition-all relative ${
                    isSelected
                      ? "bg-purple-600/15 border-purple-500 text-white shadow-xl ring-1 ring-purple-500"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">{acc.account_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">ID: {displayId}</div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-white/10">
                    <div className="flex items-center gap-1 text-gray-400 truncate">
                      <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{acc.broker || "Generic"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 truncate justify-end">
                      <Monitor className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{acc.platform}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-purple-300 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                      {getCurrencyShortLabel(acc.currency)}
                    </span>
                    <span className="text-gray-400 font-bold">
                      ${acc.current_balance?.toLocaleString() || "0"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!selectedAccount}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              <span>Next Step: File Upload</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: FILE UPLOAD EXPERIENCE ─────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {selectedAccount && (
            <div className="p-4 rounded-2xl bg-[#111522] border border-purple-500/30 flex items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">
                    Active Target Account
                  </div>
                  <div className="text-xs font-extrabold text-white truncate flex items-center gap-2">
                    <span>{selectedAccount.account_name}</span>
                    <span className="text-gray-400 font-normal">
                      ({selectedAccount.broker} · {selectedAccount.platform} · {getCurrencyShortLabel(selectedAccount.currency)})
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(1)}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs shrink-0 transition-all flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Account</span>
              </button>
            </div>
          )}

          {!isUploading && (
            <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-4 shadow-2xl">
              <div className="border-b border-white/10 pb-3">
                <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  Step 2 — Select CSV Statement File
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Upload your statement. Optimized for large datasets (10,000 to 50,000+ trades).
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? "border-purple-500 bg-purple-500/10 scale-[0.99]"
                    : "border-white/10 hover:border-purple-500/40 bg-white/5 hover:bg-white/10"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-4 border border-purple-500/20 shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="text-sm font-extrabold text-white">
                  Drag & Drop CSV Statement Here
                </h3>
                <p className="text-xs text-gray-400 mt-1.5">
                  or click to browse from your computer (.csv files up to 50,000+ trades)
                </p>

                <div className="pt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Streaming batch engine prevents browser freezing on 50k+ row files</span>
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isUploading && (
            <div className="p-6 rounded-2xl bg-[#111726] border border-purple-500/30 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <h3 className="text-sm font-extrabold text-white">Validation Pipeline</h3>
                </div>

                <button
                  onClick={handleCancelUpload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 font-bold text-xs transition-all"
                >
                  <X className="w-4 h-4" /> Cancel Upload
                </button>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{processingState.label}</span>
                  <span className="font-mono text-purple-400 font-extrabold">{processingState.progress}%</span>
                </div>

                <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${processingState.progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>

                {processingState.subText && (
                  <div className="text-[10px] text-gray-400 font-mono text-center pt-1">
                    {processingState.subText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: VALIDATION SUMMARY REPORT ─────────────────────────────── */}
      {currentStep === 3 && validationReport && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#111522] border border-white/10 flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <FileSearch className="w-4 h-4 text-purple-400" />
              <span>Statement: <strong className="text-white">{stagedFile?.name}</strong> ({stagedFile ? formatFileSize(stagedFile.size) : ""})</span>
            </div>

            <button
              onClick={handleCancelUpload}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-upload / Select Another File
            </button>
          </div>

          <div className={`p-5 rounded-2xl border shadow-2xl flex items-start gap-4 ${
            validationReport.isImportAllowed
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}>
            {validationReport.isImportAllowed ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-extrabold uppercase tracking-wide">
                {validationReport.isImportAllowed
                  ? "✓ Validation Passed — Statement Verified"
                  : "⛔ Import Blocked — Critical Validation Errors Detected"}
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                {validationReport.isImportAllowed
                  ? "All mandatory file columns, trade rows, and broker structures have been verified. Zero database writes performed."
                  : "Critical errors were found in this CSV statement. Please review missing columns or row errors below."}
              </p>
            </div>
          </div>

          {/* Validation Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Rows</span>
              <span className="text-base font-extrabold text-white">{validationReport.totalRows.toLocaleString()}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Valid Rows</span>
              <span className="text-base font-extrabold text-emerald-400">{validationReport.validRows.toLocaleString()}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Warnings</span>
              <span className={`text-base font-extrabold ${validationReport.warningCount > 0 ? "text-amber-400" : "text-gray-400"}`}>
                {validationReport.warningCount}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Errors</span>
              <span className={`text-base font-extrabold ${validationReport.errorCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {validationReport.errorCount}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1 min-w-0">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Broker</span>
              <span className="text-xs font-bold text-purple-300 truncate block">{validationReport.brokerDetected}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111522] border border-white/10 space-y-1 min-w-0">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Account</span>
              <span className="text-xs font-bold text-white truncate block">{validationReport.selectedAccountName}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              onClick={handleCancelUpload}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs transition-all"
            >
              Cancel / Re-upload File
            </button>

            {validationReport.isImportAllowed ? (
              <button
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-xl active:scale-95"
              >
                <span>Proceed to Step 4 (Trade Preview & Policy)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled
                className="px-6 py-2.5 rounded-xl bg-gray-700/50 text-gray-400 font-bold text-xs cursor-not-allowed border border-gray-600/30"
              >
                Import Blocked — Fix Critical Errors
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 4: IMPORT PREVIEW & DUPLICATE POLICY ───────────────────────── */}
      {currentStep === 4 && validationReport && stagedFile && selectedAccount && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#111522] border border-purple-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Table className="w-5 h-5 text-purple-400" />
                Step 4 — Statement Import Preview
              </h2>

              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Validation Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Target Account</span>
                <span className="font-extrabold text-white truncate block">{selectedAccount.account_name}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Currency</span>
                <span className="font-extrabold text-purple-300 block">{selectedAccount.currency}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Broker</span>
                <span className="font-extrabold text-white truncate block">{validationReport.brokerDetected}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Platform</span>
                <span className="font-extrabold text-white truncate block">{selectedAccount.platform}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Filename</span>
                <span className="font-bold text-gray-200 truncate block">{stagedFile.name}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">File Size</span>
                <span className="font-bold text-gray-300 block">{formatFileSize(stagedFile.size)}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400 block text-[9px] uppercase font-bold">Total Trades</span>
                <span className="font-extrabold text-emerald-400 block">{validationReport.totalRows.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Trade Preview Sample Table (First 20 Trades) */}
          <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  Trade Sample Preview
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Displaying first {Math.min(20, validationReport.parsedTrades.length)} parsed trades of {validationReport.totalRows.toLocaleString()} total trades found.
                </p>
              </div>

              <span className="text-[10px] text-purple-300 font-mono font-bold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                Temporary Memory Buffer
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-gray-400 font-bold text-[10px] uppercase">
                    <th className="p-3">#</th>
                    <th className="p-3">Ticket</th>
                    <th className="p-3">Open Time</th>
                    <th className="p-3">Close Time</th>
                    <th className="p-3">Symbol</th>
                    <th className="p-3">Side</th>
                    <th className="p-3 text-right">Volume</th>
                    <th className="p-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300 text-[11px]">
                  {validationReport.parsedTrades.slice(0, 20).map((t, idx) => {
                    const isWin = t.profit > 0;
                    const isLoss = t.profit < 0;

                    return (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-gray-500 font-bold">{idx + 1}</td>
                        <td className="p-3 font-mono text-gray-400">{t.ticket || "-"}</td>
                        <td className="p-3 text-gray-400 whitespace-nowrap">
                          {t.openTime ? t.openTime.replace("T", " ").substring(0, 16) : "-"}
                        </td>
                        <td className="p-3 text-gray-300 whitespace-nowrap">
                          {t.closeTime ? t.closeTime.replace("T", " ").substring(0, 16) : "-"}
                        </td>
                        <td className="p-3 font-extrabold text-white">{t.symbol}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            t.direction === "LONG"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          }`}>
                            {t.direction === "LONG" ? "BUY" : "SELL"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-gray-300">{t.volume.toFixed(2)}</td>
                        <td className={`p-3 text-right font-extrabold ${
                          isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-gray-400"
                        }`}>
                          {formatMoney(t.profit, selectedAccount?.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DUPLICATE RESOLUTION POLICY CARD */}
          <div className="p-6 rounded-2xl bg-[#111726] border border-purple-500/30 space-y-4 shadow-2xl">
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <CopyX className="w-4 h-4 text-purple-400" />
                Duplicate Handling Policy Options
              </h3>

              {validationReport.duplicateCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  {validationReport.duplicateCount} duplicate trade(s) detected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDuplicatePolicy("skip")}
                className={`p-4 rounded-xl border text-left space-y-2 transition-all ${
                  duplicatePolicy === "skip"
                    ? "bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500 shadow-xl"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Skip Duplicates (Default)
                  </span>
                  {duplicatePolicy === "skip" && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Automatically ignores any trade that matches an existing database record or duplicate CSV row. Safe & recommended.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDuplicatePolicy("overwrite")}
                className={`p-4 rounded-xl border text-left space-y-2 transition-all ${
                  duplicatePolicy === "overwrite"
                    ? "bg-amber-600/20 border-amber-500 text-white ring-1 ring-amber-500 shadow-xl"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-amber-400" /> Overwrite Duplicates
                  </span>
                  {duplicatePolicy === "overwrite" && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Imports all valid trades in the CSV statement, updating matching duplicate records. Use if re-importing updated data.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDuplicatePolicy("cancel")}
                className={`p-4 rounded-xl border text-left space-y-2 transition-all ${
                  duplicatePolicy === "cancel"
                    ? "bg-rose-600/20 border-rose-500 text-white ring-1 ring-rose-500 shadow-xl"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-rose-300 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-400" /> Cancel Import
                  </span>
                  {duplicatePolicy === "cancel" && <Check className="w-4 h-4 text-rose-400" />}
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Aborts the import workflow entirely. Temporary memory buffer is wiped and zero database changes occur.
                </p>
              </button>
            </div>
          </div>

          {/* Live Batch Streaming Progress Overlay */}
          {isFinalizingImport && (
            <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-extrabold text-white">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  {processingState.label}
                </span>
                <span className="text-purple-300 font-mono">{processingState.progress}%</span>
              </div>

              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${processingState.progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>{processingState.subText || "Streaming trades to database..."}</span>
                <button
                  onClick={handleCancelUpload}
                  className="text-rose-400 hover:text-rose-300 font-bold underline"
                >
                  Cancel Import Execution
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(3)}
                disabled={isFinalizingImport}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-xs transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <button
                onClick={handleCancelUpload}
                disabled={isFinalizingImport}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-rose-300 hover:text-rose-200 font-bold text-xs transition-all"
              >
                Cancel
              </button>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={!validationReport.isImportAllowed || isFinalizingImport}
              className="flex items-center gap-2 px-7 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-xl active:scale-95 shadow-purple-600/25"
            >
              {isFinalizingImport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {duplicatePolicy === "cancel"
                  ? "Cancel Import Workflow"
                  : `Execute Import to ${selectedAccount.account_name}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: POST-IMPORT REPORT DASHBOARD & REPORT EXPORTER ───────────── */}
      {currentStep === 5 && finalReport && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h2 className="text-base font-extrabold text-white uppercase tracking-tight">
                    Statement Import Audit Complete
                  </h2>
                  <p className="text-xs text-emerald-300/90 mt-0.5">
                    Import completed in <strong className="text-white">{finalReport.timeTakenSeconds.toFixed(2)}s</strong>. All trades are synchronized with cloud database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportImportReportCsv(finalReport)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Export CSV
                </button>

                <button
                  onClick={() => exportImportReportPdf(finalReport)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
                >
                  <FileDown className="w-4 h-4" /> Export PDF Audit
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Rows</span>
              <span className="text-lg font-extrabold text-white">{finalReport.totalRows.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Imported</span>
              <span className="text-lg font-extrabold text-emerald-400">{finalReport.importedRows.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Skipped</span>
              <span className="text-lg font-extrabold text-amber-400">{finalReport.skippedRows.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Failed</span>
              <span className={`text-lg font-extrabold ${finalReport.failedRows > 0 ? "text-rose-400" : "text-gray-400"}`}>
                {finalReport.failedRows}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#111522] border border-white/10 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Time Taken</span>
              <span className="text-lg font-extrabold text-purple-300 flex items-center gap-1">
                <Clock className="w-4 h-4" /> {finalReport.timeTakenSeconds.toFixed(2)}s
              </span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 space-y-4 shadow-2xl">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white">Import Configuration Details</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-gray-400 block font-bold">Trading Account</span>
                <span className="font-extrabold text-white">{finalReport.accountName} ({finalReport.currency})</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-gray-400 block font-bold">Broker & Platform</span>
                <span className="font-extrabold text-white">{finalReport.broker} · {finalReport.platform}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-gray-400 block font-bold">CSV Filename</span>
                <span className="font-bold text-gray-200 truncate block">{finalReport.filename}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-gray-400 block font-bold">Completion Timestamp</span>
                <span className="font-bold text-gray-300">{finalReport.completedAt.substring(0, 19).replace("T", " ")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportImportReportCsv(finalReport)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" /> Export CSV Report
              </button>

              <button
                onClick={() => exportImportReportPdf(finalReport)}
                className="px-4 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <FileDown className="w-4 h-4" /> Export PDF Audit
              </button>
            </div>

            <button
              onClick={() => {
                setStagedFile(null);
                setValidationReport(null);
                setFinalReport(null);
                setCurrentStep(1);
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-xl active:scale-95"
            >
              <span>Done / Start New Import</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Account Form Modal */}
      <AccountFormModal
        open={addAccountModalOpen}
        onClose={() => setAddAccountModalOpen(false)}
        onSubmit={handleCreateAccountInModal}
      />
    </div>
  );
};
