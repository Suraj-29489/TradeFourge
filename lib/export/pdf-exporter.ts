import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trade, TradeStats, AccountCurrency } from "@/types/trade";
import { format, parseISO } from "date-fns";

export function exportJournalPDF(
  trades: Trade[],
  stats: TradeStats,
  currency: AccountCurrency = "USD",
  accountName = "Exness Account"
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // 1. Header & Branding Banner
  doc.setFillColor(15, 20, 32); // Bloomberg dark header background
  doc.rect(0, 0, 210, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("TRADING JOURNAL", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(167, 139, 250); // Violet text
  doc.text("AUDITED TRADING PERFORMANCE & EXECUTION REPORT", 14, 25);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`, 140, 18);
  doc.text(`Account: ${accountName} (${currency})`, 140, 25);

  // 2. Summary Stat Cards Grid
  doc.setTextColor(20, 20, 30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Performance Summary", 14, 48);

  autoTable(doc, {
    startY: 52,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Net Profit", `${currency} ${stats.totalNetProfit.toLocaleString()}`, "Win Rate", `${stats.winRate}%`],
      ["Gross Profit", `${currency} ${stats.grossProfit.toLocaleString()}`, "Profit Factor", `${stats.profitFactor}`],
      ["Gross Loss", `${currency} ${stats.grossLoss.toLocaleString()}`, "Average RR", `${stats.averageRR} R`],
      ["Account Balance", `${currency} ${stats.balance.toLocaleString()}`, "Expectancy", `${currency} ${stats.expectancy} / trade`],
      ["Total Positions", `${stats.totalTrades}`, "Avg Hold Time", stats.averageHoldTime],
      ["Wins / Losses", `${stats.winningTrades} W / ${stats.losingTrades} L`, "Best Streak", `${stats.bestStreak} Wins`],
    ],
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // 3. Trade Records Table
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Executed Positions Log", 14, finalY + 12);

  const tableRows = trades.map((t) => [
    format(parseISO(t.closeTime), "yyyy-MM-dd HH:mm"),
    t.positionId,
    t.symbol,
    t.direction,
    t.lot,
    t.entryPrice,
    t.exitPrice,
    `${t.pnl >= 0 ? "+" : ""}${currency} ${t.pnl}`,
    `${t.rr} R`,
    t.status,
  ]);

  autoTable(doc, {
    startY: finalY + 16,
    head: [["Date Time", "Ticket", "Symbol", "Type", "Lot", "Entry", "Exit", "PnL", "R:R", "Status"]],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [31, 41, 61], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      7: { fontStyle: "bold" },
    },
  });

  doc.save(`Trading_Journal_Report_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
