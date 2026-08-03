// lib/reports/csv-generator.ts
// TradeFourge v4.1 CSV Report Exporter
// Generates raw trade log CSV statement files.

import type { PreparedReportData } from "./report-builder";
import { formatMoney } from "@/lib/config/currencies";

export function generateReportCsv(data: PreparedReportData): string {
  const headers = [
    "Ticket",
    "Close Time",
    "Open Time",
    "Account",
    "Symbol",
    "Side",
    "Volume",
    "Open Price",
    "Close Price",
    "Profit",
    "Commission",
    "Swap",
    "Net Profit",
    "Outcome",
    "Strategy",
    "Notes",
  ];

  const rows = data.filteredTrades.map((t) => [
    t.ticket || t.id.slice(0, 8),
    t.close_time || "",
    t.open_time || "",
    t.account?.account_name || "Cloud Account",
    t.symbol,
    t.side,
    t.volume,
    t.open_price ?? "",
    t.close_price ?? "",
    t.profit,
    t.commission,
    t.swap,
    t.net_profit,
    t.outcome,
    t.strategy || "",
    (t.notes || "").replace(/"/g, '""'),
  ]);

  const csvContent = [
    `# TradeFourge Report Statement: ${data.options.title}`,
    `# Generated Date: ${data.generatedDateIso}`,
    `# Account: ${data.accountNamesLabel}`,
    `# Currency: ${data.currencyCode}`,
    `# Total Trades: ${data.filteredTrades.length}`,
    headers.join(","),
    ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
