"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { XCircle, CheckCircle2, ShieldAlert, Zap } from "lucide-react";

const COMPARISONS = [
  {
    without: "Spreadsheet tracking & manual calculations",
    with: "Automated CSV parsing with instant MT4/MT5 position recognition",
  },
  {
    without: "Relying on memory & emotion-driven trading decisions",
    with: "Data-backed statistical edge with real-time Win Rate & P&L metrics",
  },
  {
    without: "No pattern detection or psychological drawdown tracking",
    with: "AI Coach alerts on streak anomalies, tilt risk, and pattern flaws",
  },
  {
    without: "Struggling to calculate true Risk vs Reward and Profit Factor",
    with: "Institutional metrics automatically calculated across every trade",
  },
  {
    without: "No professional reports to share with investors or prop firms",
    with: "1-click audited PDF & Excel exports with complete equity breakdowns",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -15 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export const WhyTradeFourge: React.FC = () => {
  return (
    <section id="why-us" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            Transform Your Execution
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Stop Guessing. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400">
              Start Trading With Institutional Clarity.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            See the dramatic difference between traditional manual logging and TradeFourge trading intelligence.
          </p>
        </div>

        {/* Comparison Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Column 1: Without TradeFourge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-2xl bg-[#131622] border border-rose-500/20 relative space-y-6 flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-rose-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Without TradeFourge</h3>
                    <span className="text-xs font-mono text-rose-400">Traditional & Manual Methods</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  HIGH RISK
                </span>
              </div>

              <motion.ul
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="space-y-4"
              >
                {COMPARISONS.map((item, i) => (
                  <motion.li key={i} variants={rowVariants} className="flex items-start gap-3 text-sm text-gray-400">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{item.without}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            <div className="pt-6 border-t border-rose-500/10 text-xs font-mono text-rose-400/80">
              Result: Inconsistent results, hidden drawdown, & wasted capital.
            </div>
          </motion.div>

          {/* Column 2: With TradeFourge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-8 rounded-2xl bg-[#131622] border border-blue-500/40 relative space-y-6 flex flex-col justify-between shadow-xl"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-blue-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">With TradeFourge</h3>
                    <span className="text-xs font-mono text-blue-300">Automated Intelligence Platform</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  OPTIMIZED EDGE
                </span>
              </div>

              <motion.ul
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="space-y-4"
              >
                {COMPARISONS.map((item, i) => (
                  <motion.li key={i} variants={rowVariants} className="flex items-start gap-3 text-sm text-gray-200 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item.with}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            <div className="pt-6 border-t border-blue-500/20 text-xs font-mono text-emerald-400">
              Result: Systematic growth, disciplined execution & scaling edge.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
