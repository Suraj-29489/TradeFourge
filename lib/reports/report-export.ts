// lib/reports/report-export.ts
// TradeFourge v4.1 Report Export Manager & History Persistence
// Handles PDF/CSV generation, file downloads, and history record persistence.

import { generateInstitutionalPdfReport } from "./pdf-generator";
import { generateReportCsv } from "./csv-generator";
import { formatBytes, formatReportPeriodLabel, estimateReportFileSize } from "./report-utils";
import { getTemplateDefinition } from "./report-template";
import type { PreparedReportData } from "./report-builder";
import type { ReportHistoryEntry } from "./report-types";

function getHistoryStorageKey(userId: string): string {
  return `tf_reports_history_${userId || "default_user"}`;
}

export function fetchReportHistory(userId: string): ReportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getHistoryStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteReportHistoryEntry(userId: string, id: string): void {
  if (typeof window === "undefined") return;
  const existing = fetchReportHistory(userId);
  const updated = existing.filter((e) => e.id !== id);
  try {
    localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[ReportExport] Failed to delete history entry:", err);
  }
}

export function exportReportPdf(userId: string, data: PreparedReportData): void {
  const pdfBlob = generateInstitutionalPdfReport(data);
  const fileName = `${data.options.title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.pdf`;

  // Download Trigger
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Record History Entry
  const templateDef = getTemplateDefinition(data.options.templateType);
  const entry: ReportHistoryEntry = {
    id: `REP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    userId,
    title: data.options.title,
    templateType: data.options.templateType,
    templateName: templateDef.title,
    accountsCount: data.options.accountIds.includes("ALL") ? 0 : data.options.accountIds.length,
    tradeCount: data.filteredTrades.length,
    periodLabel: formatReportPeriodLabel(data.options.dateRange, data.options.startDate, data.options.endDate),
    generatedAt: new Date().toISOString(),
    fileSizeBytes: pdfBlob.size || estimateReportFileSize(data.filteredTrades.length, data.options.includeCharts),
    currency: data.currencyCode,
    format: "PDF",
  };

  const existing = fetchReportHistory(userId);
  const updated = [entry, ...existing].slice(0, 50);
  try {
    localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[ReportExport] Failed to save history entry:", err);
  }
}

export function exportReportCsv(userId: string, data: PreparedReportData): void {
  const csvContent = generateReportCsv(data);
  const fileName = `${data.options.title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const templateDef = getTemplateDefinition(data.options.templateType);
  const entry: ReportHistoryEntry = {
    id: `REP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    userId,
    title: data.options.title,
    templateType: data.options.templateType,
    templateName: templateDef.title,
    accountsCount: data.options.accountIds.includes("ALL") ? 0 : data.options.accountIds.length,
    tradeCount: data.filteredTrades.length,
    periodLabel: formatReportPeriodLabel(data.options.dateRange, data.options.startDate, data.options.endDate),
    generatedAt: new Date().toISOString(),
    fileSizeBytes: blob.size,
    currency: data.currencyCode,
    format: "CSV",
  };

  const existing = fetchReportHistory(userId);
  const updated = [entry, ...existing].slice(0, 50);
  try {
    localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error("[ReportExport] Failed to save history entry:", err);
  }
}
