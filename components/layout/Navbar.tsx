"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { ExportToolbar } from "@/components/export/ExportToolbar";
import { Upload, Wallet, Moon, ShieldCheck } from "lucide-react";

export const Navbar: React.FC = () => {
  const init = useJournalStore((state) => state.init);
  const setSelectedAccount = useJournalStore((state) => state.setSelectedAccount);
  const accountType = useJournalStore((state) => state.accountType);
  const accountBalance = useJournalStore((state) => state.accountBalance);

  const { selectedAccount, accounts, stats } = useJournalMetrics();
  const { format, formatSigned } = useCurrencyFormatter();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-6 bg-[#080B11]/80 backdrop-blur-md border-b border-[#1F293D]">
      {/* Search & Account Switcher */}
      <div className="flex items-center gap-3">
        {/* Account Selector Dropdown */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-sm hover:border-brand-500/40 transition-colors">
          <Wallet className="w-4 h-4 text-brand-400" />
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-transparent text-gray-200 font-medium cursor-pointer focus:outline-none pr-2 text-xs sm:text-sm"
          >
            <option value="ALL" className="bg-[#111726] text-white">
              All Accounts
            </option>
            {accounts.map((acc) => (
              <option key={acc} value={acc} className="bg-[#111726] text-white">
                {acc}
              </option>
            ))}
          </select>
        </div>

        {/* Account Type Badge */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 font-mono text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{accountType}</span>
        </div>

        {/* Live Net Balance Display */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-card/60 border border-dark-border text-xs font-mono">
          <span className="text-gray-400">Balance:</span>
          <span className="font-bold text-white">
            {accountBalance !== null ? format(accountBalance) : "N/A"}
          </span>
          <span className={`font-semibold ml-1 ${stats.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ({formatSigned(stats.netProfit)})
          </span>
        </div>
      </div>

      {/* Action Buttons & Exports */}
      <div className="flex items-center gap-3">
        {/* PDF / Excel / CSV Exports */}
        <ExportToolbar />

        {/* Upload Button */}
        <Link
          href="/upload"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm shadow-glow transition-all active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Upload CSV</span>
        </Link>

        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-dark-card border border-dark-border text-gray-400"
          title="Terminal Dark Mode Active"
        >
          <Moon className="w-4 h-4 text-brand-400" />
        </div>
      </div>
    </header>
  );
};
