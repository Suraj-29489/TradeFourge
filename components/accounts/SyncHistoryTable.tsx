"use client";
// components/accounts/SyncHistoryTable.tsx
// TradeFourge v4.0 Sync History Audit Log Viewer

import React, { useState, useEffect } from "react";
import { fetchSyncHistory, clearSyncHistory } from "@/lib/live-sync/sync-history";
import type { SyncLogEntry } from "@/types/database";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";

interface SyncHistoryTableProps {
  userId: string;
}

export const SyncHistoryTable: React.FC<SyncHistoryTableProps> = ({ userId }) => {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

  const loadLogs = () => {
    const fetched = fetchSyncHistory(userId);
    setLogs(fetched);
  };

  useEffect(() => {
    loadLogs();
  }, [userId]);

  const handleClear = () => {
    if (confirm("Clear all synchronization history logs?")) {
      clearSyncHistory(userId);
      setLogs([]);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.account_name.toLowerCase().includes(search.toLowerCase()) ||
      log.broker.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 font-mono">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl glass-card border border-dark-border">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sync logs..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-dark-card border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-dark-card border border-white/10 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
          <History className="w-8 h-8 text-gray-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Sync History Recorded</h3>
          <p className="text-xs text-gray-400">
            Synchronization logs will appear here automatically when connected accounts sync.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/30 border-b border-white/10 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Account / Broker</th>
                  <th className="p-3 text-center">Imported</th>
                  <th className="p-3 text-center">Updated</th>
                  <th className="p-3 text-center">Skipped</th>
                  <th className="p-3 text-center">Duration</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredLogs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 whitespace-nowrap text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-white">
                        <div>{log.account_name}</div>
                        <span className="text-[10px] text-purple-400 font-normal">{log.broker}</span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">
                        +{log.trades_imported}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-400">
                        {log.trades_updated}
                      </td>
                      <td className="p-3 text-center font-mono text-gray-500">
                        {log.trades_skipped}
                      </td>
                      <td className="p-3 text-center text-gray-400">
                        {log.duration_ms}ms
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold" title={log.error_message || undefined}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
