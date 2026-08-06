"use client";
// components/reports/ReportHistoryTable.tsx
// TradeFourge v4.1 Report History Log Viewer

import React, { useState, useEffect } from "react";
import { ReportEngine } from "@/lib/reports/report-engine";
import { formatBytes } from "@/lib/reports/report-utils";
import type { ReportHistoryEntry } from "@/lib/reports/report-types";
import type { CloudTradeWithRelations } from "@/types/database";
import {
  History,
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

interface ReportHistoryTableProps {
  userId: string;
  trades: CloudTradeWithRelations[];
}

export const ReportHistoryTable: React.FC<ReportHistoryTableProps> = ({ userId, trades }) => {
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [search, setSearch] = useState("");

  const loadHistory = () => {
    const fetched = ReportEngine.getHistory(userId);
    setHistory(fetched);
  };

  useEffect(() => {
    loadHistory();
  }, [userId]);

  const handleDelete = (id: string) => {
    ReportEngine.deleteHistoryItem(userId, id);
    loadHistory();
  };

  const handleRedownload = (entry: ReportHistoryEntry) => {
    // Re-generate report for history item
    const options = {
      templateType: entry.templateType,
      title: entry.title,
      dateRange: "ALL" as const,
      accountIds: ["ALL"],
      includeCharts: true,
      includeTradeList: true,
      includeNotes: true,
      includeCalendar: true,
      includeScreenshots: false,
      orientation: "portrait" as const,
      paperFormat: "a4" as const,
      pdfTheme: "dark" as const,
    };

    if (entry.format === "PDF") {
      ReportEngine.exportPdf(userId, trades, options);
    } else {
      ReportEngine.exportCsv(userId, trades, options);
    }
  };

  const filtered = history.filter((item) =>
    !search ||
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.templateName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 font-mono">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl glass-card border border-dark-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search report history..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-dark-card border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={loadHistory}
          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh History</span>
        </button>
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="p-8 rounded-2xl glass-card border border-dark-border text-center space-y-3">
          <History className="w-8 h-8 text-gray-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Report History Recorded</h3>
          <p className="text-xs text-gray-400">
            Exported PDF and CSV statements will be logged here automatically.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/30 border-b border-white/10 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="p-3">Generated Date</th>
                  <th className="p-3">Report Title / Template</th>
                  <th className="p-3 text-center">Period</th>
                  <th className="p-3 text-center">Trades</th>
                  <th className="p-3 text-center">Format</th>
                  <th className="p-3 text-center">File Size</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 whitespace-nowrap text-gray-400">
                      {new Date(item.generatedAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold text-white">
                      <div>{item.title}</div>
                      <span className="text-[10px] text-blue-400 font-normal">{item.templateName}</span>
                    </td>
                    <td className="p-3 text-center text-gray-300 whitespace-nowrap">
                      {item.periodLabel}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-white">
                      {item.tradeCount}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.format === "PDF"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {item.format}
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-400 font-mono">
                      {formatBytes(item.fileSizeBytes)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRedownload(item)}
                          className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                          title="Redownload report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                          title="Delete history record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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
