"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { Check, Sparkles, ArrowRight, Tag, ShieldCheck } from "lucide-react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 24,
    },
  },
};

export const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  return (
    <section id="pricing" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            Transparent SaaS Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Simple Plans. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-purple-400">
              Unlimited Trading Intelligence.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            Choose the tier that fits your trading scale. Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-white font-bold" : "text-gray-400"}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className="w-14 h-8 rounded-full bg-[#131622] border border-white/10 p-1 relative transition-colors focus:outline-none"
            >
              <motion.div
                animate={{ x: billingCycle === "yearly" ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-6 h-6 rounded-full bg-purple-600 shadow-md"
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium ${billingCycle === "yearly" ? "text-white font-bold" : "text-gray-400"}`}>
                Yearly
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold">
                SAVE 20%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch"
        >
          {/* Free Plan */}
          <motion.div variants={cardVariants} className="p-8 rounded-2xl bg-[#131622] border border-white/10 space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                  Starter Tier
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">Free</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Ideal for individual traders starting out with manual CSV exports.
                </p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white font-mono">$0</span>
                <span className="text-xs text-gray-400 font-mono">/ forever</span>
              </div>

              <ul className="space-y-3 text-xs text-gray-300 border-t border-white/10 pt-6 font-sans">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>CSV Upload Parser</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Interactive Dashboard Terminal</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Trading Calendar Heatmap</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic Performance Analytics</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-center text-xs transition-all"
            >
              Get Started Free
            </Link>
          </motion.div>

          {/* Pro Plan (Highlighted) */}
          <motion.div variants={cardVariants} className="p-8 rounded-2xl bg-[#131622] border-2 border-purple-500 relative space-y-8 flex flex-col justify-between shadow-2xl">
            {/* Badge */}
            <div className="absolute -top-3.5 right-6 px-3 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-mono font-bold shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> MOST POPULAR
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400">
                  Pro Trader Tier
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">Pro Plan</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Full institutional suite with AI Coach, unlimited journals & cloud backup.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">
                    ${billingCycle === "yearly" ? "24" : "29"}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">/ month</span>
                </div>
                {billingCycle === "yearly" && (
                  <span className="text-[11px] text-purple-300 font-mono block">Billed annually</span>
                )}
              </div>

              <ul className="space-y-3 text-xs text-gray-200 border-t border-purple-500/20 pt-6 font-sans">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Unlimited Trading Journals</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Encrypted Cloud Backup & Sync</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>AI Coach & Behavioral Auditing</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Live Broker Sync</strong> <span className="text-[10px] font-mono text-purple-300 bg-purple-600/30 px-1.5 py-0.5 rounded ml-1">Coming Soon</span></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Advanced Performance Analytics</strong></span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-center text-xs shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Enterprise Plan (Coming Soon - Disabled Style) */}
          <motion.div variants={cardVariants} className="p-8 rounded-2xl bg-[#131622] border border-white/10 space-y-8 flex flex-col justify-between relative opacity-85">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                    Institutional Tier
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1">Enterprise</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Custom prop firm API hooks, dedicated servers & SLA.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
                  Coming Soon
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white font-mono">Custom</span>
              </div>

              <ul className="space-y-3 text-xs text-gray-300 border-t border-white/10 pt-6 font-sans">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Dedicated Private Server Cluster</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Custom Prop Firm API Hooks</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>24/7 Dedicated Account Manager</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Custom Compliance Audit Logs</span>
                </li>
              </ul>
            </div>

            <button
              disabled
              className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold text-center text-xs cursor-not-allowed"
            >
              Contact Sales (Coming Soon)
            </button>
          </motion.div>
        </motion.div>

        {/* Coupon Preview (UI-Only Placeholder) */}
        <div className="mt-14 max-w-2xl mx-auto p-6 rounded-2xl bg-[#131622] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-bold text-white">Coupon Preview</h4>
            </div>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-600/20 px-2 py-0.5 rounded border border-purple-500/30">
              PROMO CODE PREVIEW
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Early beta participants will receive promotional discount codes during checkout launch.
          </p>

          {/* Static Coupon Chips UI */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <div className="px-3.5 py-2 rounded-xl bg-[#0B0D13] border border-purple-500/30 flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">WELCOME20</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                20% OFF
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#0B0D13] border border-purple-500/30 flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">EARLYACCESS</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                $10 OFF
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[#0B0D13] border border-purple-500/30 flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white">BETA50</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                50% OFF
              </span>
            </div>
          </div>

          {/* Coupon Input Placeholder UI */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              readOnly
              placeholder="Enter coupon code (e.g. WELCOME20)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B0D13] border border-white/10 text-gray-400 placeholder-gray-500 font-mono text-xs cursor-not-allowed"
            />
            <button
              disabled
              className="px-6 py-2.5 rounded-xl bg-purple-600/50 text-white/70 font-bold text-xs cursor-not-allowed shrink-0"
            >
              Apply Coupon
            </button>
          </div>

          <div className="pt-2 text-[11px] font-mono text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> All early access plans come with 14-day money-back guarantee.
          </div>
        </div>
      </div>
    </section>
  );
};
