"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  TrendingUp,
  ShieldCheck,
  Zap,
  Activity,
  Award,
  CheckCircle2,
  Brain,
  BarChart2,
  X,
  MousePointer,
  Sparkles,
} from "lucide-react";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

export const HeroSection: React.FC = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  const { mousePos, isHovered, spotlightProps } = useMouseSpotlight();

  return (
    <section
      {...spotlightProps}
      className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#0B0D13]"
    >
      {/* Background Terminal Grid & Subtle Spotlight */}
      <div className="absolute inset-0 terminal-grid opacity-30 pointer-events-none" />
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-60"
        style={{
          background: isHovered
            ? `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(37, 99, 235, 0.08), transparent 70%)`
            : "radial-gradient(800px circle at 50% 30%, rgba(37, 99, 235, 0.05), transparent 70%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Top Pill */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-medium shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Institutional Trading Analytics Terminal</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]"
            >
              Your Edge Isn't Luck. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400">
                It's Hidden In Your Data.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-sans"
            >
              TradeFourge transforms raw trading history into professional performance analytics, helping traders discover patterns, eliminate mistakes, and improve consistency through intelligent insights.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
            >
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                <span>Start Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <button
                onClick={() => setDemoOpen(true)}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-[#131622] hover:bg-[#1A1E2E] border border-white/10 text-gray-200 font-bold text-base flex items-center justify-center gap-3 transition-all hover:border-blue-500/30"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </motion.div>

            {/* Trust points */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-xs font-mono text-gray-400 max-w-lg mx-auto lg:mx-0"
            >
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Latency</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Prop-Firm Ready</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Instant CSV Import</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Animated Dashboard Terminal Preview */}
          <div className="lg:col-span-5 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative mx-auto max-w-lg lg:max-w-none"
            >
              {/* Subtle Card Border Highlight */}
              <div className="relative rounded-2xl bg-[#131622] border border-white/10 p-5 shadow-2xl space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-gray-400">tradefourge_terminal_preview.app</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                    LIVE PREVIEW
                  </span>
                </div>

                {/* Metric Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0B0D13] border border-white/10">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">Net Realized P&L</span>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5 block">+$14,280.50</span>
                    <span className="text-[10px] text-emerald-400/80 font-mono mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> +24.8% Account Growth
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0B0D13] border border-white/10">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">Win Rate</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-0.5 block">68.4%</span>
                    <span className="text-[10px] text-gray-400 font-mono mt-1">
                      Profit Factor: <strong className="text-white">2.42</strong>
                    </span>
                  </div>
                </div>

                {/* Animated Equity Curve Line */}
                <div className="p-4 rounded-xl bg-[#0B0D13] border border-white/10 space-y-2 relative">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-200 font-bold flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-blue-400" /> Equity Growth Curve
                    </span>
                    <span className="text-xs text-blue-300 font-mono">142 Executions</span>
                  </div>
                  
                  {/* SVG Sparkline */}
                  <div className="h-28 w-full relative pt-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="heroFintechGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 70 Q 30 65, 60 50 T 120 40 T 180 25 T 240 30 T 300 10 L 300 80 L 0 80 Z"
                        fill="url(#heroFintechGradient)"
                      />
                      <path
                        d="M 0 70 Q 30 65, 60 50 T 120 40 T 180 25 T 240 30 T 300 10"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Pulse point */}
                      <circle cx="300" cy="10" r="4" fill="#10B981" />
                      <circle cx="300" cy="10" r="8" fill="#10B981" opacity="0.4" className="animate-ping" />
                    </svg>
                  </div>

                  {/* Simulated Cursor Floating Effect */}
                  <motion.div
                    animate={{
                      x: [20, 180, 260, 120, 20],
                      y: [30, 20, 50, 40, 30],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute z-20 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600/90 text-white text-[10px] font-mono shadow-md"
                  >
                    <MousePointer className="w-3 h-3 fill-current" />
                    <span>Inspection @ London Open</span>
                  </motion.div>
                </div>

                {/* AI Assistant Insight Highlight Card */}
                <div className="p-3.5 rounded-xl bg-[#0B0D13] border border-white/10 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 shrink-0 mt-0.5 border border-blue-500/30">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">TradeFourge Insight</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">94% Confidence</span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-snug">
                      London session win-rate is <strong>74%</strong> vs <strong>42%</strong> in NY. Capital reallocated to London Open entries.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Watch Demo Modal */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-2xl bg-[#131622] border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-400 fill-current" /> TradeFourge Platform Walkthrough
              </h3>
              <button
                onClick={() => setDemoOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="aspect-video w-full rounded-xl bg-[#0B0D13] border border-white/10 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center animate-pulse">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">TradeFourge Terminal Overview</h4>
                <p className="text-sm text-gray-400 max-w-md mx-auto mt-1">
                  Watch how TradeFourge ingests CSV executions, calculates institutional statistics, and generates real-time edge recommendations.
                </p>
              </div>
              <Link
                href="/signup"
                onClick={() => setDemoOpen(false)}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-blue-500"
              >
                Launch Terminal Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
