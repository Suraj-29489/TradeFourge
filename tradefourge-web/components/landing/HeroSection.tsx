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
  CheckCircle2,
  Brain,
  BarChart2,
  X,
} from "lucide-react";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";
import { useTheme } from "@/context/ThemeContext";

export const HeroSection: React.FC = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  const { mousePos, isHovered, spotlightProps } = useMouseSpotlight();
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section
      {...spotlightProps}
      className={`relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden transition-colors ${
        isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"
      }`}
    >
      {/* Background Terminal Grid & Subtle Spotlight */}
      <div className={`absolute inset-0 terminal-grid pointer-events-none ${isLight ? "opacity-10" : "opacity-30"}`} />
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-60"
        style={{
          background: isHovered
            ? `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, ${isLight ? "rgba(22, 163, 74, 0.08)" : "rgba(37, 99, 235, 0.08)"}, transparent 70%)`
            : `radial-gradient(800px circle at 50% 30%, ${isLight ? "rgba(22, 163, 74, 0.05)" : "rgba(37, 99, 235, 0.05)"}, transparent 70%)`,
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
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium shadow-sm ${
                isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-[#131622] border-white/10 text-gray-300"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
              <span>Institutional Trading Analytics Terminal</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] ${
                isLight ? "text-slate-900" : "text-white"
              }`}
            >
              Your Edge Isn't Luck. <br className="hidden sm:inline" />
              <span className={isLight ? "text-emerald-600" : "text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400"}>
                It's Hidden In Your Data.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className={`text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed font-sans ${
                isLight ? "text-slate-600" : "text-gray-400"
              }`}
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
                className={`w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-95 text-white ${
                  isLight
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5"
                    : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                }`}
              >
                <span>Start Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <button
                onClick={() => setDemoOpen(true)}
                className={`w-full sm:w-auto px-7 py-4 rounded-xl border font-bold text-base flex items-center justify-center gap-3 transition-all ${
                  isLight
                    ? "bg-white hover:bg-slate-100 border-[#E5E7EB] text-slate-800 shadow-sm hover:border-emerald-500/40"
                    : "bg-[#131622] hover:bg-[#1A1E2E] border-white/10 text-gray-200 hover:border-blue-500/30"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  isLight ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}>
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
              className={`pt-6 border-t grid grid-cols-3 gap-3 text-xs font-mono max-w-lg mx-auto lg:mx-0 ${
                isLight ? "border-slate-200 text-slate-600" : "border-white/10 text-gray-400"
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero Latency</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <ShieldCheck className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                <span>Prop-Firm Ready</span>
              </div>
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <Activity className={`w-4 h-4 shrink-0 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                <span>Instant CSV Import</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Animated Simulated Trading Terminal Preview (ALWAYS DARK FOR CONTRAST) */}
          <div className="lg:col-span-5 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative mx-auto max-w-lg lg:max-w-none"
            >
              {/* Simulated Terminal Preview Card (Dark contrast container with deep navy background & emerald tint) */}
              <div className="relative rounded-2xl bg-[#0E131F] border border-emerald-500/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] space-y-4 text-white font-sans">
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
                  <div className="p-3.5 rounded-xl bg-[#080B11] border border-white/10">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">Net Realized P&L</span>
                    <span className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5 block">+$14,280.50</span>
                    <span className="text-[10px] text-emerald-400/80 font-mono mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> +24.8% Account Growth
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#080B11] border border-white/10">
                    <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">Win Rate / R:R</span>
                    <span className="text-xl font-extrabold text-white font-mono mt-0.5 block">68.4% <span className="text-xs text-gray-400 font-normal">(2.4 R:R)</span></span>
                    <span className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                      <BarChart2 className="w-3 h-3 text-emerald-400" /> Profit Factor: 2.38
                    </span>
                  </div>
                </div>

                {/* Simulated AI Insight Alert */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-start gap-2.5">
                  <Brain className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">AI Optimization Active</strong>
                    <span className="text-[11px] text-emerald-200/90 font-sans">EURUSD NY Overlap entries yield 84% win rate with average 3.1 R:R ratio.</span>
                  </div>
                </div>

                {/* Mini Execution Log Table */}
                <div className="rounded-xl bg-[#0B0D13] border border-white/10 overflow-hidden font-mono text-[11px]">
                  <div className="grid grid-cols-4 p-2 bg-white/5 text-gray-400 font-bold border-b border-white/10">
                    <span>Symbol</span>
                    <span>Type</span>
                    <span>Lots</span>
                    <span className="text-right">P&L</span>
                  </div>
                  <div className="divide-y divide-white/5 text-gray-300">
                    <div className="grid grid-cols-4 p-2">
                      <span className="font-bold text-white">XAUUSD</span>
                      <span className="text-emerald-400">BUY</span>
                      <span>2.50</span>
                      <span className="text-right text-emerald-400 font-bold">+$1,450.00</span>
                    </div>
                    <div className="grid grid-cols-4 p-2">
                      <span className="font-bold text-white">EURUSD</span>
                      <span className="text-emerald-400">BUY</span>
                      <span>5.00</span>
                      <span className="text-right text-emerald-400 font-bold">+$820.00</span>
                    </div>
                    <div className="grid grid-cols-4 p-2">
                      <span className="font-bold text-white">US30</span>
                      <span className="text-rose-400">SELL</span>
                      <span>1.00</span>
                      <span className="text-right text-rose-400 font-bold">-$340.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Interactive Video Demo Modal */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl rounded-2xl bg-[#0F141C] border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white font-mono">TradeFourge Terminal Walkthrough</h3>
              <button onClick={() => setDemoOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center border border-white/10 text-gray-400 text-sm font-mono">
              [ Interactive Simulated Terminal Demo Player ]
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
