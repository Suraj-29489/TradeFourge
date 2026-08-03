import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NormalizedTrade, EngineStats, AccountCurrency } from "./types";
import { getCurrencySymbol } from "@/lib/config/currencies";
import { format, parseISO } from "date-fns";

export function generateProfessionalPdf(
  trades: NormalizedTrade[],
  stats: EngineStats,
  currency: AccountCurrency = "USD",
  accountName = "Primary Trading Account"
): void {
  const sym = getCurrencySymbol(currency);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette
  const primaryBg = [11, 15, 23];
  const accentPurple = [124, 58, 237];
  const textWhite = [255, 255, 255];
  const textMuted = [156, 163, 175];
  const gridBorder = [31, 41, 61];

  // PAGE 1: COVER PAGE & EXECUTIVE SUMMARY
  doc.setFillColor(primaryBg[0], primaryBg[1], primaryBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Glowing Top Header Bar
  doc.setFillColor(accentPurple[0], accentPurple[1], accentPurple[2]);
  doc.rect(0, 0, pageWidth, 6, "F");

  // Title
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("TRADEFOURGE", 14, 25);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(167, 139, 250);
  doc.text("INSTITUTIONAL PERFORMANCE REPORT & TRADE AUDIT", 14, 32);

  // Metadata Box
  doc.setDrawColor(gridBorder[0], gridBorder[1], gridBorder[2]);
  doc.setFillColor(17, 23, 38);
  doc.roundedRect(14, 40, pageWidth - 28, 24, 3, 3, "FD");

  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFontSize(8);
  doc.text("ACCOUNT NAME", 20, 48);
  doc.text("CURRENCY", 80, 48);
  doc.text("TOTAL POSITIONS", 130, 48);
  doc.text("REPORT DATE", 170, 48);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(accountName, 20, 56);
  doc.text(`${currency} (${trades[0]?.accountType || "Standard"})`, 80, 56);
  doc.text(`${stats.totalTrades}`, 130, 56);
  doc.text(format(new Date(), "yyyy-MM-dd"), 170, 56);

  // Executive Metrics Cards
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text("Executive Performance Summary", 14, 74);

  autoTable(doc, {
    startY: 78,
    head: [["Metric Category", "Calculated Value", "Metric Category", "Calculated Value"]],
    body: [
      ["Net Realized Profit", `${sym}${stats.netProfit.toLocaleString()}`, "Win Rate", `${stats.winRate}%`],
      ["Gross Profit", `${sym}${stats.grossProfit.toLocaleString()}`, "Profit Factor", `${stats.profitFactor}`],
      ["Gross Loss", `${sym}${stats.grossLoss.toLocaleString()}`, "Trade Expectancy", `${sym}${stats.expectancy} / trade`],
      ["Ending Equity Balance", `${sym}${stats.balance.toLocaleString()}`, "Average R:R", stats.averageRR !== null ? `${stats.averageRR} R` : "N/A"],
      ["Average Win", `${sym}${stats.averageWin}`, "Avg Hold Time", stats.averageHoldTime],
      ["Average Loss", `${sym}${stats.averageLoss}`, "Best Win Streak", `${stats.bestStreak} Wins`],
      ["Largest Single Win", `${sym}${stats.largestWin}`, "Worst Loss Streak", `${stats.worstStreak} Losses`],
      ["Total Commissions", `${sym}${stats.totalCommission}`, "Total Swaps", `${sym}${stats.totalSwap}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fillColor: [17, 23, 38], textColor: [230, 235, 245], fontSize: 8.5 },
    alternateRowStyles: { fillColor: [24, 34, 56] },
  });

  // Long vs Short Analysis
  const finalY1 = (doc as any).lastAutoTable.finalY || 160;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text("Directional & Instrument Analysis", 14, finalY1 + 10);

  const longTrades = trades.filter((t) => t.direction === "LONG");
  const shortTrades = trades.filter((t) => t.direction === "SHORT");
  const longWins = longTrades.filter((t) => t.profit > 0).length;
  const shortWins = shortTrades.filter((t) => t.profit > 0).length;

  autoTable(doc, {
    startY: finalY1 + 14,
    head: [["Direction", "Count", "Win Rate %", "Net PnL"]],
    body: [
      [
        "LONG Positions",
        `${longTrades.length}`,
        `${longTrades.length > 0 ? ((longWins / longTrades.length) * 100).toFixed(1) : 0}%`,
        `${sym}${longTrades.reduce((acc, t) => acc + t.profit, 0).toLocaleString()}`,
      ],
      [
        "SHORT Positions",
        `${shortTrades.length}`,
        `${shortTrades.length > 0 ? ((shortWins / shortTrades.length) * 100).toFixed(1) : 0}%`,
        `${sym}${shortTrades.reduce((acc, t) => acc + t.profit, 0).toLocaleString()}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [31, 41, 61], textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { fillColor: [17, 23, 38], textColor: [230, 235, 245], fontSize: 8.5 },
  });

  // PAGE 2+: EXECUTED POSITIONS LOG
  doc.addPage();

  doc.setFillColor(primaryBg[0], primaryBg[1], primaryBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(accentPurple[0], accentPurple[1], accentPurple[2]);
  doc.rect(0, 0, pageWidth, 4, "F");

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.text("Executed Positions Log", 14, 16);

  const tableRows = trades.map((t) => [
    t.closeTime ? format(parseISO(t.closeTime), "yyyy-MM-dd HH:mm") : "-",
    t.ticket,
    t.symbol,
    t.direction,
    t.volume,
    t.openPrice !== null ? t.openPrice : "-",
    t.closePrice,
    `${t.profit >= 0 ? "+" : ""}${sym}${t.profit}`,
    t.rr !== null ? `${t.rr} R` : "N/A",
    t.status,
  ]);

  autoTable(doc, {
    startY: 20,
    head: [["Close Date", "Ticket", "Symbol", "Type", "Lot", "Entry", "Exit", "Net PnL", "R:R", "Status"]],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [31, 41, 61], textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { fillColor: [17, 23, 38], textColor: [230, 235, 245], fontSize: 8 },
    alternateRowStyles: { fillColor: [24, 34, 56] },
    columnStyles: {
      7: { fontStyle: "bold" },
    },
  });

  // Page Numbers Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`TradeFourge Performance Audit  •  Page ${i} of ${totalPages}`, pageWidth - 70, pageHeight - 10);
  }

  doc.save(`TradeFourge_Audit_${format(new Date(), "yyyyMMdd")}.pdf`);
}
