"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import {
  RefreshCw,
  Cpu,
  History,
  Smartphone,
  Users,
  Store,
  Sparkles,
} from "lucide-react";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";
import { useTheme } from "@/context/ThemeContext";

const ROADMAP_ITEMS = [
  {
    title: "Live Broker Sync",
    description: "Real-time socket connection & direct API sync for Exness MT4/MT5, cTrader, and Interactive Brokers.",
    icon: RefreshCw,
    badge: "In Development",
  },
  {
    title: "AI Strategy Builder",
    description: "Generate rule-based setup playbooks with machine learning pattern recognition and backtest validation.",
    icon: Cpu,
    badge: "Planning Phase",
  },
  {
    title: "Backtesting Lab",
    description: "Simulate multi-asset strategies across 10+ years of institutional tick data with slippage modeling.",
    icon: History,
    badge: "Q3 Roadmap",
  },
  {
    title: "Mobile Application",
    description: "Native iOS & Android mobile companion app with push notifications for real-time tilt & drawdown alerts.",
    icon: Smartphone,
    badge: "Q4 Roadmap",
  },
  {
    title: "Trader Community",
    description: "Benchmark your metrics against verified profitable traders and share audited execution playbooks.",
    icon: Users,
    badge: "Community Hub",
  },
  {
    title: "Strategy Marketplace",
    description: "Monetize and license verified trading playbooks, algorithmic edge rules, and custom indicator scripts.",
    icon: Store,
    badge: "Marketplace",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

function RoadmapCard({ item }: { item: typeof ROADMAP_ITEMS[0] }) {
  const Icon = item.icon;
  const { isHovered, mousePos, spotlightProps } = useMouseSpotlight();
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <motion.div
      {...spotlightProps}
      variants={cardVariants}
      className={`group relative p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col justify-between ${
        isLight
          ? "bg-white border-[#E5E7EB] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] hover:border-emerald-500/40"
          : "bg-[#131622] border-white/10 hover:border-blue-500/40 shadow-lg"
      }`}
    >
      {/* Mouse Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, ${isLight ? "rgba(22, 163, 74, 0.12)" : "rgba(37, 99, 235, 0.12)"}, transparent 80%)`
            : "none",
        }}
      />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-xl border transition-colors ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-[#0B0D13] border-white/10 text-gray-300 group-hover:text-blue-400"
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${
            isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-blue-600/20 text-blue-400 border-blue-500/30"
          }`}>
            Coming Soon
          </span>
        </div>

        <h3 className={`text-lg font-bold tracking-tight transition-colors ${
          isLight ? "text-slate-900 group-hover:text-emerald-700" : "text-white group-hover:text-blue-300"
        }`}>
          {item.title}
        </h3>

        <p className={`text-xs leading-relaxed font-sans ${isLight ? "text-slate-600" : "text-gray-400"}`}>
          {item.description}
        </p>
      </div>

      <div className={`pt-4 mt-2 border-t flex items-center justify-between text-[10px] font-mono relative z-10 ${
        isLight ? "border-slate-200 text-slate-500" : "border-white/5 text-gray-500"
      }`}>
        <span>Status:</span>
        <span className={`font-semibold ${isLight ? "text-emerald-700" : "text-blue-300"}`}>{item.badge}</span>
      </div>
    </motion.div>
  );
}

export const RoadmapSection: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section id="roadmap" className={`py-24 relative z-10 ${isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold uppercase tracking-wider ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-[#131622] border-white/10 text-gray-300"
          }`}>
            <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} /> Platform Roadmap
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            Future Innovations. <br />
            <span className={isLight ? "text-emerald-600" : "text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400"}>
              TradeFourge Is Constantly Evolving.
            </span>
          </h2>
          <p className={`text-base sm:text-lg ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            We are engineering the future of institutional trading analytics. Here is a preview of upcoming modules in active development.
          </p>
        </div>

        {/* Roadmap Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {ROADMAP_ITEMS.map((item) => (
            <RoadmapCard key={item.title} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
