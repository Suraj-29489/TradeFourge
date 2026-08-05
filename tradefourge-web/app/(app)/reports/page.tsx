"use client";
// app/(app)/reports/page.tsx
// TradeFourge v4.1 Professional Reports Hub

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrades } from "@/lib/supabase/trades";
import { fetchTradingAccounts } from "@/lib/supabase/accounts";
import { calculateCloudAnalytics, CompleteAnalyticsSummary } from "@/lib/engine/cloud-analytics-engine";
import { REPORT_TEMPLATES } from "@/lib/reports/report-template";
import { ReportGeneratorModal } from "@/components/reports/ReportGeneratorModal";
import { ReportHistoryTable } from "@/components/reports/ReportHistoryTable";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import type { CloudTradeWithRelations, TradingAccount } from "@/types/database";
import type { ReportTemplateType } from "@/lib/reports/report-types";
import {
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  FileText,
  Download,
  Plus,
  BarChart3,
  CalendarDays,
  AlertTriangle,
  Award,
  TableProperties,
  Sliders,
  History,
  Sparkles,
} from "lucide-react";

export default function ReportsPage() {
  const { formatSigned } = useCurrencyFormatter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [trades, setTrades] = useState<CloudTradeWithRelations[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"templates" | "history">("templates");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ReportTemplateType>("executive_summary");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const [tradesRes, accsRes] = await Promise.all([
          fetchTrades(user.id, {}, 1, 10000, "close_time", false),
          fetchTradingAccounts(user.id),
        ]);
        setTrades(tradesRes.data?.data ?? []);
        setAccounts(accsRes.data ?? []);
      } else {
        setTrades([]);
        setAccounts([]);
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
      setTrades([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats: CompleteAnalyticsSummary = calculateCloudAnalytics(trades);

  const openGenerator = (templateId: ReportTemplateType) => {
    setSelectedTemplateId(templateId);
    setModalOpen(true);
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case "ShieldCheck": return ShieldCheck;
      case "CalendarDays": return CalendarDays;
      case "BarChart3": return BarChart3;
      case "AlertTriangle": return AlertTriangle;
      case "Award": return Award;
      case "TableProperties": return TableProperties;
      default: return Sliders;
    }
  };

  return (
    <div className="space-y-6 text-xs font-mono">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Professional Reports Engine
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
              v4.1 RELEASE
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate institutional-grade PDF and CSV audit statements for investors, prop firms, and personal performance reviews.
          </p>
        </div>

        <button
          onClick={() => openGenerator("executive_summary")}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 shrink-0 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New Report</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border pb-3">
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "templates"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Report Templates ({REPORT_TEMPLATES.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "bg-purple-600/20 border border-purple-500/30 text-purple-300"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Report History Log</span>
        </button>
      </div>

      {/* TAB 1: REPORT TEMPLATES GRID */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_TEMPLATES.map((tmpl) => {
              const IconComp = getTemplateIcon(tmpl.iconName);
              return (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-2xl glass-card border border-dark-border hover:border-purple-500/40 transition-all flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                        {tmpl.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        {tmpl.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 truncate max-w-[180px]">
                      {tmpl.recommendedFor}
                    </span>
                    <button
                      onClick={() => openGenerator(tmpl.id)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-[11px] flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <span>Configure</span>
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: REPORT HISTORY */}
      {activeTab === "history" && userId && (
        <ReportHistoryTable userId={userId} trades={trades} />
      )}

      {/* Generator Modal */}
      {userId && (
        <ReportGeneratorModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={userId}
          trades={trades}
          accounts={accounts}
          initialTemplateId={selectedTemplateId}
          onReportGenerated={loadData}
        />
      )}
    </div>
  );
}
