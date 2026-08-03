// lib/reports/report-types.ts
// TradeFourge v4.1 Professional Reports Engine — Core Types & Interface Definitions

export type ReportTemplateType =
  | "executive_summary"
  | "monthly_report"
  | "performance_report"
  | "risk_report"
  | "journal_report"
  | "prop_firm_eval"
  | "custom";

export type PaperFormat = "a4" | "letter";
export type PageOrientation = "portrait" | "landscape";
export type PdfTheme = "dark" | "light";

export interface ReportOptions {
  templateType: ReportTemplateType;
  title: string;
  subtitle?: string;
  dateRange: "7D" | "30D" | "90D" | "THIS_MONTH" | "THIS_YEAR" | "ALL" | "CUSTOM";
  startDate?: string;
  endDate?: string;
  accountIds: string[];
  includeCharts: boolean;
  includeTradeList: boolean;
  includeNotes: boolean;
  includeCalendar: boolean;
  includeScreenshots: boolean;
  logoUrl?: string;
  watermarkText?: string;
  orientation: PageOrientation;
  paperFormat: PaperFormat;
  pdfTheme: PdfTheme;
  customNotes?: string;
}

export interface ReportTemplateDefinition {
  id: ReportTemplateType;
  title: string;
  description: string;
  category: "Executive" | "Periodic" | "Risk & Analytics" | "Evaluation" | "Custom";
  iconName: string;
  defaultOptions: Partial<ReportOptions>;
  recommendedFor: string;
}

export interface ReportHistoryEntry {
  id: string;
  userId: string;
  title: string;
  templateType: ReportTemplateType;
  templateName: string;
  accountsCount: number;
  tradeCount: number;
  periodLabel: string;
  generatedAt: string;
  fileSizeBytes: number;
  currency: string;
  format: "PDF" | "CSV";
}
