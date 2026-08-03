// lib/reports/report-builder.ts
// TradeFourge v4.1 Report Data Package Builder
// Filters trade datasets by user options and builds standardized analytics data packages.

import { calculateCloudAnalytics, CompleteAnalyticsSummary } from "@/lib/engine/cloud-analytics-engine";
import type { CloudTradeWithRelations } from "@/types/database";
import type { ReportOptions } from "./report-types";

export interface PreparedReportData {
  options: ReportOptions;
  filteredTrades: CloudTradeWithRelations[];
  analytics: CompleteAnalyticsSummary;
  accountNamesLabel: string;
  currencyCode: string;
  generatedDateIso: string;
}

export function buildReportDataPackage(
  trades: CloudTradeWithRelations[],
  options: ReportOptions
): PreparedReportData {
  // 1. Account Filtering
  let filtered = trades;
  if (options.accountIds && options.accountIds.length > 0 && !options.accountIds.includes("ALL")) {
    filtered = filtered.filter((t) => t.account_id && options.accountIds.includes(t.account_id));
  }

  // 2. Date Filtering
  if (options.startDate && options.endDate) {
    const startMs = new Date(options.startDate).getTime();
    const endMs = new Date(options.endDate).getTime();
    filtered = filtered.filter((t) => {
      const timeMs = new Date(t.close_time || t.open_time || t.created_at).getTime();
      return timeMs >= startMs && timeMs <= endMs;
    });
  }

  // 3. Analytics Engine Calculation
  const analytics = calculateCloudAnalytics(filtered);

  // 4. Derive Account & Currency Metadata
  const accountNames = Array.from(
    new Set(filtered.map((t) => t.account?.account_name).filter(Boolean))
  );
  const accountNamesLabel =
    accountNames.length > 0
      ? accountNames.join(", ")
      : options.accountIds.includes("ALL") || options.accountIds.length === 0
      ? "All Connected Accounts"
      : "Selected Accounts";

  const currencyCode = filtered[0]?.account?.currency || "USD";

  return {
    options,
    filteredTrades: filtered,
    analytics,
    accountNamesLabel,
    currencyCode,
    generatedDateIso: new Date().toISOString(),
  };
}
