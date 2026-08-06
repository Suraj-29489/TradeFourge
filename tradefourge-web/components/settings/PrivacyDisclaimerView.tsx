"use client";

import React, { useState } from "react";
import { Shield, AlertTriangle, Lock, CheckCircle2, FileText, ExternalLink } from "lucide-react";

export const PrivacyDisclaimerView: React.FC = () => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="space-y-6 font-mono text-xs max-w-4xl mx-auto w-full text-gray-200 pb-12">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <span>Privacy & Data Usage Disclaimer</span>
        </h1>
        <p className="text-xs text-gray-400 font-sans">
          Please read carefully before operating TradeForge Companion and connected trading terminals.
        </p>
      </div>

      {/* Main Content Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-6 shadow-xl font-sans">
        {/* Section 1: Data Collection */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400">
            1. Data Collection & Workspace Scope
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            TradeForge stores only the minimal information required to operate your workspace, generate analytics, and sync execution logs. We do not sell, rent, or trade your personal or financial data to third-party advertisers.
          </p>
        </div>

        {/* Section 2: Browser Extension */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400">
            2. Browser Extension Runtime
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            The TradeForge Companion browser extension operates exclusively within authorized broker tabs. It accesses only the execution data necessary for real-time synchronization (tickets, symbols, lot sizes, prices, timestamps). The extension never reads passwords, payment information, or un-related tab activities.
          </p>
        </div>

        {/* Section 3: User Responsibility (Highlighted) */}
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 font-mono">
          <div className="flex items-center gap-2 font-bold text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>3. USER RESPONSIBILITY & FINANCIAL DISCLAIMER</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-100/90 font-sans">
            Users remain fully and sole responsible for all:
          </p>
          <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1 pl-2 font-sans">
            <li>Trading decisions, position sizing, and risk parameters</li>
            <li>Financial outcomes, capital losses, and margin calls</li>
            <li>Broker terminal activity, account settings, and leverage</li>
            <li>Execution errors, order entry mistakes, and double entries</li>
            <li>Internet connectivity, latency, network disconnects, and terminal downtime</li>
          </ul>
          <p className="text-[11px] text-amber-300 font-bold pt-1 font-sans">
            TradeForge does not provide financial advice, signals, or portfolio management services.
          </p>
        </div>

        {/* Section 4: Data Safety */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-blue-400">
            4. Data Safety & Local Backups
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Although industry-standard encryption and security practices are enforced across database layers, no online service can guarantee absolute immunity to server failures or cyber risks. Users should maintain independent backups of their trade records and CSV statements.
          </p>
        </div>

        {/* Section 5: Liability Disclaimer (Bordered Warning Card) */}
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3 font-mono">
          <div className="flex items-center gap-2 font-bold text-rose-400 text-xs">
            <Lock className="w-4 h-4 shrink-0" />
            <span>5. ABSOLUTE LIMITATION OF LIABILITY</span>
          </div>
          <p className="text-xs leading-relaxed text-rose-100/90 font-sans">
            TradeForge is provided strictly <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> without warranties of any kind. The developers and operators are not liable for:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-rose-200/90 font-sans pt-1">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Trading losses or capital depletion</div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Lost or corrupted trade history</div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Missed execution opportunities</div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Broker terminal outages or disconnections</div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Extension runtime failures</div>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">● Unexpected synchronization errors</div>
          </div>
          <p className="text-xs font-bold text-rose-300 pt-2 font-sans">
            By operating TradeForge Companion, users acknowledge and accept these terms at their own risk.
          </p>
        </div>

        {/* Bottom Acknowledgment Checkbox */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
          <label className="flex items-center gap-3 cursor-pointer select-none text-xs text-gray-200">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>I have read, understood, and accept the Privacy & Data Usage Disclaimer.</span>
          </label>

          <button
            disabled={!agreed}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition-all shrink-0 shadow-sm disabled:cursor-not-allowed"
          >
            Acknowledge & Save
          </button>
        </div>
      </div>
    </div>
  );
};
