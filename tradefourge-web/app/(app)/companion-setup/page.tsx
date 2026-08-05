"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  Radio,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
  Activity,
  Server,
  ChevronRight,
  FileSpreadsheet,
  Download,
  Lock,
} from "lucide-react";
import { useConnectionModeStore } from "@/lib/store/useConnectionModeStore";

export default function CompanionSetupLandingPage() {
  const router = useRouter();
  const openConnectionHub = useConnectionModeStore((s) => s.openConnectionHub);

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-8 font-mono text-gray-200 selection:bg-blue-600 selection:text-white">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-3 border-b border-white/[0.08] pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-blue-400 font-bold">Companion Setup</span>
          </div>

          <button
            onClick={openConnectionHub}
            className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-blue-400 border border-white/[0.08] transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Switch Connection Mode</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-blue-400 text-blue-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white font-sans tracking-tight">
              TradeFourge Companion Extension
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
            TradeFourge Companion connects your browser directly to your Exness trading terminal. Stream live ticks, synchronize balances, and discover accounts automatically with zero manual CSV exports.
          </p>
        </div>
      </div>

      {/* Feature Grid: Why Companion? */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white font-sans">Live Synchronization</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Every trade ticket, order modification, and balance shift streams instantly to your TradeFourge terminal via high-frequency local event bridge.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white font-sans">Automatic Account Discovery</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            No manual server logins or password sharing required. Companion detects active MT5 and Cent accounts directly from your browser session.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white font-sans">Real-time Analytics</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Calculates win rates, drawdown percentages, floating PnL, and equity metrics automatically as market orders close.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white font-sans">Secure Local Communication</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Operates entirely inside your browser runtime. Account credentials and API keys are never transmitted to third-party servers.
          </p>
        </div>
      </div>

      {/* Installation CTA Section */}
      <div className="p-8 rounded-3xl bg-[#0F141C] border border-blue-500/30 shadow-2xl space-y-6 text-center max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
          <Download className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white font-sans">Install TradeFourge Companion</h2>
          <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
            The Companion Chrome Extension will be available on the Chrome Web Store in the upcoming release.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            disabled
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600/40 text-gray-300 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2 border border-blue-500/30"
          >
            <span>Install Extension (Coming Soon)</span>
          </button>

          <Link
            href="/connect"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <span>Launch Wizard</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
