"use client";
// components/upload/JournalManager.tsx
//
// ⚠ DEPRECATED — Phase 3.0
// The concept of "local journals" is replaced by:
// - Trading Accounts → /accounts (backed by Supabase trading_accounts)
// - Import History → /import-history (backed by Supabase csv_imports)
//
// This file is kept as a stub to prevent broken imports.
// Will be removed in Phase 3.1.

import React from "react";
import Link from "next/link";
import { History, Wallet, ArrowRight } from "lucide-react";

export function JournalManager() {
  return (
    <div className="p-5 rounded-2xl border border-dashed border-white/10 text-center space-y-4 bg-dark-card/30">
      <p className="text-xs font-mono text-gray-400">
        Journals are now managed as <strong className="text-gray-300">Trading Accounts</strong> and <strong className="text-gray-300">Import History</strong> in the cloud.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/accounts"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-xs font-mono font-bold hover:bg-purple-600/30 transition-all"
        >
          <Wallet className="w-4 h-4" />
          Manage Accounts
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/import-history"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-card border border-dark-border text-gray-300 text-xs font-mono font-bold hover:bg-dark-hover transition-all"
        >
          <History className="w-4 h-4" />
          Import History
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
