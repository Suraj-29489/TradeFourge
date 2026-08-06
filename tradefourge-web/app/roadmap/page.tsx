"use client";
// app/roadmap/page.tsx
// TradeFourge v5.0 Public Product Roadmap Page

import React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Sparkles, ArrowLeft, ArrowRight, ShieldCheck, Zap } from "lucide-react";

interface RoadmapItem {
  version: string;
  title: string;
  status: "Completed" | "In Progress" | "Planned";
  quarter: string;
  features: string[];
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    version: "v3.5 - v3.8",
    title: "Multi-Account Architecture & Unified Currency Registry",
    status: "Completed",
    quarter: "Q1 2026",
    features: [
      "Account-first trade isolation (USD, USC, EUR, GBP, INR, etc.)",
      "Unified Currency Registry with 11 supported currencies",
      "Mixed Currency warning banner across analytics dashboards",
    ],
  },
  {
    version: "v4.0",
    title: "Live Broker Sync Engine",
    status: "Completed",
    quarter: "Q2 2026",
    features: [
      "MetaTrader 5 & Exness production live connectors",
      "Incremental sync checkpointing with ticket deduplication",
      "Automatic currency detection & live status indicator badges",
      "Sync History audit log viewer",
    ],
  },
  {
    version: "v4.1 - v4.2",
    title: "Professional Reports & Trader Toolkit Workspaces",
    status: "Completed",
    quarter: "Q2 2026",
    features: [
      "Institutional PDF & CSV multi-template reporting engine",
      "Strategy Playbook Library & Rule Manager",
      "Goals & Discipline workspace with live progress indicators",
      "Mistake Analytics Engine & Discipline Score",
      "Weekly & Monthly Performance Review workspaces",
    ],
  },
  {
    version: "v5.0",
    title: "SaaS Launch & Enterprise Multi-User Desk Workspaces",
    status: "In Progress",
    quarter: "Q3 2026",
    features: [
      "Stripe Checkout & Billing Portal integration",
      "Plan Tier Feature Gating (Free, Pro, Team)",
      "Multi-user Team Workspaces with Role Permissions (Owner, Admin, Member, Viewer)",
      "Admin Controls SaaS Operations & Telemetry Monitoring Center",
    ],
  },
  {
    version: "v5.5 (Future)",
    title: "TradeFourge AI Execution Coach & Pattern Recognition",
    status: "Planned",
    quarter: "Q4 2026",
    features: [
      "Automated AI trade journal summary & setup feedback",
      "Real-time revenge trading & FOMO pattern detection alerts",
      "AI-driven strategy optimization & risk recommendations",
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-[#0B0D13] text-white font-mono text-xs selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to TradeFourge Home</span>
        </Link>
        <span className="text-blue-400 font-bold px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/30">
          Public Product Roadmap
        </span>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            TradeFourge Product Roadmap
          </h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Transparent view into shipped features, active SaaS launch releases, and upcoming AI capabilities.
          </p>
        </div>

        {/* Roadmap Items Timeline */}
        <div className="space-y-6">
          {ROADMAP_ITEMS.map((item) => {
            const isCompleted = item.status === "Completed";
            const isInProgress = item.status === "In Progress";

            return (
              <div
                key={item.version}
                className={`p-6 rounded-2xl border transition-all ${
                  isInProgress
                    ? "bg-blue-600/10 border-blue-500/40 shadow-glow"
                    : isCompleted
                    ? "bg-[#131622] border-white/10"
                    : "bg-[#131622]/50 border-white/5 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-400">{item.version}</span>
                      <span className="text-[10px] text-gray-500">({item.quarter})</span>
                    </div>
                    <h2 className="text-base font-bold text-white mt-1">{item.title}</h2>
                  </div>

                  <div>
                    {isCompleted && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                    {isInProgress && (
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-[10px] flex items-center gap-1 animate-pulse">
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span>Active Release</span>
                      </span>
                    )}
                    {!isCompleted && !isInProgress && (
                      <span className="px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400 font-bold text-[10px] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Planned</span>
                      </span>
                    )}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 border-t border-white/5 pt-4 text-gray-300">
                  {item.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
