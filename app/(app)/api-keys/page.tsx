"use client";

import React from "react";
import { Key, Plus, Copy, Shield, Webhook } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          API Keys & Webhooks
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Generate API keys to programmatically sync trades from MetaTrader, TradingView, or cTrader.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" /> Active API Keys
            </h2>
            <p className="text-xs text-gray-400">Keep your secret keys secure. Do not share them in public repositories.</p>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold shadow-glow flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate New Key</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between font-mono text-xs text-gray-300">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">Production Secret</span>
            <span className="text-gray-400">tf_live_********************9x2a</span>
          </div>

          <button type="button" className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Copy Key">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Webhook Section */}
      <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
        <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
          <Webhook className="w-4 h-4 text-indigo-400" /> TradingView & Webhook Endpoints
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed font-sans">
          Receive real-time trade alert payloads from TradingView pine script strategies.
        </p>
        <div className="p-3 rounded-xl bg-[#0B0F17] border border-white/10 font-mono text-xs text-purple-300">
          https://tradefourge.vercel.app/api/webhooks/tradingview
        </div>
      </div>
    </div>
  );
}
