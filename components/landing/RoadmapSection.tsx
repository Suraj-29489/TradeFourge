"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import {
  RefreshCw,
  Cpu,
  History,
  Shield,
  Smartphone,
  PlaySquare,
  Users,
  Store,
  Sparkles,
} from "lucide-react";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

const ROADMAP_ITEMS = [
  {
    title: "Live Broker Sync",
    description: "Real-time socket & API connection for Exness MT4/MT5, cTrader, and Interactive Brokers.",
    icon: RefreshCw,
  },
  {
    title: "AI Strategy Builder",
    description: "Generate rule-based setup playbooks with machine learning pattern recognition.",
    icon: Cpu,
  },
  {
    title: "Backtesting Lab",
    description: "Simulate multi-asset strategies across 10+ years of institutional tick data.",
    icon: History,
  },
  {
    title: "Prop Firm Dashboard",
    description: "Live challenge rules monitoring for FTMO, FundedNext, and top funding evaluations.",
    icon: Shield,
  },
  {
    title: "Mobile Application",
    description: "Native iOS & Android mobile companion app with push notifications for tilt alerts.",
    icon: Smartphone,
  },
  {
    title: "Trade Replay",
    description: "Candle-by-candle position playback to review execution psychology and entry timing.",
    icon: PlaySquare,
  },
  {
    title: "Community Hub",
    description: "Benchmark your metrics against verified profitable traders and share audited logs.",
    icon: Users,
  },
  {
    title: "Strategy Marketplace",
    description: "Monetize and license verified trading playbooks and algorithmic edge rules.",
    icon: Store,
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 25, scale: 0.96 },
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

function RoadmapCard({ item }: { item: typeof ROADMAP_ITEMS[0] }) {
  const { mousePos, isHovered, spotlightProps } = useMouseSpotlight();
  const Icon = item.icon;

  return (
    <motion.div
      {...spotlightProps}
      variants={cardVariants}
      className="group relative p-6 rounded-2xl bg-[#131622] border border-white/10 hover:border-purple-500/40 transition-all duration-300 hover:-translate-y-1 shadow-lg overflow-hidden flex flex-col justify-between"
    >
      {/* Mouse Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, rgba(124, 58, 237, 0.12), transparent 80%)`
            : "none",
        }}
      />

      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-xl bg-[#0B0D13] border border-white/10 text-gray-300 group-hover:text-purple-400 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30 animate-pulse">
            Coming Soon
          </span>
        </div>

        <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
          {item.title}
        </h3>

        <p className="text-xs text-gray-400 leading-relaxed font-sans">
          {item.description}
        </p>
      </div>
    </motion.div>
  );
}

export const RoadmapSection: React.FC = () => {
  return (
    <section id="roadmap" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Platform Roadmap
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Coming Soon. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-purple-400">
              TradeFourge Is Constantly Evolving.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            We are building the future of institutional trading analytics. Here is a preview of upcoming modules in development.
          </p>
        </div>

        {/* Roadmap Cards Grid with Staggered Motion */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {ROADMAP_ITEMS.map((item) => (
            <RoadmapCard key={item.title} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
