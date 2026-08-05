// lib/reports/report-utils.ts
// TradeFourge v4.1 Report Helpers & Formatters

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function estimateReportFileSize(tradeCount: number, includeCharts: boolean): number {
  const baseSize = 150 * 1024; // 150 KB base PDF
  const perTradeSize = 400; // ~400 bytes per trade
  const chartSize = includeCharts ? 250 * 1024 : 0;
  return baseSize + tradeCount * perTradeSize + chartSize;
}

export function formatReportPeriodLabel(dateRange: string, startDate?: string, endDate?: string): string {
  if (dateRange === "7D") return "Last 7 Days";
  if (dateRange === "30D") return "Last 30 Days";
  if (dateRange === "90D") return "Last 90 Days";
  if (dateRange === "THIS_MONTH") return "Current Month";
  if (dateRange === "THIS_YEAR") return "Year to Date";
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return "All Time History";
}
