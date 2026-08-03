// lib/reports/report-template.ts
// TradeFourge v4.1 Report Template Catalog Definitions

import type { ReportTemplateDefinition } from "./report-types";

export const REPORT_TEMPLATES: ReportTemplateDefinition[] = [
  {
    id: "executive_summary",
    title: "Executive Summary",
    description: "High-level institutional performance audit with key KPIs, win rate, expectancy, and max drawdown.",
    category: "Executive",
    iconName: "ShieldCheck",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: true,
      includeNotes: false,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "Investors, prop firm managers, and executive portfolio reviews",
  },
  {
    id: "monthly_report",
    title: "Monthly Performance Report",
    description: "Detailed monthly breakdown including daily PnL, calendar metrics, weekly performance, and session breakdown.",
    category: "Periodic",
    iconName: "CalendarDays",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: true,
      includeCalendar: true,
      dateRange: "THIS_MONTH",
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "End-of-month trader reviews and historical performance tracking",
  },
  {
    id: "performance_report",
    title: "Comprehensive Performance Audit",
    description: "Deep-dive analytics including equity growth trajectory, drawdown curve, profit distribution, and symbol win rates.",
    category: "Risk & Analytics",
    iconName: "BarChart3",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: true,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "Quantitative strategy reviews and in-depth performance analysis",
  },
  {
    id: "risk_report",
    title: "Risk & Drawdown Report",
    description: "Dedicated risk management analysis covering maximum drawdown, streak losses, risk per trade, and recovery factor.",
    category: "Risk & Analytics",
    iconName: "AlertTriangle",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: false,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "Risk officers, prop firm evaluations, and risk compliance reviews",
  },
  {
    id: "prop_firm_eval",
    title: "Prop Firm Evaluation Audit",
    description: "Audited report structured specifically for prop firm challenge validation, target verification, and drawdown limits.",
    category: "Evaluation",
    iconName: "Award",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: true,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "FTMO, FundingPips, and prop firm challenge verification",
  },
  {
    id: "journal_report",
    title: "Complete Trade Journal Log",
    description: "Full trade-by-trade audit statement with execution prices, volume, profit, commissions, swaps, and notes.",
    category: "Periodic",
    iconName: "TableProperties",
    defaultOptions: {
      includeCharts: false,
      includeTradeList: true,
      includeNotes: true,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "Tax filings, trade log backups, and detailed trade audits",
  },
  {
    id: "custom",
    title: "Custom Configurable Report",
    description: "Fully customizable report builder allowing custom titles, branding, section toggles, and watermarks.",
    category: "Custom",
    iconName: "Sliders",
    defaultOptions: {
      includeCharts: true,
      includeTradeList: true,
      includeNotes: true,
      includeCalendar: true,
      orientation: "portrait",
      paperFormat: "a4",
      pdfTheme: "dark",
    },
    recommendedFor: "Bespoke reports for clients, mentors, and custom presentations",
  },
];

export function getTemplateDefinition(type: string): ReportTemplateDefinition {
  return (
    REPORT_TEMPLATES.find((t) => t.id === type) || REPORT_TEMPLATES[0]
  );
}
