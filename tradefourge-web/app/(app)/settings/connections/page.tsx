"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Server,
  Layers,
  Activity,
  FileText,
  Unplug,
  ArrowLeft,
  ChevronRight,
  Database,
  ExternalLink,
  X,
} from "lucide-react";
import { useCompanion } from "@/lib/companion/provider";
import { CompanionHealth, LogSeverity } from "@/lib/companion/types";

// ── Reusable Connection Health Badge Component (Phase 6) ──────────────────────
function ConnectionHealthBadge({ health }: { health: CompanionHealth }) {
  const getBadgeStyle = () => {
    switch (health) {
      case "Excellent":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Good":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "Warning":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "Disconnected":
      case "Error":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold font-mono ${getBadgeStyle()}`}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      <span>{health}</span>
    </span>
  );
}

// ── Log Severity Badge ────────────────────────────────────────────────────────
function LogSeverityBadge({ severity }: { severity: LogSeverity }) {
  switch (severity) {
    case "SUCCESS":
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
          SUCCESS
        </span>
      );
    case "WARNING":
      return (
        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
          WARN
        </span>
      );
    case "ERROR":
      return (
        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
          ERROR
        </span>
      );
    case "INFO":
    default:
      return (
        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
          INFO
        </span>
      );
  }
}

export default function ConnectionManagerPage() {
  const companion = useCompanion();
  const [showLogs, setShowLogs] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const FUTURE_INTEGRATIONS = [
    { name: "MetaTrader 5 Direct API", broker: "MetaQuotes", protocol: "REST & WebSockets", status: "Coming Soon" },
    { name: "cTrader Connect", broker: "Spotware", protocol: "Open API 2.0", status: "Coming Soon" },
    { name: "Binance Futures Engine", broker: "Binance", protocol: "REST API", status: "Coming Soon" },
    { name: "Bybit Derivatives", broker: "Bybit", protocol: "V5 Unified API", status: "Coming Soon" },
    { name: "DXTrade Gateway", broker: "Devexperts", protocol: "Fix Protocol", status: "Coming Soon" },
    { name: "NinjaTrader Bridge", broker: "NinjaTrader", protocol: "ATI Interface", status: "Coming Soon" },
    { name: "Interactive Brokers TWS", broker: "IBKR", protocol: "TWS API", status: "Coming Soon" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-8 font-mono text-gray-200">
      {/* Header & Breadcrumb */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link href="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
          <span>/</span>
          <span className="text-blue-400 font-bold">Connections</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-white font-sans tracking-tight flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-blue-400" />
              <span>Connection Manager</span>
            </h1>
            <p className="text-xs text-gray-400">
              Manage TradeFourge Companion Extension runtime, live WebSocket bridge, diagnostics, and broker integrations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ConnectionHealthBadge health={companion.health} />
          </div>
        </div>
      </div>

      {/* Production Error Banner (Phase 10) */}
      {companion.lastError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold font-sans text-white text-sm">
                Error Code: {companion.lastError.code}
              </div>
              <p className="text-gray-300 leading-relaxed">{companion.lastError.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => companion.reconnect()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold transition-all text-xs"
            >
              Retry Connection
            </button>
            <button
              onClick={() => companion.clearError()}
              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-all"
              title="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: Companion Integration Panel */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Radio className={`w-6 h-6 ${companion.isConnected ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-sans">TradeFourge Companion Extension</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase">
                  Primary Bridge
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Runtime extension responsible for auto-discovering accounts, importing history, and streaming live ticks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setIsProcessing(true);
                await companion.reconnect();
                setIsProcessing(false);
              }}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
              <span>Reconnect</span>
            </button>
          </div>
        </div>

        {/* Companion Properties Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Connection Status</div>
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{companion.isConnected ? "Connected" : "Waiting"}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Extension Version</div>
            <div className="font-bold text-white">{companion.version}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Target Browser</div>
            <div className="font-bold text-gray-300">{companion.browser}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Latency Response</div>
            <div className="font-bold text-blue-400">{companion.latency} ms</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Accounts Connected</div>
            <div className="font-bold text-white">{companion.accountsCount} Accounts</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Realtime Stream</div>
            <div className="font-bold text-emerald-400">{companion.realtimeStatus}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">History Status</div>
            <div className="font-bold text-emerald-400">{companion.historyStatus}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] text-gray-400 uppercase">Last Sync</div>
            <div className="font-bold text-gray-300">{companion.lastSyncTime}</div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => companion.syncNow()}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Now</span>
            </button>

            <button
              onClick={() => companion.reconnect()}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Import History Again</span>
            </button>

            <button
              onClick={() => companion.repairConnection()}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Repair Connection</span>
            </button>

            <button
              onClick={() => companion.disconnect()}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showLogs ? "Hide Logs" : "View Logs"}</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: Connection Logs Table (Phase 5) */}
      {showLogs && (
        <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white font-sans">Runtime Connection Logs</h3>
            </div>
            <span className="text-[10px] text-gray-400">{companion.logs.length} Recorded Events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] text-gray-400 uppercase">
                  <th className="pb-3 pr-4">Timestamp</th>
                  <th className="pb-3 pr-4">Severity</th>
                  <th className="pb-3 pr-4">Event</th>
                  <th className="pb-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {companion.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4 text-gray-400 text-[11px] whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <LogSeverityBadge severity={log.severity} />
                    </td>
                    <td className="py-3 pr-4 font-bold text-gray-200 whitespace-nowrap">{log.event}</td>
                    <td className="py-3 text-gray-400 text-[11px]">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: Future Integrations (Broker APIs - Coming Soon) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-sans">Future Integrations (Broker APIs)</h2>
            <p className="text-xs text-gray-400">Direct REST API & FIX Protocol connectors coming in future releases.</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white/[0.05] text-gray-400 text-[10px] font-bold border border-white/[0.08] uppercase">
            Roadmap
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FUTURE_INTEGRATIONS.map((item) => (
            <div
              key={item.name}
              className="p-5 rounded-2xl bg-[#0F141C]/40 border border-white/[0.05] space-y-4 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded bg-white/[0.05] text-gray-400 text-[9px] font-bold uppercase border border-white/[0.08]">
                  {item.status}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-300 font-sans">{item.name}</h3>
                <div className="text-[11px] text-gray-500 font-mono mt-1">
                  Provider: {item.broker} · Protocol: {item.protocol}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
