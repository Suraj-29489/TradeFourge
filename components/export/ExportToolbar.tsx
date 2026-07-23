"use client";

import React from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { generateProfessionalPdf } from "@/lib/engine/pdf-generator";
import { exportJournalExcel } from "@/lib/export/excel-exporter";
import { exportJournalCSV } from "@/lib/export/csv-exporter";
import { FileText, FileSpreadsheet, Download } from "lucide-react";

export const ExportToolbar: React.FC = () => {
  const { currency } = useCurrencyFormatter();
  const selectedAccount = useJournalStore((state) => state.selectedAccount);
  const { filteredTrades, stats } = useJournalMetrics();

  const handlePdfExport = () => {
    generateProfessionalPdf(filteredTrades, stats, currency, selectedAccount);
  };

  const handleExcelExport = () => {
    // Adapt normalized trade to excel export format
    const legacyTrades = filteredTrades.map((t) => ({
      id: t.ticket,
      positionId: t.ticket,
      openTime: t.openTime || t.closeTime,
      closeTime: t.closeTime,
      symbol: t.symbol,
      direction: t.direction,
      lot: t.volume,
      entryPrice: t.openPrice ?? 0,
      exitPrice: t.closePrice,
      pnl: t.profit,
      commission: t.commission,
      swap: t.swap,
      rr: t.rr ?? 0,
      status: t.status,
      notes: t.comment || "",
      tags: [],
      account: t.accountName,
      accountType: t.accountType,
    }));

    exportJournalExcel(legacyTrades as any, stats as any, currency);
  };

  const handleCsvExport = () => {
    const legacyTrades = filteredTrades.map((t) => ({
      id: t.ticket,
      positionId: t.ticket,
      openTime: t.openTime || t.closeTime,
      closeTime: t.closeTime,
      symbol: t.symbol,
      direction: t.direction,
      lot: t.volume,
      entryPrice: t.openPrice ?? 0,
      exitPrice: t.closePrice,
      pnl: t.profit,
      commission: t.commission,
      swap: t.swap,
      rr: t.rr ?? 0,
      status: t.status,
      notes: t.comment || "",
      tags: [],
      account: t.accountName,
      accountType: t.accountType,
    }));

    exportJournalCSV(legacyTrades as any);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePdfExport}
        disabled={filteredTrades.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-gray-200 text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export Professional Investor-Ready PDF"
      >
        <FileText className="w-3.5 h-3.5 text-brand-400" />
        <span className="hidden sm:inline">PDF Audit Report</span>
      </button>

      <button
        onClick={handleExcelExport}
        disabled={filteredTrades.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-emerald-500/40 text-gray-200 text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export Excel Workbook"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Excel Workbook</span>
      </button>

      <button
        onClick={handleCsvExport}
        disabled={filteredTrades.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-indigo-500/40 text-gray-200 text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export CSV Data"
      >
        <Download className="w-3.5 h-3.5 text-indigo-400" />
        <span className="hidden sm:inline">CSV</span>
      </button>
    </div>
  );
};
