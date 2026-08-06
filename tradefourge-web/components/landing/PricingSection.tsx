"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { Check, Sparkles, ArrowRight, Tag, ShieldCheck } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

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
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section id="pricing" className={`py-24 relative z-10 ${isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold uppercase tracking-wider ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-[#131622] border-white/10 text-gray-300"
          }`}>
            Transparent SaaS Pricing
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            Simple Plans. <br />
            <span className={isLight ? "text-emerald-600" : "text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400"}>
              Unlimited Trading Intelligence.
            </span>
          </h2>
          <p className={`text-base sm:text-lg ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            Choose the tier that fits your trading scale. Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${
              billingCycle === "monthly"
                ? isLight ? "text-slate-900 font-bold" : "text-white font-bold"
                : isLight ? "text-slate-500" : "text-gray-400"
            }`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className={`w-14 h-8 rounded-full border p-1 relative transition-colors focus:outline-none ${
                isLight ? "bg-slate-200 border-slate-300" : "bg-[#131622] border-white/10"
              }`}
            >
              <motion.div
                animate={{ x: billingCycle === "yearly" ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`w-6 h-6 rounded-full shadow-md ${isLight ? "bg-emerald-600" : "bg-blue-600"}`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium ${
                billingCycle === "yearly"
                  ? isLight ? "text-slate-900 font-bold" : "text-white font-bold"
                  : isLight ? "text-slate-500" : "text-gray-400"
              }`}>
                Yearly
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-blue-600/20 text-blue-400 border-blue-500/30"
              }`}>
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
          <motion.div variants={cardVariants} className={`p-8 rounded-2xl border space-y-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
            isLight ? "bg-white border-[#E5E7EB] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] text-slate-900" : "bg-[#131622] border-white/10 text-white"
          }`}>
            <div className="space-y-6">
              <div>
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Starter Tier
                </span>
                <h3 className={`text-2xl font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>Free</h3>
                <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                  Ideal for individual traders starting out with manual CSV exports.
                </p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black font-mono ${isLight ? "text-slate-900" : "text-white"}`}>$0</span>
                <span className={`text-xs font-mono ${isLight ? "text-slate-500" : "text-gray-400"}`}>/ forever</span>
              </div>

              <ul className={`space-y-3 text-xs border-t pt-6 font-sans ${isLight ? "border-slate-200 text-slate-700" : "border-white/10 text-gray-300"}`}>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>CSV Upload Parser</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Interactive Dashboard Terminal</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Trading Calendar Heatmap</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Basic Performance Analytics</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className={`w-full py-3.5 rounded-xl border font-bold text-center text-xs transition-all ${
                isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800" : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
              }`}
            >
              Get Started Free
            </Link>
          </motion.div>

          {/* Pro Plan (Dominant Outline) */}
          <motion.div variants={cardVariants} className={`p-8 rounded-2xl border-2 relative space-y-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
            isLight
              ? "bg-white border-emerald-600 shadow-xl shadow-emerald-500/10 text-slate-900"
              : "bg-[#131622] border-blue-600 shadow-2xl text-white"
          }`}>
            {/* Badge */}
            <div className={`absolute -top-3.5 right-6 px-3 py-0.5 rounded-full text-white text-[10px] font-mono font-bold shadow-md flex items-center gap-1 ${
              isLight ? "bg-emerald-600" : "bg-blue-600"
            }`}>
              <Sparkles className="w-3 h-3" /> MOST POPULAR
            </div>

            <div className="space-y-6">
              <div>
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? "text-emerald-700" : "text-blue-400"}`}>
                  Pro Trader Tier
                </span>
                <h3 className={`text-2xl font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>Pro Plan</h3>
                <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-gray-300"}`}>
                  Full institutional suite with AI Coach, unlimited journals & cloud backup.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-black font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
                    ${billingCycle === "yearly" ? "24" : "29"}
                  </span>
                  <span className={`text-xs font-mono ${isLight ? "text-slate-500" : "text-gray-400"}`}>/ month</span>
                </div>
                {billingCycle === "yearly" && (
                  <span className={`text-[11px] font-mono block ${isLight ? "text-emerald-700" : "text-blue-300"}`}>Billed annually</span>
                )}
              </div>

              <ul className={`space-y-3 text-xs border-t pt-6 font-sans ${isLight ? "border-emerald-200 text-slate-800" : "border-blue-500/20 text-gray-200"}`}>
                <li className="flex items-center gap-2.5">
                  <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span><strong>Unlimited Trading Journals</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span><strong>Encrypted Cloud Backup & Sync</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span><strong>AI Coach & Behavioral Auditing</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span><strong>Live Broker Sync</strong> <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ml-1 ${isLight ? "bg-emerald-500/15 text-emerald-800" : "bg-blue-600/30 text-blue-300"}`}>Coming Soon</span></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span><strong>Advanced Performance Analytics</strong></span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className={`w-full py-3.5 rounded-xl font-bold text-center text-xs shadow-md flex items-center justify-center gap-2 transition-all text-white ${
                isLight ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Institutional Plan */}
          <motion.div variants={cardVariants} className={`p-8 rounded-2xl border space-y-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
            isLight ? "bg-white border-[#E5E7EB] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] text-slate-900" : "bg-[#131622] border-white/10 text-white"
          }`}>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Institutional Tier
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isLight ? "bg-slate-200 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-gray-400"
                }`}>
                  CUSTOM
                </span>
              </div>
              <div>
                <h3 className={`text-2xl font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>Institutional</h3>
                <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                  For prop firms, hedge funds & multi-trader desk management.
                </p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black font-mono ${isLight ? "text-slate-900" : "text-white"}`}>Custom</span>
              </div>

              <ul className={`space-y-3 text-xs border-t pt-6 font-sans ${isLight ? "border-slate-200 text-slate-700" : "border-white/10 text-gray-300"}`}>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Dedicated Multi-Trader Seats</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Custom API & Database Webhooks</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Custom Investor PDF Formatting</span>
                </li>
              </ul>
            </div>

            <Link
              href="/signup"
              className={`w-full py-3.5 rounded-xl border font-bold text-center text-xs transition-all ${
                isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800" : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
              }`}
            >
              Contact Desk
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
