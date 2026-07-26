"use client";

import React from "react";
import { CreditCard, Check, Sparkles, Zap, Shield, ArrowRight } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
          Billing & SaaS Subscriptions
        </h1>
        <p className="text-xs text-gray-400 font-mono mt-1">
          Manage your TradeFourge subscription tier, invoice history, and payment methods.
        </p>
      </div>

      {/* Active Tier Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-purple-500/30 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Active Plan: Pro Trader Trial
          </div>
          <h2 className="text-xl font-bold font-mono text-white">TradeFourge Pro Terminal</h2>
          <p className="text-xs text-gray-400 max-w-md leading-relaxed">
            Your 14-day free trial of institutional AI analytics, unlimited trade logging, and cloud synchronization is active.
          </p>
        </div>

        <button
          type="button"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>Upgrade to Unlimited Pro ($29/mo)</span>
        </button>
      </div>

      {/* Subscription Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Starter Plan */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
          <div className="text-sm font-bold font-mono text-gray-300">Starter</div>
          <div className="text-3xl font-extrabold font-mono text-white">$0 <span className="text-xs text-gray-400 font-normal">/ month</span></div>
          <p className="text-xs text-gray-400 leading-relaxed">Essential trade logging for casual retail traders.</p>
          <ul className="space-y-2 pt-2 text-xs font-mono text-gray-300">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> 1 Trading Journal</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Up to 50 Trades / month</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Basic Statistics</li>
          </ul>
        </div>

        {/* Pro Plan (Highlighted) */}
        <div className="p-6 rounded-2xl bg-[#111726] border-2 border-purple-500/60 shadow-glow space-y-4 relative">
          <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-mono font-bold">POPULAR</span>
          <div className="text-sm font-bold font-mono text-purple-400">Pro Trader</div>
          <div className="text-3xl font-extrabold font-mono text-white">$29 <span className="text-xs text-gray-400 font-normal">/ month</span></div>
          <p className="text-xs text-gray-400 leading-relaxed">Institutional analytics & AI flaw detection suite.</p>
          <ul className="space-y-2 pt-2 text-xs font-mono text-gray-200">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Unlimited Journals & Trades</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> AI Trading Flaw Detection</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Performance Lab & Heatmaps</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> CSV Automated Importer</li>
          </ul>
        </div>

        {/* Enterprise Plan */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4">
          <div className="text-sm font-bold font-mono text-indigo-400">Prop & Fund</div>
          <div className="text-3xl font-extrabold font-mono text-white">$99 <span className="text-xs text-gray-400 font-normal">/ month</span></div>
          <p className="text-xs text-gray-400 leading-relaxed">Multi-account management for prop firm & fund traders.</p>
          <ul className="space-y-2 pt-2 text-xs font-mono text-gray-300">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Everything in Pro</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Team & Multi-Account Support</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Dedicated API Key Access</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
