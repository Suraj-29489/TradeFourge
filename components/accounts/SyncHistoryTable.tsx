"use client";

import React, { useState, useEffect } from "react";
import { fetchSyncHistoryLogs } from "@/lib/supabase/live-credentials";
import type { SyncHistoryLog } from "@/types/database";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SyncHistoryTableProps {
  userId: string;
}

export const SyncHistoryTable: React.FC<SyncHistoryTableProps> = ({ userId }) => {
  const [logs, setLogs] = useState<SyncHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

  // Selected Log Modal for detailed inspection
  const [selectedLog, setSelectedLog] = useState<SyncHistoryLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await fetchSyncHistoryLogs(userId);
    setLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) loadLogs();
  }, [userId]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.account_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.broker?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-dark-card border border-dark-border shadow-lg">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sync logs by account or broker..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading synchronization history logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 rounded-2xl bg-dark-card border border-dark-border text-center space-y-3">
          <History className="w-8 h-8 text-gray-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Sync History Recorded</h3>
          <p className="text-xs text-gray-400">
            Synchronization audit logs will appear here automatically when live broker accounts run sync cycles.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-dark-card border border-dark-border overflow-hidden shadow-xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Sync Time</th>
                  <th className="p-3.5">Account & Broker</th>
                  <th className="p-3.5 text-center">Imported</th>
                  <th className="p-3.5 text-center">Duplicates Skipped</th>
                  <th className="p-3.5 text-center">Duration</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredLogs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  const syncDate = log.sync_time || log.created_at;
                  return (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 whitespace-nowrap text-gray-400">
                        {syncDate ? new Date(syncDate).toLocaleString() : "N/A"}
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        <div>{log.account_name}</div>
                        <span className="text-[10px] text-purple-400 font-normal">{log.broker}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-emerald-400">
                        +{log.trades_imported} trades
                      </td>
                      <td className="p-3.5 text-center font-bold text-gray-400">
                        {log.duplicates_skipped}
                      </td>
                      <td className="p-3.5 text-center text-gray-400">
                        {log.duration_ms}ms
                      </td>
                      <td className="p-3.5 text-center">
                        {isSuccess ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-[10px] inline-flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3 h-3 text-purple-400" />
                          <span>View Log</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Log Inspection Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-lg p-6 rounded-2xl bg-dark-card border border-purple-500/30 space-y-4 font-mono shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-white text-sm">Sync Cycle Execution Log</span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">Account:</span>
                  <span className="font-bold text-white">{selectedLog.account_name} ({selectedLog.broker})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">Sync Timestamp:</span>
                  <span className="text-gray-200">{new Date(selectedLog.sync_time || selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">Trades Imported:</span>
                  <span className="font-bold text-emerald-400">+{selectedLog.trades_imported}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">Duplicates Skipped:</span>
                  <span className="font-bold text-gray-300">{selectedLog.duplicates_skipped}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400">Execution Duration:</span>
                  <span className="text-purple-400 font-bold">{selectedLog.duration_ms}ms</span>
                </div>
                {selectedLog.error_message && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
                    <span className="font-bold text-[10px] uppercase block text-rose-400">Failure Message:</span>
                    <span>{selectedLog.error_message}</span>
                  </div>
                )}
                {selectedLog.log_details && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-gray-400 uppercase">Execution Payload Details:</span>
                    <pre className="p-3 rounded-xl bg-black/50 text-[10px] text-emerald-400 overflow-x-auto border border-white/10">
                      {JSON.stringify(selectedLog.log_details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Close Audit Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
