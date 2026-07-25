"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { Check, Sparkles, ArrowRight, Tag, ShieldCheck, X } from "lucide-react";

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

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const baseProPrice = billingCycle === "yearly" ? 24 : 29;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const cleanCode = couponInput.trim().toUpperCase();

    if (cleanCode === "WELCOME20") {
      setAppliedCoupon({ code: "WELCOME20", discountType: "percent", discountValue: 20 });
    } else if (cleanCode === "BETA50") {
      setAppliedCoupon({ code: "BETA50", discountType: "percent", discountValue: 50 });
    } else if (cleanCode === "EARLYACCESS") {
      setAppliedCoupon({ code: "EARLYACCESS", discountType: "fixed", discountValue: 10 });
    } else {
      setCouponError("Invalid coupon code. Try WELCOME20, BETA50, or EARLYACCESS.");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  // Calculate pricing
  const subtotal = baseProPrice;
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === "percent") {
      discountAmount = (subtotal * appliedCoupon.discountValue) / 100;
    } else {
      discountAmount = Math.min(appliedCoupon.discountValue, subtotal);
    }
  }
  const tax = 0;
  const finalTotal = Math.max(0, subtotal - discountAmount + tax);

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

        {/* Pricing Cards Grid with Independent Staggered Motion */}
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
                  <span>Manual CSV File Upload</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Interactive Dashboard Terminal</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Performance Analytics & Metrics</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Trading Calendar Heatmap</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic PDF & Excel Reports</span>
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

          {/* Pro Plan */}
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
                <h3 className="text-2xl font-bold text-white mt-1">Pro Access</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Full institutional suite with AI Coach, multi-broker sync & Trader DNA.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">
                    ${finalTotal.toFixed(0)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">/ month</span>
                  {appliedCoupon && (
                    <span className="text-xs text-emerald-400 font-mono line-through ml-2">
                      ${subtotal}
                    </span>
                  )}
                </div>
                {billingCycle === "yearly" && (
                  <span className="text-[11px] text-purple-300 font-mono block">Billed annually</span>
                )}
              </div>

              <ul className="space-y-3 text-xs text-gray-200 border-t border-purple-500/20 pt-6 font-sans">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Automated Broker Sync</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Unlimited Trading Accounts</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>AI Coach & Edge Recognition</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Trader DNA Behavioral Profiling</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Encrypted Cloud Backup & Sync</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>Advanced Investor Audit Reports</strong></span>
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

          {/* Enterprise Plan (Coming Soon) */}
          <motion.div variants={cardVariants} className="p-8 rounded-2xl bg-[#131622] border border-white/10 space-y-8 flex flex-col justify-between relative opacity-90">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                    Institutional Tier
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1">Enterprise</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Custom API integrations, dedicated prop firm infrastructure & SLA.
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
                  <span>Custom Compliance & Audit Logs</span>
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

        {/* Interactive Coupon System Box */}
        <div className="mt-12 max-w-2xl mx-auto p-6 rounded-2xl bg-[#131622] border border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold text-white">Have a Promotional Coupon Code?</h4>
          </div>

          {!appliedCoupon ? (
            <form onSubmit={handleApplyCoupon} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Try: WELCOME20, BETA50, EARLYACCESS"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0B0D13] border border-white/10 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shrink-0"
              >
                Apply Coupon
              </button>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono text-emerald-400">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Coupon <strong>{appliedCoupon.code}</strong> Applied! ({appliedCoupon.discountType === "percent" ? `${appliedCoupon.discountValue}% OFF` : `$${appliedCoupon.discountValue} OFF`})
              </span>
              <button
                onClick={handleRemoveCoupon}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {couponError && (
            <p className="text-xs font-mono text-rose-400">{couponError}</p>
          )}

          {/* Pricing Calculation Summary Table */}
          <div className="pt-3 border-t border-white/10 text-xs font-mono space-y-1.5 text-gray-300">
            <div className="flex justify-between">
              <span>Pro Plan Base Price</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-emerald-400">
                <span>Coupon Discount ({appliedCoupon.code})</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Estimated Tax (0%)</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold text-white">
              <span>Final Total</span>
              <span className="text-purple-400">${finalTotal.toFixed(2)} / mo</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
