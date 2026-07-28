"use client";
// app/(app)/import-history/page.tsx
// Complete CSV Import History page supporting batch multi-selection, deletion, and trade purging.

import React, { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  History, Upload, RefreshCw, AlertCircle, Trash2, CheckSquare, Square,
  ChevronDown, ChevronUp, AlertTriangle, X
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchImportHistory, deleteImportRecord, deleteAllImports, type DeleteImportResult } from "@/lib/supabase/csv-imports";
import { useAppEventListener } from "@/lib/events/event-bus";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportStatusBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CsvImport } from "@/types/database";

export default function ImportHistoryPage() {
  const [imports, setImports] = useState<CsvImport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Deletion Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
  const [deleteTradesToo, setDeleteTradesToo] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
    ["tradefourge:import-created", "tradefourge:import-deleted", "tradefourge:trade-created", "tradefourge:trade-deleted"],
    () => {
      if (userId) loadHistory(userId);
    }
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === imports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(imports.map(i => i.id));
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

  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const handleExecuteDelete = async () => {
    if (!userId || targetDeleteIds.length === 0) {
      setFeedbackToast({ message: "Nothing to delete.", type: "warning" });
      setTimeout(() => setFeedbackToast(null), 4000);
      return;
    }
    setDeleting(true);

    const isAll = targetDeleteIds.length === imports.length;
    const idsToRemove = [...targetDeleteIds];

    // Optimistic UI Removal
    setImports((prev) => prev.filter((item) => !idsToRemove.includes(item.id)));
    setSelectedIds([]);
    setTargetDeleteIds([]);
    setDeleteModalOpen(false);

    try {
      if (isAll) {
        const res = await deleteAllImports(userId);
        setFeedbackToast({ message: res.message, type: res.success ? "success" : "warning" });
      } else {
        let lastResult: DeleteImportResult | null = null;
        for (const id of idsToRemove) {
          lastResult = await deleteImportRecord(id, userId, deleteTradesToo);
        }
        if (lastResult && !lastResult.success) {
          setFeedbackToast({ message: lastResult.message, type: "warning" });
          if (userId) await loadHistory(userId);
        } else {
          setFeedbackToast({ message: lastResult?.message || "Import deleted.", type: "success" });
        }
      }
    } catch {
      setFeedbackToast({ message: "Failed to delete.", type: "warning" });
      if (userId) await loadHistory(userId);
    } finally {
      setDeleting(false);
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  const totalImported = imports.reduce((s, r) => s + (r.imported_rows ?? 0), 0);
  const totalFailed = imports.reduce((s, r) => s + (r.failed_rows ?? 0), 0);
  const successCount = imports.filter((r) => r.import_status === "success").length;

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Import History
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Audited CSV import logs and trade file records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={() => openDeleteConfirmation(selectedIds)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-glow"
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
            className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
            title="Refresh Import History"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-glow transition-all"
          >
            <Upload className="w-4 h-4" />
            New Import
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      {imports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Imports", value: imports.length, color: "text-white" },
            { label: "Successful", value: successCount, color: "text-emerald-400" },
            { label: "Trades Imported", value: totalImported.toLocaleString(), color: "text-purple-400" },
            { label: "Failed Rows", value: totalFailed.toLocaleString(), color: "text-rose-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl glass-card border border-dark-border">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                {label}
              </span>
              <span className={`text-xl font-extrabold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feedback Notification Toast */}
      {feedbackToast && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-xs ${
          feedbackToast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
          feedbackToast.type === "warning" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
          "bg-purple-500/15 border-purple-500/30 text-purple-300"
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : imports.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No Imports Found"
          description="Upload your MetaTrader 4, MetaTrader 5, cTrader, or TradingView CSV file to start journaling."
          action={{
            label: "Upload CSV",
            href: "/upload",
          }}
        />
      ) : (
        <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0C1019] text-gray-400 border-b border-dark-border">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                      {selectedIds.length === imports.length ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Broker / Platform</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Imported / Total</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {imports.map((rec) => {
                  const isSelected = selectedIds.includes(rec.id);
                  const isExpanded = expandedId === rec.id;
                  const hasErrors = rec.error_log && (rec.error_log as any[]).length > 0;

                  return (
                    <React.Fragment key={rec.id}>
                      <tr className={`hover:bg-purple-600/10 transition-colors ${isSelected ? "bg-purple-600/15" : ""}`}>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => toggleSelectOne(rec.id)} className="text-gray-400 hover:text-white">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-white max-w-[200px] truncate">
                          {rec.filename}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {rec.broker || "Generic"} / {rec.platform || "CSV"}
                        </td>
                        <td className="py-3 px-4">
                          <ImportStatusBadge status={rec.import_status} />
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-400 font-bold">{rec.imported_rows}</span> / {rec.total_rows}
                          {rec.failed_rows > 0 && (
                            <span className="text-rose-400 ml-1">({rec.failed_rows} failed)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {rec.uploaded_at ? format(parseISO(rec.uploaded_at), "yyyy-MM-dd HH:mm") : "—"}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {hasErrors && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                              className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border text-gray-300 hover:text-white"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteConfirmation([rec.id])}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400"
                            title="Delete Import Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && hasErrors && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-rose-500/10 border-b border-dark-border">
                            <h4 className="font-bold text-rose-400 mb-2">Import Error Log:</h4>
                            <pre className="text-[10px] text-gray-300 max-h-40 overflow-y-auto bg-black/40 p-3 rounded-xl border border-rose-500/30">
                              {JSON.stringify(rec.error_log, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl glass-card border border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Confirm Import Deletion
              </h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-gray-300 text-xs">
              You are about to delete <span className="text-white font-bold">{targetDeleteIds.length}</span> import log record(s).
            </p>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-dark-card border border-dark-border cursor-pointer">
              <input
                type="checkbox"
                checked={deleteTradesToo}
                onChange={(e) => setDeleteTradesToo(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded accent-purple-600 focus:ring-purple-500"
              />
              <span className="text-gray-200 font-bold">Also delete all trades imported in this file</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-dark-card border border-dark-border text-gray-300 hover:text-white font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-glow"
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
