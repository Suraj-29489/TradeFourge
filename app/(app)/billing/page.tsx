"use client";
// app/(app)/billing/page.tsx
// TradeFourge v5.0 SaaS Billing & Plan Subscription Manager

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_TIERS, getUserPlan, SubscriptionPlanId } from "@/lib/billing/feature-gating";
import { fetchSubscriptionDetails, simulateStripeCheckout } from "@/lib/stripe/stripe-service";
import {
  CreditCard,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Receipt,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function BillingPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  const loadData = async (uid: string) => {
    const sub = fetchSubscriptionDetails(uid);
    setSubscription(sub);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    })();
  }, []);

  const handleCheckout = async (planId: SubscriptionPlanId) => {
    if (!userId) return;
    setIsCheckingOut(planId);
    try {
      await simulateStripeCheckout(userId, planId);
      loadData(userId);
    } catch (err) {
      console.error("Stripe Checkout simulation error:", err);
    } finally {
      setIsCheckingOut(null);
    }
  };

  const currentPlan = subscription ? PLAN_TIERS[subscription.planId as SubscriptionPlanId] : PLAN_TIERS.pro;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-mono text-xs">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-purple-400" />
          <span>Billing & SaaS Subscriptions</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Manage your TradeFourge subscription tier, invoice statement history, and payment methods
        </p>
      </div>

      {/* Active Subscription Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111726] to-[#182238] border border-purple-500/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Active Subscription: {currentPlan.name}</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">{currentPlan.name} Tier</h2>
          <p className="text-gray-400 text-xs max-w-md leading-relaxed">
            {currentPlan.id === "free"
              ? "Free Starter Plan. Upgrade to Pro for Live Sync, PDF Reports, and Trader Toolkit."
              : "Institutional SaaS subscription active with unlimited accounts, live broker sync, and reporting."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleCheckout("pro")}
            disabled={currentPlan.id === "pro" || isCheckingOut !== null}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-glow flex items-center gap-2 transition-all disabled:opacity-40"
          >
            {isCheckingOut === "pro" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>{currentPlan.id === "pro" ? "Current Active Plan" : "Upgrade to Pro ($29/mo)"}</span>
          </button>
        </div>
      </div>

      {/* Feature Access Matrix */}
      <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Active Plan Feature Access & Entitlements</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 block">Trading Accounts</span>
            <span className="text-sm font-extrabold text-white">
              {currentPlan.maxAccounts === -1 ? "Unlimited" : `${currentPlan.maxAccounts} Account`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 block">Live Sync Engine</span>
            <span className={`text-sm font-extrabold ${currentPlan.hasLiveSync ? "text-emerald-400" : "text-rose-400"}`}>
              {currentPlan.hasLiveSync ? "Enabled" : "Upgrade Required"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 block">PDF Reports Engine</span>
            <span className={`text-sm font-extrabold ${currentPlan.hasPdfReports ? "text-emerald-400" : "text-rose-400"}`}>
              {currentPlan.hasPdfReports ? "Enabled" : "Upgrade Required"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1">
            <span className="text-[10px] text-gray-400 block">Trader Toolkit</span>
            <span className={`text-sm font-extrabold ${currentPlan.hasTraderToolkit ? "text-emerald-400" : "text-rose-400"}`}>
              {currentPlan.hasTraderToolkit ? "Enabled" : "Upgrade Required"}
            </span>
          </div>
        </div>
      </div>

      {/* Subscription Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Starter Plan */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Starter</span>
            <div className="text-3xl font-extrabold text-white">$0 <span className="text-xs font-normal text-gray-400">/ month</span></div>
            <p className="text-gray-400 text-xs">Essential trade logging for casual retail traders with CSV import.</p>
            <ul className="space-y-2 pt-2 text-gray-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> 1 Trading Account</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Manual CSV Import</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Core Dashboard & Statistics</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout("free")}
            disabled={currentPlan.id === "free"}
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors disabled:opacity-40"
          >
            {currentPlan.id === "free" ? "Current Plan" : "Downgrade to Free"}
          </button>
        </div>

        {/* Pro Plan (Highlighted) */}
        <div className="p-6 rounded-2xl bg-[#111726] border-2 border-purple-500/60 shadow-glow space-y-4 relative flex flex-col justify-between">
          <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">POPULAR</span>
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Pro Trader</span>
            <div className="text-3xl font-extrabold text-white">$29 <span className="text-xs font-normal text-gray-400">/ month</span></div>
            <p className="text-gray-400 text-xs">Institutional analytics, automated live sync, and report generation.</p>
            <ul className="space-y-2 pt-2 text-gray-200">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Unlimited Trading Accounts</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Automated Live Broker Sync Engine</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Professional PDF Reports Engine</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-purple-400" /> Trader Toolkit (Playbooks & Goals)</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout("pro")}
            disabled={currentPlan.id === "pro"}
            className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-glow transition-all disabled:opacity-40"
          >
            {currentPlan.id === "pro" ? "Current Active Plan" : "Upgrade to Pro ($29/mo)"}
          </button>
        </div>

        {/* Team Plan */}
        <div className="p-6 rounded-2xl bg-[#111726] border border-white/10 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Team & Desk</span>
            <div className="text-3xl font-extrabold text-white">$79 <span className="text-xs font-normal text-gray-400">/ month</span></div>
            <p className="text-gray-400 text-xs">Multi-user desk workspace for prop firms, funds, and trading teams.</p>
            <ul className="space-y-2 pt-2 text-gray-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Everything in Pro</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Up to 10 Desk Members</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Role-Based Permissions (Admin/Viewer)</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout("team")}
            disabled={currentPlan.id === "team"}
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors disabled:opacity-40"
          >
            {currentPlan.id === "team" ? "Current Active Plan" : "Upgrade to Team ($79/mo)"}
          </button>
        </div>
      </div>

      {/* Invoice History */}
      {subscription?.invoices && subscription.invoices.length > 0 && (
        <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-400" />
            <span>Stripe Invoice & Billing History</span>
          </h3>
          <div className="divide-y divide-white/5">
            {subscription.invoices.map((inv: any) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">{inv.planName}</span>
                  <span className="text-[10px] text-gray-500">{new Date(inv.date).toLocaleDateString()} · ID: {inv.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white">${inv.amount.toFixed(2)} USD</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {inv.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
