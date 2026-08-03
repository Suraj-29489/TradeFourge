// lib/reports/report-engine.ts
// TradeFourge v4.1 Main Reporting Engine API
// Public entry point for building, rendering, and exporting institutional reports.

import { buildReportDataPackage, PreparedReportData } from "./report-builder";
import { exportReportPdf, exportReportCsv, fetchReportHistory, deleteReportHistoryEntry } from "./report-export";
import type { CloudTradeWithRelations } from "@/types/database";
import type { ReportOptions, ReportHistoryEntry } from "./report-types";

export class ReportEngine {
  public static prepareReport(
    trades: CloudTradeWithRelations[],
    options: ReportOptions
  ): PreparedReportData {
    return buildReportDataPackage(trades, options);
  }

  public static exportPdf(userId: string, trades: CloudTradeWithRelations[], options: ReportOptions): void {
    const dataPackage = this.prepareReport(trades, options);
    exportReportPdf(userId, dataPackage);
  }

  public static exportCsv(userId: string, trades: CloudTradeWithRelations[], options: ReportOptions): void {
    const dataPackage = this.prepareReport(trades, options);
    exportReportCsv(userId, dataPackage);
  }

  public static getHistory(userId: string): ReportHistoryEntry[] {
    return fetchReportHistory(userId);
  }

  public static deleteHistoryItem(userId: string, id: string): void {
    deleteReportHistoryEntry(userId, id);
  }
}
