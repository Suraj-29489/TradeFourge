"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  ArrowUpRight,
} from "lucide-react";

const panelContainerVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export const AIShowcase: React.FC = () => {
  return (
    <section id="ai-showcase" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>AI Coach & Intelligence Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Real-Time Edge Analysis. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400">
              Bloomberg-Style Execution Auditing.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            TradeFourge AI continuously scans your trade logs to surface behavioral leaks, score entry confidence, detect revenge trading risks, and prescribe actionable execution rules.
          </p>
        </div>

        {/* Bloomberg Terminal Style AI Showcase Panel */}
        <motion.div
          variants={panelContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="max-w-5xl mx-auto rounded-2xl bg-[#131622] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header Bar */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0B0D13] border border-white/10 text-blue-400 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  TradeFourge AI Advisory Terminal
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    MODEL v2.4
                  </span>
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Institutional pattern auditor & behavioral risk detector
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Neural Engine Active</span>
            </div>
          </motion.div>

          {/* AI Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: Confidence % & Animated Chart */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              
              {/* Confidence Score Card */}
              <motion.div variants={itemVariants} className="p-6 rounded-xl bg-[#0B0D13] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-wider block">
                    AI Execution Confidence
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    HIGH PROBABILITY
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl font-extrabold text-white font-mono"
                  >
                    94.8%
                  </motion.span>
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +6.2% vs last week
                  </span>
                </div>

                {/* Animated Gradient Bar */}
                <div className="w-full bg-gray-800/80 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "94.8%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400 h-2.5 rounded-full"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
                  <span>Sample Size: <strong>243 Trades</strong></span>
                  <span>Model Latency: <strong>&lt; 12ms</strong></span>
                </div>
              </motion.div>

              {/* Animated Trade Analysis Chart Visual */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-gray-300">
                  <span className="flex items-center gap-1.5 font-bold text-white">
                    <Activity className="w-4 h-4 text-blue-400" /> Trade Analysis & Distribution
                  </span>
                  <span className="text-[10px] text-blue-300 bg-blue-600/20 px-2 py-0.5 rounded border border-blue-500/30">
                    EV +2.45 R
                  </span>
                </div>

                <div className="h-28 w-full relative pt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="aiChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 70 Q 40 60, 80 40 T 160 30 T 240 15 T 300 5 L 300 80 L 0 80 Z"
                      fill="url(#aiChartGradient)"
                    />
                    <motion.path
                      d="M 0 70 Q 40 60, 80 40 T 160 30 T 240 15 T 300 5"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                    />
                    <circle cx="300" cy="5" r="4" fill="#10B981" />
                    <circle cx="300" cy="5" r="8" fill="#10B981" opacity="0.5" className="animate-ping" />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-gray-400">
                  <div className="p-2 rounded bg-[#131622] border border-white/5">
                    <span>Avg R:R Ratio:</span> <strong className="text-white">2.84 : 1</strong>
                  </div>
                  <div className="p-2 rounded bg-[#131622] border border-white/5">
                    <span>Win Frequency:</span> <strong className="text-emerald-400">76.2%</strong>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Right Column: AI Coach Cards */}
            <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
              
              {/* Risk Detection Card */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Risk Detection Alert
                  </span>
                  <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    BEHAVIORAL WARNING
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-sans pt-1">
                  <strong>Tilt Anomaly Detected:</strong> Position sizing increases by <strong>140%</strong> following consecutive loss trades on Friday afternoon sessions.
                </p>
              </motion.div>

              {/* Mistake Detection Card */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-rose-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <Flame className="w-4 h-4 text-rose-400" /> Mistake Pattern Identified
                  </span>
                  <span className="text-[10px] text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    CHOP ZONE LEAK
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed font-sans pt-1">
                  Entries taken after <strong>14:00 EST</strong> exhibit a <strong>32% win rate</strong> and generate <strong>-$1,840.00</strong> in cumulative drawdown.
                </p>
              </motion.div>

              {/* Suggested Improvements Card */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-blue-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Suggested Improvements & Action Plan
                  </span>
                  <span className="text-[10px] text-blue-300 bg-blue-600/20 px-2 py-0.5 rounded border border-blue-500/30">
                    OPTIMIZED EDGE
                  </span>
                </div>
                <ul className="text-xs text-gray-200 leading-relaxed font-sans pt-1 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span>Restrict trading windows strictly to <strong>09:30–11:30 EST</strong> (London / NY overlap).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>Hard cap risk at <strong>1.0% per trade</strong> to neutralize tilt sizing anomalies.</span>
                  </li>
                </ul>
              </motion.div>

            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};
