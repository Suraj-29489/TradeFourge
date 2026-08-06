"use client";
// app/(app)/import-history/page.tsx
// TradeFourge v3.7.6 — CSV Import Engine 2.0 (Phase 9 — Import History Audit Log & Actions)
// Complete audit log with search filtering, Summary modal inspection, CSV/PDF report downloads, Re-import navigation, and Cascading Delete.

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  History, Upload, RefreshCw, AlertCircle, Trash2, CheckSquare, Square,
  ChevronDown, ChevronUp, AlertTriangle, X, Search, Filter, FileText,
  Download, FileDown, RotateCcw, Building2, Monitor, Wallet, Clock,
  CheckCircle2, XCircle, FileSpreadsheet, Eye, ArrowRight, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchImportHistory, deleteImportRecord, deleteAllImports, type DeleteImportResult } from "@/lib/supabase/csv-imports";
import { exportImportReportCsv, exportImportReportPdf, FinalImportReportData } from "@/lib/export/import-report-exporter";
import { useAppEventListener } from "@/lib/events/event-bus";
import { generateAccountSlug } from "@/lib/account/account-identity";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportStatusBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CsvImport } from "@/types/database";

export default function ImportHistoryPage() {
  const router = useRouter();
  const [imports, setImports] = useState<CsvImport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Phase 9 Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Summary Inspection Modal State
  const [summaryRecord, setSummaryRecord] = useState<CsvImport | null>(null);

  // Deletion Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
  const [deleteTradesToo, setDeleteTradesToo] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const supabase = createClient();

  const loadHistory = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchImportHistory(uid);
    if (err) setError(err);
    else setImports(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadHistory(user.id);
      }
    })();
  }, [loadHistory]);

  useAppEventListener(
    ["tradefourge:import-created", "tradefourge:import-deleted", "tradefourge:trade-created", "tradefourge:trade-deleted", "tradefourge:data-changed"],
    () => {
      if (userId) loadHistory(userId);
    }
  );

  // Phase 9 Search & Filter Logic
  const filteredImports = useMemo(() => {
    return imports.filter((rec: any) => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && rec.import_status !== statusFilter) {
        return false;
      }

      // 2. Search Term Filter across Account (slug lookup), Broker, Date, Filename
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const querySlug = generateAccountSlug(searchTerm);
        const filename = (rec.filename || "").toLowerCase();
        const accSlug = rec.account?.slug || generateAccountSlug(rec.account?.account_name || "");
        const accName = (rec.account?.account_name || "").toLowerCase();
        const broker = (rec.account?.broker || rec.broker || "").toLowerCase();
        const platform = (rec.account?.platform || rec.platform || "").toLowerCase();
        const dateStr = rec.uploaded_at ? format(parseISO(rec.uploaded_at), "yyyy-MM-dd HH:mm").toLowerCase() : "";

        return (
          filename.includes(query) ||
          accName.includes(query) ||
          (querySlug !== "" && accSlug.includes(querySlug)) ||
          broker.includes(query) ||
          platform.includes(query) ||
          dateStr.includes(query)
        );
      }

      return true;
    });
  }, [imports, searchTerm, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredImports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredImports.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const openDeleteConfirmation = (ids: string[]) => {
    setTargetDeleteIds(ids);
    setDeleteModalOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!userId || targetDeleteIds.length === 0) {
      setFeedbackToast({ message: "Nothing to delete.", type: "warning" });
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }
    setDeleting(true);

    const isAll = targetDeleteIds.length === imports.length;
    const idsToRemove = [...targetDeleteIds];

    try {
      if (isAll) {
        const res = await deleteAllImports(userId);
        if (!res.success) {
          setFeedbackToast({ message: res.error || res.message, type: "warning" });
          return;
        }
        setFeedbackToast({ message: res.message, type: "success" });
      } else {
        let lastResult: DeleteImportResult | null = null;
        for (const id of idsToRemove) {
          lastResult = await deleteImportRecord(id, userId, deleteTradesToo);
          if (lastResult && !lastResult.success) {
            setFeedbackToast({ message: lastResult.error || lastResult.message, type: "warning" });
            break;
          }
        }
        if (lastResult && lastResult.success) {
          setFeedbackToast({ message: lastResult.message || "Import deleted.", type: "success" });
        }
      }

      await loadHistory(userId);
      setSelectedIds([]);
      setTargetDeleteIds([]);
      setDeleteModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete.";
      setFeedbackToast({ message: msg, type: "warning" });
      await loadHistory(userId);
    } finally {
      setDeleting(false);
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  // Phase 9 Report Export Helper from History Record
  const triggerExportFromRecord = (rec: any, formatType: "csv" | "pdf") => {
    const accName = rec.account?.account_name || "Primary Account";
    const accCurrency = rec.account?.currency || "USD";
    const broker = rec.account?.broker || rec.broker || "Exness";
    const platform = rec.account?.platform || rec.platform || "MetaTrader 5";

    const reportData: FinalImportReportData = {
      filename: rec.filename,
      accountName: accName,
      currency: accCurrency,
      broker,
      platform,
      totalRows: rec.total_rows || 0,
      importedRows: rec.imported_rows || 0,
      skippedRows: rec.skipped_rows || 0,
      failedRows: rec.failed_rows || 0,
      duplicateCount: rec.skipped_rows || 0,
      warningCount: rec.error_log ? (rec.error_log as any[]).length : 0,
      timeTakenSeconds: 1.25,
      completedAt: rec.completed_at || rec.uploaded_at || new Date().toISOString(),
      errors: Array.isArray(rec.error_log)
        ? (rec.error_log as any[]).map((e: any, i: number) => ({
            rowNumber: i + 1,
            field: "row_validation",
            message: typeof e === "string" ? e : JSON.stringify(e),
          }))
        : [],
      warnings: [],
    };

    if (formatType === "csv") {
      exportImportReportCsv(reportData);
    } else {
      exportImportReportPdf(reportData);
    }
  };

  // Phase 9 Re-import Navigation Helper
  const handleReImport = (rec: any) => {
    const targetAccountId = rec.account_id || rec.account?.id;
    if (targetAccountId) {
      router.push(`/upload?account_id=${targetAccountId}`);
    } else {
      router.push("/upload");
    }
  };

  const totalImported = imports.reduce((s, r) => s + (r.imported_rows ?? 0), 0);
  const totalFailed = imports.reduce((s, r) => s + (r.failed_rows ?? 0), 0);
  const successCount = imports.filter((r) => r.import_status === "success").length;

  return (
    <div className="space-y-6 text-xs font-mono pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#111522] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Import History Audit Log
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              TradeFourge v3.7.6 — Institutional audit trail for all imported CSV statements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => openDeleteConfirmation(selectedIds)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          {imports.length > 0 && selectedIds.length === 0 && (
            <button
              onClick={() => openDeleteConfirmation(imports.map(i => i.id))}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All</span>
            </button>
          )}

          <button
            onClick={() => userId && loadHistory(userId)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-colors"
            title="Refresh Import History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>New CSV Import</span>
          </Link>
        </div>
      </div>

      {/* Stats Summary Strip */}
      {imports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Statements", value: imports.length, color: "text-white" },
            { label: "Successful Imports", value: successCount, color: "text-emerald-400" },
            { label: "Trades Imported", value: totalImported.toLocaleString(), color: "text-blue-400" },
            { label: "Failed Rows", value: totalFailed.toLocaleString(), color: "text-rose-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl bg-[#111522] border border-white/10 shadow-lg space-y-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                {label}
              </span>
              <span className={`text-xl font-extrabold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* PHASE 9 SEARCH & FILTER TOOLBAR */}
      {imports.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#111522] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Account, Broker, Filename, or Date (YYYY-MM-DD)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-blue-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#171D2C] border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-blue-500 w-full sm:w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
            </select>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-xs ${
          feedbackToast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
          feedbackToast.type === "warning" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
          "bg-blue-500/15 border-blue-500/30 text-blue-300"
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Section */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredImports.length === 0 ? (
        <EmptyState
          icon={Upload}
          title={imports.length === 0 ? "No Import History Records" : "No Matching Imports Found"}
          description={imports.length === 0 ? "Upload your MT4, MT5, cTrader, or Brokerage CSV file to start auditing." : "No statement imports match your search criteria."}
          action={{
            label: "Upload CSV Statement",
            href: "/upload",
          }}
        />
      ) : (
        <div className="rounded-2xl bg-[#111522] border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/5 text-gray-400 border-b border-white/10 text-[10px] uppercase font-bold">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                      {selectedIds.length === filteredImports.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Statement Filename</th>
                  <th className="py-3 px-4">Trading Account</th>
                  <th className="py-3 px-4">Broker / Platform</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Trades (Imported / Total)</th>
                  <th className="py-3 px-4">Import Date</th>
                  <th className="py-3 px-4 text-right">Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300 text-[11px]">
                {filteredImports.map((rec: any) => {
                  const isSelected = selectedIds.includes(rec.id);
                  const accName = rec.account?.account_name || "Primary Account";
                  const accCurr = rec.account?.currency || "USD";
                  const broker = rec.account?.broker || rec.broker || "Exness";
                  const platform = rec.account?.platform || rec.platform || "MetaTrader 5";

                  return (
                    <tr key={rec.id} className={`hover:bg-blue-600/10 transition-colors ${isSelected ? "bg-blue-600/15" : ""}`}>
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => toggleSelectOne(rec.id)} className="text-gray-400 hover:text-white">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-white max-w-[200px] truncate">
                        {rec.filename}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{accName}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                            {accCurr}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{broker} · {platform}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <ImportStatusBadge status={rec.import_status} />
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-emerald-400 font-extrabold">{rec.imported_rows}</span> / {rec.total_rows}
                        {rec.failed_rows > 0 && (
                          <span className="text-rose-400 font-bold ml-1">({rec.failed_rows} failed)</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-400">
                        {rec.uploaded_at ? format(parseISO(rec.uploaded_at), "yyyy-MM-dd HH:mm") : "—"}
                      </td>

                      {/* PHASE 9 AUDIT ACTIONS BUTTONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. View Summary */}
                          <button
                            onClick={() => setSummaryRecord(rec)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-blue-300 font-bold text-[10px] flex items-center gap-1 transition-all"
                            title="View Summary Report"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Summary</span>
                          </button>

                          {/* 2. Download Report */}
                          <button
                            onClick={() => triggerExportFromRecord(rec, "pdf")}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all"
                            title="Export PDF Audit Report"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Re-import */}
                          <button
                            onClick={() => handleReImport(rec)}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 transition-all"
                            title="Re-import for this account"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* 4. Delete Import */}
                          <button
                            onClick={() => openDeleteConfirmation([rec.id])}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-all"
                            title="Delete Import Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PHASE 9 VIEW SUMMARY MODAL */}
      {summaryRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-[#111522] border border-blue-500/40 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                  Import Audit Summary Log
                </h3>
              </div>
              <button onClick={() => setSummaryRecord(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[9px] text-gray-400 uppercase font-bold block">Total Rows</span>
                <span className="text-base font-extrabold text-white">{summaryRecord.total_rows}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[9px] text-gray-400 uppercase font-bold block">Imported</span>
                <span className="text-base font-extrabold text-emerald-400">{summaryRecord.imported_rows}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[9px] text-gray-400 uppercase font-bold block">Skipped</span>
                <span className="text-base font-extrabold text-amber-400">{summaryRecord.skipped_rows || 0}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[9px] text-gray-400 uppercase font-bold block">Failed</span>
                <span className={`text-base font-extrabold ${summaryRecord.failed_rows > 0 ? "text-rose-400" : "text-gray-400"}`}>
                  {summaryRecord.failed_rows}
                </span>
              </div>
            </div>

            {/* Configuration Details Box */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">Statement Filename:</span>
                <span className="font-extrabold text-white truncate max-w-[250px]">{summaryRecord.filename}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">Target Trading Account:</span>
                <span className="font-extrabold text-white">
                  {(summaryRecord as any).account?.account_name || "Primary Account"} ({(summaryRecord as any).account?.currency || "USD"})
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">Broker / Platform:</span>
                <span className="font-extrabold text-blue-300">
                  {(summaryRecord as any).account?.broker || summaryRecord.broker || "Exness"} · {(summaryRecord as any).account?.platform || summaryRecord.platform || "MetaTrader 5"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Import Date:</span>
                <span className="font-bold text-gray-200">
                  {summaryRecord.uploaded_at ? format(parseISO(summaryRecord.uploaded_at), "yyyy-MM-dd HH:mm:ss") : "-"}
                </span>
              </div>
            </div>

            {/* Row Failure Logs Section if present */}
            {summaryRecord.error_log && (summaryRecord.error_log as any[]).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Row Failure Error Logs:
                </span>
                <pre className="text-[10px] text-rose-300 max-h-36 overflow-y-auto bg-rose-500/10 p-3 rounded-xl border border-rose-500/30 font-mono whitespace-pre-wrap">
                  {JSON.stringify(summaryRecord.error_log, null, 2)}
                </pre>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerExportFromRecord(summaryRecord, "csv")}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
                </button>
                <button
                  onClick={() => triggerExportFromRecord(summaryRecord, "pdf")}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 font-bold text-xs flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export PDF
                </button>
              </div>

              <button
                onClick={() => setSummaryRecord(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#111522] border border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Confirm Import Log Deletion
              </h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-gray-300 text-xs">
              You are about to delete <span className="text-white font-bold">{targetDeleteIds.length}</span> import log record(s).
            </p>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteTradesToo}
                onChange={(e) => setDeleteTradesToo(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded accent-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-200 font-bold">Also delete all trades imported in this file</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg active:scale-95"
              >
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
