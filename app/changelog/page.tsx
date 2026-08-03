"use client";
// app/changelog/page.tsx
// TradeFourge v5.0 Changelog & Release Notes Page

import React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldCheck, Zap, Layers } from "lucide-react";

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  improvements: string[];
}

const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "v5.0.0",
    date: "August 2026",
    title: "TradeFourge SaaS Launch & Production Release",
    highlights: [
      "Stripe Checkout & Customer Billing Portal integration",
      "Plan Tier Feature Gating (Free, Pro, Team)",
      "Multi-user Team Workspaces with Role Permissions (Owner, Admin, Member, Viewer)",
      "Mission Control SaaS Operations & Telemetry Monitoring Center",
    ],
    improvements: [
      "Enhanced authentication security with device session tracking",
      "Optimized production build compiling 31 static routes in <7s",
    ],
  },
  {
    version: "v4.2.0",
    date: "August 2026",
    title: "Trader Toolkit Workspaces & Mistake Engine",
    highlights: [
      "Strategy Playbook Library & Rule Manager",
      "Goals & Discipline workspace with live progress indicators",
      "Mistake Analytics Engine computing Discipline Scores",
      "Automated Weekly & Monthly Performance Review workspaces",
    ],
    improvements: [
      "Rich Trade Notes Workspace (Thesis, Entry/Exit Reasoning, Emotion Log)",
      "Screenshot Gallery with HTF/LTF/Entry/Exit tags and Lightbox Zoom",
    ],
  },
  {
    version: "v4.1.0",
    date: "August 2026",
    title: "Professional Reports Engine",
    highlights: [
      "Institutional multi-template PDF & CSV reporting engine",
      "Customizable PDF themes (Dark Mode vs Print Light Mode)",
      "Report History Audit Log viewer",
    ],
    improvements: [
      "Automated page pagination and confidentiality footers",
    ],
  },
  {
    version: "v4.0.0",
    date: "August 2026",
    title: "Live Broker Sync Engine",
    highlights: [
      "MetaTrader 5 & Exness production live connectors",
      "Incremental sync checkpointing with ticket deduplication",
      "Automatic currency detection & live status badges",
    ],
    improvements: [
      "Background sync scheduler supporting 1m, 5m, 15m, 1h intervals",
    ],
  },
  {
    version: "v3.8.2",
    date: "August 2026",
    title: "Unified Currency System & Dynamic Account Currency",
    highlights: [
      "Central Currency Registry with 11 supported currencies",
      "Account-driven currency formatting across all views",
      "Mixed Currency warning banner for multi-account filtering",
    ],
    improvements: [
      "Removed legacy exchange rate conversions to preserve raw trade values 1:1",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#0B0D13] text-white font-mono text-xs selection:bg-purple-600 selection:text-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to TradeFourge Home</span>
        </Link>
        <span className="text-purple-400 font-bold px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30">
          Changelog & Release Notes
        </span>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Release Notes & Version History
          </h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Detailed log of features, enhancements, and architectural upgrades across TradeFourge releases.
          </p>
        </div>

        {/* Release Notes List */}
        <div className="space-y-8">
          {RELEASE_NOTES.map((rel) => (
            <div key={rel.version} className="p-6 rounded-2xl bg-[#131622] border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-white">{rel.version}</span>
                  <span className="text-xs text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-600/20 border border-purple-500/30">
                    {rel.title}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{rel.date}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                    Major Highlights & Features
                  </span>
                  <ul className="space-y-1 text-gray-300">
                    {rel.highlights.map((h, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {rel.improvements && rel.improvements.length > 0 && (
                  <div>
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-1">
                      Improvements & Optimization
                    </span>
                    <ul className="space-y-1 text-gray-300">
                      {rel.improvements.map((imp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
