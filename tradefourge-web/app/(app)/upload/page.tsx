"use client";

import React from "react";
import { CsvUploader } from "@/components/upload/CsvUploader";
import { JournalManager } from "@/components/upload/JournalManager";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { FileSpreadsheet, Building2, Coins, ArrowRight } from "lucide-react";
import { getCurrencyShortLabel } from "@/lib/config/currencies";

export default function UploadPage() {
  const { activeAccount } = useActiveAccount();

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono text-gray-200">
      {/* Current Active Account Header Strip */}
      <div className="p-5 rounded-2xl bg-[#0F141C] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              <span>CSV WORKSPACE</span>
            </span>
          </div>
          <h1 className="text-xl font-bold text-white font-sans">
            {activeAccount?.account_name || "Personal CSV Workspace"}
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-300 bg-white/[0.02] px-4 py-2.5 rounded-xl border border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span>Broker: <strong className="text-white">{activeAccount?.broker || "CSV"}</strong></span>
          </div>
          <span className="text-gray-600">·</span>
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-gray-400" />
            <span>Currency: <strong className="text-white">{getCurrencyShortLabel(activeAccount?.currency || "USD")}</strong></span>
          </div>
        </div>
      </div>

      {/* Main CSV Uploader Engine */}
      <CsvUploader />

      {/* Existing Import History Journal Manager */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08]">
        <JournalManager />
      </div>
    </div>
  );
}
