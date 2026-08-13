"use client";

import React from "react";
import { Shield, AlertTriangle, Lock } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// Reusable section wrapper — keeps every section's heading style,
// spacing, and card treatment identical instead of each one being
// hand-tuned separately.
const Section: React.FC<{
  number: string;
  title: string;
  isLight: boolean;
  children: React.ReactNode;
}> = ({ number, title, isLight, children }) => (
  <div className="space-y-2.5">
    <h3
      className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
        isLight ? "text-blue-600" : "text-blue-400"
      }`}
    >
      {number}. {title}
    </h3>
    <div className={`text-[13px] leading-relaxed font-sans ${isLight ? "text-slate-600" : "text-gray-300"}`}>
      {children}
    </div>
  </div>
);

const LIABILITY_ITEMS = [
  "Trading losses or capital depletion",
  "Lost or corrupted trade history",
  "Missed execution opportunities",
  "Broker terminal outages or disconnections",
  "Extension runtime failures",
  "Unexpected synchronization errors",
];

export const PrivacyDisclaimerView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const cardBase = `rounded-2xl border ${
    isLight ? "bg-white border-slate-200" : "bg-[#0F141C] border-white/[0.08]"
  }`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full pb-16">
      {/* Header */}
      <div className={`p-6 space-y-1.5 ${cardBase}`}>
        <h1
          className={`text-xl font-bold tracking-tight font-sans flex items-center gap-2.5 ${
            isLight ? "text-slate-900" : "text-white"
          }`}
        >
          <Shield className={`w-5 h-5 ${isLight ? "text-blue-600" : "text-blue-400"}`} />
          Privacy & Data Usage Disclaimer
        </h1>
        <p className={`text-[13px] font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
          Please read carefully before operating TradeFourge Companion and connected trading terminals.
        </p>
      </div>

      {/* Main content */}
      <div className={`p-6 sm:p-8 space-y-8 ${cardBase}`}>
        <Section number="1" title="Data Collection & Workspace Scope" isLight={isLight}>
          TradeFourge stores only the minimal information required to operate your workspace,
          generate analytics, and sync execution logs. We do not sell, rent, or trade your personal
          or financial data to third-party advertisers.
        </Section>

        <Section number="2" title="Browser Extension Runtime" isLight={isLight}>
          The TradeFourge Companion browser extension operates exclusively within authorized broker
          tabs. It accesses only the execution data necessary for real-time synchronization
          (tickets, symbols, lot sizes, prices, timestamps). The extension never reads passwords,
          payment information, or unrelated tab activity.
        </Section>

        {/* User responsibility */}
        <div
          className={`rounded-xl p-5 space-y-3 ${
            isLight ? "bg-amber-50 border border-amber-200" : "bg-amber-500/10 border border-amber-500/20"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider font-mono ${
              isLight ? "text-amber-700" : "text-amber-400"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            3. User Responsibility & Financial Disclaimer
          </div>
          <p className={`text-[13px] font-sans ${isLight ? "text-amber-900/90" : "text-amber-100/80"}`}>
            Users remain fully and solely responsible for all:
          </p>
          <ul
            className={`text-[13px] space-y-1.5 font-sans pl-1 ${
              isLight ? "text-amber-900/80" : "text-amber-200/80"
            }`}
          >
            {[
              "Trading decisions, position sizing, and risk parameters",
              "Financial outcomes, capital losses, and margin calls",
              "Broker terminal activity, account settings, and leverage",
              "Execution errors, order entry mistakes, and double entries",
              "Internet connectivity, latency, network disconnects, and terminal downtime",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className={`text-xs font-semibold pt-1 font-sans ${isLight ? "text-amber-700" : "text-amber-300"}`}>
            TradeFourge does not provide financial advice, signals, or portfolio management services.
          </p>
        </div>

        <Section number="4" title="Data Safety & Local Backups" isLight={isLight}>
          Although industry-standard encryption and security practices are enforced across database
          layers, no online service can guarantee absolute immunity to server failures or cyber
          risks. Users should maintain independent backups of their trade records and CSV statements.
        </Section>

        {/* Liability disclaimer */}
        <div
          className={`rounded-xl p-5 sm:p-6 space-y-4 ${
            isLight ? "bg-rose-50 border border-rose-200" : "bg-rose-500/10 border border-rose-500/20"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider font-mono ${
              isLight ? "text-rose-700" : "text-rose-400"
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            5. Absolute Limitation of Liability
          </div>
          <p className={`text-[13px] leading-relaxed font-sans ${isLight ? "text-rose-900/90" : "text-rose-100/80"}`}>
            TradeFourge is provided strictly <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong>{" "}
            without warranties of any kind. The developers and operators are not liable for:
          </p>

          {/* Equal-height cards: auto-rows-fr keeps every row (and every
              card within it) matched in height regardless of text length. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 auto-rows-fr">
            {LIABILITY_ITEMS.map((item) => (
              <div
                key={item}
                className={`flex items-center gap-2 min-h-[52px] px-3.5 py-3 rounded-lg text-xs font-sans ${
                  isLight
                    ? "bg-white border border-rose-200 text-rose-900/80"
                    : "bg-rose-500/[0.06] border border-rose-500/15 text-rose-200/80"
                }`}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${isLight ? "bg-rose-500" : "bg-rose-400"}`} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <p className={`text-[13px] font-semibold pt-1 font-sans ${isLight ? "text-rose-700" : "text-rose-300"}`}>
            By operating TradeFourge Companion or CSV Journal, users acknowledge and accept these
            terms at their own risk.
          </p>
        </div>
      </div>
    </div>
  );
};
