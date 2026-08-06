"use client";
// components/reports/ReportGeneratorModal.tsx
// TradeFourge v4.1 Report Generator & Customization Wizard Modal

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { REPORT_TEMPLATES, getTemplateDefinition } from "@/lib/reports/report-template";
import { ReportEngine } from "@/lib/reports/report-engine";
import type { CloudTradeWithRelations, TradingAccount } from "@/types/database";
import type { ReportOptions, ReportTemplateType, PaperFormat, PageOrientation, PdfTheme } from "@/lib/reports/report-types";
import {
  FileText,
  Sliders,
  CheckCircle2,
  Download,
  Calendar,
  Wallet,
  Settings,
  Layers,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";

interface ReportGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  trades: CloudTradeWithRelations[];
  accounts: TradingAccount[];
  initialTemplateId?: ReportTemplateType;
  onReportGenerated?: () => void;
}

export function ReportGeneratorModal({
  open,
  onClose,
  userId,
  trades,
  accounts,
  initialTemplateId = "executive_summary",
  onReportGenerated,
}: ReportGeneratorModalProps) {
  const [templateType, setTemplateType] = useState<ReportTemplateType>(initialTemplateId);
  const [title, setTitle] = useState("Executive Performance Audit");
  const [subtitle, setSubtitle] = useState("TradeFourge Institutional Intelligence Report");
  const [dateRange, setDateRange] = useState<ReportOptions["dateRange"]>("ALL");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ALL");
  const [exportFormat, setExportFormat] = useState<"PDF" | "CSV">("PDF");

  // Options Toggles
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTradeList, setIncludeTradeList] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeCalendar, setIncludeCalendar] = useState(true);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>("dark");
  const [watermarkText, setWatermarkText] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      const def = getTemplateDefinition(initialTemplateId);
      setTemplateType(initialTemplateId);
      setTitle(def.title);
      setIncludeCharts(def.defaultOptions.includeCharts ?? true);
      setIncludeTradeList(def.defaultOptions.includeTradeList ?? true);
      setIncludeNotes(def.defaultOptions.includeNotes ?? false);
      setIncludeCalendar(def.defaultOptions.includeCalendar ?? true);
      if (def.defaultOptions.dateRange) setDateRange(def.defaultOptions.dateRange);
    }
  }, [open, initialTemplateId]);

  const handleTemplateChange = (tId: ReportTemplateType) => {
    setTemplateType(tId);
    const def = getTemplateDefinition(tId);
    setTitle(def.title);
    setIncludeCharts(def.defaultOptions.includeCharts ?? true);
    setIncludeTradeList(def.defaultOptions.includeTradeList ?? true);
    setIncludeNotes(def.defaultOptions.includeNotes ?? false);
    setIncludeCalendar(def.defaultOptions.includeCalendar ?? true);
  };

  const handleGenerate = () => {
    setIsGenerating(true);

    try {
      const options: ReportOptions = {
        templateType,
        title,
        subtitle: subtitle || undefined,
        dateRange,
        accountIds: selectedAccountId === "ALL" ? ["ALL"] : [selectedAccountId],
        includeCharts,
        includeTradeList,
        includeNotes,
        includeCalendar,
        includeScreenshots: false,
        watermarkText: watermarkText || undefined,
        orientation,
        paperFormat,
        pdfTheme,
      };

      if (exportFormat === "PDF") {
        ReportEngine.exportPdf(userId, trades, options);
      } else {
        ReportEngine.exportCsv(userId, trades, options);
      }

      if (onReportGenerated) onReportGenerated();
      onClose();
    } catch (err) {
      console.error("[ReportGeneratorModal] Error generating report:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 font-mono";
  const labelClass = "block text-xs font-mono text-gray-400 mb-1";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Professional Report"
      description="Customize and export an institutional-grade PDF or CSV performance audit statement"
      size="xl"
    >
      <div className="space-y-5 font-mono">
        {/* Template Selector */}
        <div>
          <label className={labelClass}>Select Report Template</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {REPORT_TEMPLATES.map((t) => {
              const isSelected = t.id === templateType;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplateChange(t.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-blue-600/15 border-blue-500 text-white shadow-glow"
                      : "bg-dark-card border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="font-bold text-xs block truncate">{t.title}</span>
                  <span className="text-[9px] text-gray-500 block truncate">{t.category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Configurations Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div>
            <label className={labelClass}>Report Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Subtitle / Branding Notice</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Filtered Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Trading Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} ({a.broker} · {a.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Time Period</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className={inputClass}
            >
              <option value="ALL">All Time History</option>
              <option value="THIS_MONTH">Current Month</option>
              <option value="THIS_YEAR">Year to Date (YTD)</option>
              <option value="30D">Last 30 Days</option>
              <option value="90D">Last 90 Days</option>
              <option value="7D">Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* Styling & Layout Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Export Format</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportFormat("PDF")}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold ${
                  exportFormat === "PDF"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-dark-card border-white/10 text-gray-400"
                }`}
              >
                PDF Report
              </button>
              <button
                type="button"
                onClick={() => setExportFormat("CSV")}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold ${
                  exportFormat === "CSV"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-dark-card border-white/10 text-gray-400"
                }`}
              >
                CSV Log
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>PDF Theme</label>
            <select
              value={pdfTheme}
              onChange={(e) => setPdfTheme(e.target.value as PdfTheme)}
              disabled={exportFormat !== "PDF"}
              className={inputClass}
            >
              <option value="dark">Institutional Dark Mode</option>
              <option value="light">Print Light Mode</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Paper Format & Orientation</label>
            <select
              value={`${paperFormat}-${orientation}`}
              onChange={(e) => {
                const [p, o] = e.target.value.split("-");
                setPaperFormat(p as PaperFormat);
                setOrientation(o as PageOrientation);
              }}
              disabled={exportFormat !== "PDF"}
              className={inputClass}
            >
              <option value="a4-portrait">A4 — Portrait</option>
              <option value="a4-landscape">A4 — Landscape</option>
              <option value="letter-portrait">US Letter — Portrait</option>
              <option value="letter-landscape">US Letter — Landscape</option>
            </select>
          </div>
        </div>

        {/* Section Toggles */}
        <div className="p-3 rounded-xl bg-dark-card border border-white/10 space-y-2">
          <span className="text-[11px] text-gray-400 font-bold block">Include Report Sections</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="accent-blue-500"
              />
              <span>Charts & Visuals</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTradeList}
                onChange={(e) => setIncludeTradeList(e.target.checked)}
                className="accent-blue-500"
              />
              <span>Trade Log Table</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="accent-blue-500"
              />
              <span>Trade Notes</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCalendar}
                onChange={(e) => setIncludeCalendar(e.target.checked)}
                className="accent-blue-500"
              />
              <span>Calendar Heatmap</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || trades.length === 0}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Generate & Download {exportFormat}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
