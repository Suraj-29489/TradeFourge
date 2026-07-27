// lib/export/cloud-exporter.ts
// Production export utilities for cloud trades: JSON, CSV, Excel.

import * as XLSX from "xlsx";
import Papa from "papaparse";
import { format, parseISO } from "date-fns";
import type { CloudTradeWithRelations } from "@/types/database";

/**
 * Export cloud trades as formatted JSON.
 */
export function exportCloudJSON(trades: CloudTradeWithRelations[], filename = "tradefourge_cloud_journal") {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    totalTrades: trades.length,
    trades,
  };
  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${format(new Date(), "yyyyMMdd_HHmm")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export cloud trades as CSV file.
 */
export function exportCloudCSV(trades: CloudTradeWithRelations[], filename = "tradefourge_cloud_journal") {
  const rows = trades.map((t) => ({
    Ticket: t.ticket || t.id,
    Symbol: t.symbol,
    Side: t.side,
    Volume: t.volume,
    "Open Price": t.open_price ?? "",
    "Close Price": t.close_price ?? "",
    "Stop Loss": t.stop_loss ?? "",
    "Take Profit": t.take_profit ?? "",
    "Open Time": t.open_time ? format(parseISO(t.open_time), "yyyy-MM-dd HH:mm:ss") : "",
    "Close Time": t.close_time ? format(parseISO(t.close_time), "yyyy-MM-dd HH:mm:ss") : "",
    "Net Profit ($)": t.net_profit,
    "Commission ($)": t.commission,
    "Swap ($)": t.swap,
    "R:R Ratio": t.rr_ratio ?? "",
    Outcome: t.outcome ?? "",
    Strategy: t.strategy ?? "",
    Session: t.session ?? "",
    Notes: t.notes ?? "",
    Source: t.source,
    Account: t.account?.account_name ?? "",
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export cloud trades as Excel workbook with Summary tab + Detailed Log tab.
 */
export function exportCloudExcel(
  trades: CloudTradeWithRelations[],
  currency = "USD",
  filename = "tradefourge_cloud_journal"
) {
  const wb = XLSX.utils.book_new();

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.net_profit > 0).length;
  const losses = trades.filter((t) => t.net_profit < 0).length;
  const netProfit = trades.reduce((sum, t) => sum + t.net_profit, 0);
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0";

  // Summary Tab
  const summaryData = [
    ["TRADEFOURGE CLOUD JOURNAL AUDIT REPORT"],
    ["Generated At", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
    ["Currency", currency],
    [""],
    ["METRIC", "VALUE"],
    ["Total Trades", totalTrades],
    ["Winning Trades", wins],
    ["Losing Trades", losses],
    ["Win Rate", `${winRate}%`],
    ["Total Net Profit", `${currency} ${netProfit.toFixed(2)}`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Positions Log Tab
  const tradeRows = trades.map((t) => ({
    Ticket: t.ticket || t.id.slice(0, 8),
    Symbol: t.symbol,
    Side: t.side,
    Volume: t.volume,
    "Open Price": t.open_price ?? "",
    "Close Price": t.close_price ?? "",
    "Stop Loss": t.stop_loss ?? "",
    "Take Profit": t.take_profit ?? "",
    "Open Time": t.open_time ? format(parseISO(t.open_time), "yyyy-MM-dd HH:mm:ss") : "",
    "Close Time": t.close_time ? format(parseISO(t.close_time), "yyyy-MM-dd HH:mm:ss") : "",
    [`Net Profit (${currency})`]: t.net_profit,
    [`Commission (${currency})`]: t.commission,
    [`Swap (${currency})`]: t.swap,
    "R:R": t.rr_ratio ?? "",
    Outcome: t.outcome ?? "",
    Strategy: t.strategy ?? "",
    Session: t.session ?? "",
    Notes: t.notes ?? "",
    Account: t.account?.account_name ?? "",
  }));

  const wsTrades = XLSX.utils.json_to_sheet(tradeRows);
  XLSX.utils.book_append_sheet(wb, wsTrades, "Positions Log");

  XLSX.writeFile(wb, `${filename}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}
