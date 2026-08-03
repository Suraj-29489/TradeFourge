// lib/export/import-report-exporter.ts
// TradeFourge CSV Import Engine 2.0: Report Exporter Engine (CSV & PDF)

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface FinalImportReportData {
  filename: string;
  accountName: string;
  currency: string;
  broker: string;
  platform: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  duplicateCount: number;
  warningCount: number;
  timeTakenSeconds: number;
  completedAt: string;
  errors: { rowNumber: number; field: string; message: string }[];
  warnings: string[];
}

/**
 * Exports the Import Report as a CSV file.
 */
export function exportImportReportCsv(data: FinalImportReportData): void {
  const rows: string[] = [];

  rows.push("TRADEFOURGE CSV IMPORT AUDIT REPORT");
  rows.push(`Completed At,${data.completedAt}`);
  rows.push(`Filename,${data.filename}`);
  rows.push(`Trading Account,${data.accountName}`);
  rows.push(`Currency,${data.currency}`);
  rows.push(`Broker,${data.broker}`);
  rows.push(`Platform,${data.platform}`);
  rows.push(`Time Taken,${data.timeTakenSeconds.toFixed(2)}s`);
  rows.push("");
  rows.push("SUMMARY METRICS");
  rows.push(`Total Rows,${data.totalRows}`);
  rows.push(`Imported Rows,${data.importedRows}`);
  rows.push(`Skipped Rows,${data.skippedRows}`);
  rows.push(`Failed Rows,${data.failedRows}`);
  rows.push(`Duplicate Trades,${data.duplicateCount}`);
  rows.push(`Warnings Count,${data.warningCount}`);
  rows.push("");

  if (data.errors.length > 0) {
    rows.push("ROW FAILURE LOGS");
    rows.push("Row #,Field,Failure Reason");
    data.errors.forEach((err) => {
      rows.push(`${err.rowNumber},"${err.field}","${err.message.replace(/"/g, '""')}"`);
    });
    rows.push("");
  }

  if (data.warnings.length > 0) {
    rows.push("IMPORT WARNINGS LOG");
    rows.push("Warning Message");
    data.warnings.forEach((warn) => {
      rows.push(`"${warn.replace(/"/g, '""')}"`);
    });
  }

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", `TradeFourge_Import_Report_${data.filename.replace(".csv", "")}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports the Import Report as a professional PDF audit document.
 */
export function exportImportReportPdf(data: FinalImportReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary Theme Colors
  const primaryBg = [11, 15, 23];
  const accentPurple = [124, 58, 237];
  const textWhite = [255, 255, 255];
  const textMuted = [156, 163, 175];
  const gridBorder = [31, 41, 61];

  // Header Bar
  doc.setFillColor(accentPurple[0], accentPurple[1], accentPurple[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(31, 41, 61);
  doc.text("TRADEFOURGE", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(124, 58, 237);
  doc.text("INSTITUTIONAL STATEMENT IMPORT AUDIT REPORT", 14, 26);

  // Metadata Box
  doc.setDrawColor(gridBorder[0], gridBorder[1], gridBorder[2]);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 32, pageWidth - 28, 24, 2, 2, "FD");

  doc.setTextColor(100, 110, 125);
  doc.setFontSize(8);
  doc.text("TRADING ACCOUNT", 20, 40);
  doc.text("BROKER / PLATFORM", 75, 40);
  doc.text("FILENAME / SIZE", 130, 40);

  doc.setTextColor(31, 41, 61);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.accountName} (${data.currency})`, 20, 48);
  doc.text(`${data.broker} · ${data.platform}`, 75, 48);
  doc.text(data.filename, 130, 48);

  // Summary Metrics Table
  autoTable(doc, {
    startY: 62,
    head: [["Import Metric", "Count / Value", "Import Metric", "Count / Value"]],
    body: [
      ["Total Rows Processed", `${data.totalRows}`, "Time Taken", `${data.timeTakenSeconds.toFixed(2)} seconds`],
      ["Successfully Imported", `${data.importedRows} trades`, "Skipped Rows", `${data.skippedRows} rows`],
      ["Failed Rows", `${data.failedRows} rows`, "Duplicates Detected", `${data.duplicateCount} trades`],
      ["Warnings Logged", `${data.warningCount} warnings`, "Completion Date", data.completedAt.substring(0, 19).replace("T", " ")],
    ],
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fillColor: [255, 255, 255], textColor: [31, 41, 61], fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Row Error Logs Table (if errors exist)
  if (data.errors.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(225, 29, 72);
    doc.text("Row Failure Audit Logs", 14, finalY + 10);

    const errorRows = data.errors.map((e) => [`Row ${e.rowNumber}`, e.field, e.message]);

    autoTable(doc, {
      startY: finalY + 14,
      head: [["Row #", "Field", "Failure Explanation"]],
      body: errorRows,
      theme: "grid",
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { textColor: [31, 41, 61], fontSize: 8 },
    });
  }

  doc.save(`TradeFourge_Import_Audit_${data.filename.replace(".csv", "")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
