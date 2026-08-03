// lib/reports/pdf-generator.ts
// TradeFourge v4.1 Institutional PDF Generator
// Professional multi-page PDF report renderer using jsPDF & jspdf-autotable.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { getCurrencySymbol, formatMoney, formatMoneySigned } from "@/lib/config/currencies";
import { REPORT_THEMES, BRANDING } from "./report-assets";
import type { PreparedReportData } from "./report-builder";

export function generateInstitutionalPdfReport(data: PreparedReportData): Blob {
  const options = data.options;
  const isLandscape = options.orientation === "landscape";
  const paperFormat = options.paperFormat === "letter" ? "letter" : "a4";
  const theme = REPORT_THEMES[options.pdfTheme || "dark"];
  const sym = getCurrencySymbol(data.currencyCode);

  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: paperFormat,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background color helper
  const drawBackground = () => {
    doc.setFillColor(theme.bgPrimary[0], theme.bgPrimary[1], theme.bgPrimary[2]);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  };

  // PAGE 1: COVER PAGE & EXECUTIVE SUMMARY
  drawBackground();

  // Top Accent Glow Bar
  doc.setFillColor(theme.accentPurple[0], theme.accentPurple[1], theme.accentPurple[2]);
  doc.rect(0, 0, pageWidth, 5, "F");

  // Company Header & Title
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(BRANDING.companyName.toUpperCase(), 14, 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(theme.accentPurple[0], theme.accentPurple[1], theme.accentPurple[2]);
  doc.text(options.title.toUpperCase() || BRANDING.tagline, 14, 29);

  if (options.subtitle) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
    doc.text(options.subtitle, 14, 34);
  }

  // Metadata Box
  const metaY = options.subtitle ? 38 : 34;
  doc.setDrawColor(theme.borderGrid[0], theme.borderGrid[1], theme.borderGrid[2]);
  doc.setFillColor(theme.bgSecondary[0], theme.bgSecondary[1], theme.bgSecondary[2]);
  doc.roundedRect(14, metaY, pageWidth - 28, 22, 3, 3, "FD");

  doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ACCOUNT / PORTFOLIO", 20, metaY + 7);
  doc.text("CURRENCY", 80, metaY + 7);
  doc.text("TOTAL POSITIONS", 125, metaY + 7);
  doc.text("REPORT GENERATED", 170, metaY + 7);

  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(data.accountNamesLabel.slice(0, 30), 20, metaY + 14);
  doc.text(`${data.currencyCode} (${sym})`, 80, metaY + 14);
  doc.text(`${data.filteredTrades.length} Trades`, 125, metaY + 14);
  doc.text(format(new Date(data.generatedDateIso), "yyyy-MM-dd HH:mm"), 170, metaY + 14);

  // EXECUTIVE KPI SUMMARY GRID
  const kpiStartY = metaY + 28;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text("Executive Performance Summary", 14, kpiStartY);

  const stats = data.analytics;

  let peak = 0;
  let maxDdAmount = 0;
  for (const pt of stats.equityCurve || []) {
    if (pt.cumulativeProfit > peak) peak = pt.cumulativeProfit;
    const dd = peak - pt.cumulativeProfit;
    if (dd > maxDdAmount) maxDdAmount = dd;
  }
  const recFactor = maxDdAmount > 0 ? (stats.netProfit / maxDdAmount).toFixed(2) : "N/A";

  autoTable(doc, {
    startY: kpiStartY + 4,
    head: [["Metric Category", "Calculated Value", "Metric Category", "Calculated Value"]],
    body: [
      ["Net Realized Profit", `${formatMoneySigned(stats.netProfit, data.currencyCode)}`, "Win Rate", `${stats.winRate}%`],
      ["Gross Profit", `${formatMoney(stats.grossProfit, data.currencyCode)}`, "Profit Factor", `${stats.profitFactor}`],
      ["Gross Loss", `${formatMoney(stats.grossLoss, data.currencyCode)}`, "Trade Expectancy", `${formatMoneySigned(stats.expectancy, data.currencyCode)} / trade`],
      ["Cumulative Net Profit", `${formatMoneySigned(stats.netProfit, data.currencyCode)}`, "Average R:R", stats.avgRR ? `${stats.avgRR} R` : "N/A"],
      ["Average Win", `${formatMoney(stats.avgWin, data.currencyCode)}`, "Max Drawdown Amount", `${formatMoney(maxDdAmount, data.currencyCode)}`],
      ["Average Loss", `${formatMoney(stats.avgLoss, data.currencyCode)}`, "Recovery Factor", `${recFactor}`],
      ["Largest Single Win", `${formatMoney(stats.largestWin, data.currencyCode)}`, "Long vs Short Ratio", `${stats.longTrades}L / ${stats.shortTrades}S`],
      ["Total Commissions", `${formatMoney(stats.totalCommission, data.currencyCode)}`, "Total Swaps", `${formatMoney(stats.totalSwap, data.currencyCode)}`],
    ],
    theme: "grid",
    headStyles: {
      fillColor: theme.accentPurple,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fillColor: theme.bgSecondary,
      textColor: theme.textPrimary,
      fontSize: 8,
    },
    styles: { cellPadding: 2.5 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  // SYMBOL BREAKDOWN TABLE (If space permits)
  if (stats.symbols && stats.symbols.length > 0 && currentY < pageHeight - 50) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
    doc.text("Top Symbol Breakdown", 14, currentY);

    const topSymbols = stats.symbols.slice(0, 5).map((s) => [
      s.symbol,
      `${s.trades}`,
      `${s.winRate}%`,
      formatMoneySigned(s.netProfit, data.currencyCode),
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [["Symbol", "Trades", "Win Rate %", "Net PnL"]],
      body: topSymbols,
      theme: "grid",
      headStyles: { fillColor: theme.bgCard, textColor: theme.textPrimary, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fillColor: theme.bgSecondary, textColor: theme.textPrimary, fontSize: 8 },
      styles: { cellPadding: 2 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // PAGE 2+: EXECUTED POSITIONS TABLE
  if (options.includeTradeList && data.filteredTrades.length > 0) {
    doc.addPage();
    drawBackground();

    doc.setFillColor(theme.accentPurple[0], theme.accentPurple[1], theme.accentPurple[2]);
    doc.rect(0, 0, pageWidth, 4, "F");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
    doc.text("Executed Positions Log", 14, 15);

    const tableRows = data.filteredTrades.map((t) => [
      t.close_time ? format(parseISO(t.close_time), "yyyy-MM-dd HH:mm") : "-",
      t.ticket || t.id.slice(0, 8),
      t.symbol,
      t.side,
      t.volume,
      t.open_price !== null ? t.open_price : "-",
      t.close_price !== null ? t.close_price : "-",
      formatMoneySigned(t.net_profit, data.currencyCode),
      t.rr_ratio !== null ? `${t.rr_ratio} R` : "-",
      t.outcome || "BREAKEVEN",
    ]);

    autoTable(doc, {
      startY: 20,
      head: [["Close Time", "Ticket", "Symbol", "Side", "Volume", "Open", "Close", "Net PnL", "R:R", "Outcome"]],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: theme.bgCard,
        textColor: theme.textPrimary,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fillColor: theme.bgSecondary,
        textColor: theme.textPrimary,
        fontSize: 7.5,
      },
      styles: { cellPadding: 1.8 },
    });
  }

  // FOOTER & PAGE NUMBERING ACROSS ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(theme.borderGrid[0], theme.borderGrid[1], theme.borderGrid[2]);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);

    doc.text(BRANDING.footerNotice, 14, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 7);
  }

  return doc.output("blob");
}
