"use client";
// app/(app)/import-history/page.tsx
// CSV Import History — shows all import records from Supabase.

import React, { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  History,
  Upload,
  RefreshCw,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchImportHistory } from "@/lib/supabase/csv-imports";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportStatusBadge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import type { CsvImport } from "@/types/database";

export default function ImportHistoryPage() {
  const [imports, setImports] = useState<CsvImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const supabase = createClient();

  const loadHistory = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchImportHistory(uid, 100);
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
  }, []);

  const totalImported = imports.reduce((s, r) => s + (r.imported_rows ?? 0), 0);
  const totalFailed   = imports.reduce((s, r) => s + (r.failed_rows ?? 0), 0);
  const successCount  = imports.filter((r) => r.import_status === "success").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-mono">
              Import History
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              All CSV uploads and their processing results
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => userId && loadHistory(userId)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:bg-dark-hover text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm font-mono shadow-glow transition-all"
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
            { label: "Total Imports",   value: imports.length,  color: "text-white" },
            { label: "Successful",      value: successCount,    color: "text-emerald-400" },
            { label: "Trades Imported", value: totalImported.toLocaleString(), color: "text-purple-400" },
            { label: "Failed Rows",     value: totalFailed.toLocaleString(),   color: "text-rose-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-2xl glass-card border border-dark-border">
              <p className="text-xs font-mono text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-extrabold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : imports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Imports Yet"
          description="Upload your first CSV file from your broker to start building your cloud trading journal."
          action={{
            label: "Upload CSV",
            href: "/upload",
          }}
        />
      ) : (
        <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
          {/* Desktop table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-dark-card text-gray-400 border-b border-dark-border">
                <tr>
                  <th className="py-3 px-4">File</th>
                  <th className="py-3 px-4">Broker / Platform</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-center">Imported</th>
                  <th className="py-3 px-4 text-center">Skipped</th>
                  <th className="py-3 px-4 text-center">Duplicates</th>
                  <th className="py-3 px-4 text-center">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border text-gray-300">
                {imports.map((imp) => (
                  <React.Fragment key={imp.id}>
                    <tr
                      className="hover:bg-dark-hover/40 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === imp.id ? null : imp.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="text-white font-medium truncate max-w-[200px]">
                            {imp.filename}
                          </span>
                          {expandedId === imp.id
                            ? <ChevronUp className="w-3 h-3 text-gray-500 shrink-0" />
                            : <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                          }
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-white">{imp.broker ?? "—"}</span>
                          {imp.platform && (
                            <span className="text-gray-500 block text-[10px]">{imp.platform}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <ImportStatusBadge status={imp.import_status} />
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {format(parseISO(imp.uploaded_at), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="py-3 px-4 text-center text-emerald-400 font-bold">
                        {imp.imported_rows.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-400">
                        {imp.skipped_rows.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-amber-400">
                        {imp.duplicate_rows.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center text-rose-400">
                        {imp.failed_rows.toLocaleString()}
                      </td>
                    </tr>

                    {/* Expanded error log */}
                    {expandedId === imp.id && imp.error_log && imp.error_log.length > 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-3 bg-dark-card/50">
                          <p className="text-[10px] text-gray-500 font-mono mb-2 uppercase tracking-wider">
                            Error Log
                          </p>
                          <div className="space-y-1">
                            {imp.error_log.slice(0, 10).map((err, i) => (
                              <p key={i} className="text-xs text-rose-400 font-mono">
                                {i + 1}. {err}
                              </p>
                            ))}
                            {imp.error_log.length > 10 && (
                              <p className="text-xs text-gray-500 font-mono">
                                ...and {imp.error_log.length - 10} more errors
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedId === imp.id && imp.notes && (
                      <tr>
                        <td colSpan={8} className="px-6 pb-3 bg-dark-card/50">
                          <p className="text-[10px] text-gray-500 font-mono mb-1 uppercase tracking-wider">Notes</p>
                          <p className="text-xs text-gray-300 font-mono">{imp.notes}</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-dark-border">
            {imports.map((imp) => (
              <div key={imp.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white font-mono truncate max-w-[200px]">
                        {imp.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {imp.broker ?? "Unknown broker"}
                        {imp.platform ? ` · ${imp.platform}` : ""}
                      </p>
                    </div>
                  </div>
                  <ImportStatusBadge status={imp.import_status} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="text-center">
                    <p className="text-gray-500">Imported</p>
                    <p className="font-bold text-emerald-400">{imp.imported_rows}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Skipped</p>
                    <p className="font-bold text-gray-300">{imp.skipped_rows}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Dupes</p>
                    <p className="font-bold text-amber-400">{imp.duplicate_rows}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Failed</p>
                    <p className="font-bold text-rose-400">{imp.failed_rows}</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-mono">
                  {format(parseISO(imp.uploaded_at), "MMM d, yyyy · HH:mm")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
