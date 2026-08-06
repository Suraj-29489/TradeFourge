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
import { useTheme } from "@/context/ThemeContext";

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
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section id="ai-showcase" className={`py-24 relative z-10 ${isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold uppercase tracking-wider ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-[#131622] border-white/10 text-gray-300"
          }`}>
            <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
            <span>AI Coach & Intelligence Engine</span>
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            Real-Time Edge Analysis. <br />
            <span className={isLight ? "text-emerald-600" : "text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400"}>
              Bloomberg-Style Execution Auditing.
            </span>
          </h2>
          <p className={`text-base sm:text-lg ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            TradeFourge AI continuously scans your trade logs to surface behavioral leaks, score entry confidence, detect revenge trading risks, and prescribe actionable execution rules.
          </p>
        </div>

        {/* Outer White Card Container in Light Mode / Product Showcase Preview */}
        <div className={`p-4 sm:p-6 rounded-3xl border ${
          isLight ? "bg-white border-[#E5E7EB] shadow-[0_12px_36px_rgba(15,23,42,0.08)]" : "bg-transparent border-transparent"
        }`}>
          {/* Bloomberg Terminal Style AI Showcase Panel (Always Dark Product Showcase Preview) */}
          <motion.div
            variants={panelContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="max-w-5xl mx-auto rounded-2xl bg-[#0F141C] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden text-white font-sans"
          >
            {/* Header Bar */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B0D13] border border-white/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    TradeFourge AI Advisory Terminal
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className="text-5xl font-black text-white font-mono tracking-tight"
                    >
                      88.4%
                    </motion.span>
                    <span className="text-xs font-mono text-emerald-400 flex items-center">
                      <ArrowUpRight className="w-4 h-4" /> +4.2% setup score
                    </span>
                  </div>

                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "88.4%" }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                      className="bg-emerald-500 h-full rounded-full"
                    />
                  </div>

                  <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                    Based on 142 historical EURUSD London Breakout trades during NY Overlap.
                  </p>
                </motion.div>

                {/* Behavioral Alert Card */}
                <motion.div variants={itemVariants} className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>BEHAVIORAL PATTERN ALERT</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed font-sans">
                    Tilt Risk Detected: Win rate drops by 34% when taking trades within 15 minutes of a losing stop-out.
                  </p>
                </motion.div>
              </div>

              {/* Right Column: AI Insights List */}
              <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                <motion.div variants={itemVariants} className="p-6 rounded-xl bg-[#0B0D13] border border-white/10 space-y-4 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> Prescriptive Action Plan
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">Updated 2m ago</span>
                  </div>

                  <ul className="space-y-3.5 text-xs text-gray-300">
                    <li className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-mono">Optimal Session: London/NY Overlap</strong>
                        <span className="text-gray-400 font-sans">Your Risk:Reward spikes from 1.4 to 2.8 when executing between 13:00 - 16:30 UTC.</span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-mono">Streak Anomaly Detected</strong>
                        <span className="text-gray-400 font-sans">Friday afternoon trades account for 68% of monthly drawdown. Recommend hard stop at 12:00 UTC Fridays.</span>
                      </div>
                    </li>

                    <li className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-mono">Stop Loss Tightening Recommendation</strong>
                        <span className="text-gray-400 font-sans">Moving SL to breakeven after 1.5R improves overall Profit Factor from 1.82 to 2.34.</span>
                      </div>
                    </li>
                  </ul>

                  <div className="pt-2 text-[10px] font-mono text-emerald-400 border-t border-white/10 flex items-center justify-between">
                    <span>AI Engine Status: Active & Learning</span>
                    <span>Confidence Level: High</span>
                  </div>
                </motion.div>
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
