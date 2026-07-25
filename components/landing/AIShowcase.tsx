"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import {
  Brain,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Terminal,
} from "lucide-react";

const panelContainerVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.15,
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
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Coach & Intelligence Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Real-Time Edge Analysis. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-purple-400">
              Bloomberg-Style Execution Auditing.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            TradeFourge AI analyzes your trade logs to surface hidden inefficiencies, score entry confidence, and prevent costly drawdown streaks.
          </p>
        </div>

        {/* Bloomberg Terminal Style AI Showcase Panel with Sequential Motion */}
        <motion.div
          variants={panelContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="max-w-5xl mx-auto rounded-2xl bg-[#131622] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6"
        >
          {/* Header Bar */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0B0D13] border border-white/10 text-purple-400 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  TradeFourge AI Advisory Panel
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
                    MODEL v2.4
                  </span>
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Institutional pattern auditor & tilt detector
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Ingest Active</span>
            </div>
          </motion.div>

          {/* AI Panel Body Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Confidence Score Box */}
            <motion.div variants={itemVariants} className="lg:col-span-4 p-6 rounded-xl bg-[#0B0D13] border border-white/10 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider block">
                  Confidence Score
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white font-mono">
                    94%
                  </span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    HIGH CONFIDENCE
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mt-4 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "94%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-gradient-to-r from-purple-500 to-emerald-400 h-2 rounded-full"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#131622] border border-white/10 space-y-1 text-xs font-mono">
                <div className="text-purple-300 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> Evidence Evaluated
                </div>
                <p className="text-gray-400">
                  243 historical trades analyzed across connected accounts.
                </p>
              </div>
            </motion.div>

            {/* Observation & Recommendation Details */}
            <div className="lg:col-span-8 space-y-4">
              {/* Observation Card */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                  <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                    <Terminal className="w-4 h-4 text-purple-400" /> Observation & Behavioral Pattern
                  </span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-300">
                    Session Audit #243
                  </span>
                </div>

                <p className="text-sm text-gray-200 leading-relaxed font-sans pt-1">
                  Your highest-performing trades occur between <strong>09:30–11:00 EST</strong>, yielding a <strong>78.4% win rate</strong> and an average Risk:Reward ratio of <strong>2.65 R</strong>.
                </p>
              </motion.div>

              {/* Recommendation Card */}
              <motion.div variants={itemVariants} className="p-5 rounded-xl bg-[#0B0D13] border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> Recommendation
                  </span>
                  <span className="text-[10px] text-purple-300 bg-purple-600/20 px-2 py-0.5 rounded border border-purple-500/30">
                    ACTIONABLE EDGE
                  </span>
                </div>

                <p className="text-sm text-gray-200 leading-relaxed font-sans pt-1">
                  Reduce trading after <strong>14:00 EST</strong>. Position win rate drops to <strong>32%</strong> after 14:00 due to late-session chop and revenge sizing.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
