"use client";

import React from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  TableProperties,
  RefreshCw,
  Brain,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

const FEATURES = [
  {
    title: "Mission Control",
    description: "Command center featuring real-time equity curves, drawdown monitoring, account balance tracking, and multi-journal switching.",
    icon: LayoutDashboard,
    badge: "Core Terminal",
    href: "/dashboard",
  },
  {
    title: "Performance Lab",
    description: "Deep statistical suite calculating Profit Factor, Average Risk:Reward ratio, win/loss streaks, gross P&L, and strategy efficiency metrics.",
    icon: BarChart3,
    badge: "Institutional Stats",
    href: "/performance",
  },
  {
    title: "Trade Journal",
    description: "Full audited trade ledger with position details, execution timestamps, duration tracking, P&L breakdown, and instant filtering.",
    icon: TableProperties,
    badge: "Audited Ledger",
    href: "/journal",
  },
  {
    title: "Broker Sync",
    description: "Instant CSV & API parser engine supporting Exness MT4/MT5, cTrader, NinjaTrader, and major prop-firm trade export files.",
    icon: RefreshCw,
    badge: "Auto Parser",
    href: "/upload",
  },
  {
    title: "AI Coach",
    description: "Automated trading intelligence engine that spots behavioral patterns, alerts on tilt risks, scores setup quality, and optimizes entry timing.",
    icon: Brain,
    badge: "AI Powered",
    href: "/dashboard",
  },
  {
    title: "Advanced Reports",
    description: "Generate production-grade PDF and Excel performance audit reports ready for prop-firm challenges, tax compliance, and investor review.",
    icon: FileSpreadsheet,
    badge: "PDF & Excel",
    href: "/reports",
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

function FeatureCard({ feature }: { feature: typeof FEATURES[0] }) {
  const { mousePos, isHovered, spotlightProps } = useMouseSpotlight();
  const Icon = feature.icon;

  return (
    <motion.div
      {...spotlightProps}
      variants={cardVariants}
      className="group relative p-7 rounded-2xl bg-[#131622] border border-white/10 hover:border-purple-500/40 transition-all duration-300 hover:-translate-y-1.5 shadow-xl overflow-hidden flex flex-col justify-between"
    >
      {/* Mouse Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(124, 58, 237, 0.12), transparent 80%)`
            : "none",
        }}
      />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between font-mono">
          <div className="p-3 rounded-xl bg-[#0B0D13] border border-white/10 text-gray-300 group-hover:text-purple-400 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-400">
            {feature.badge}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
          {feature.title}
        </h3>

        <p className="text-sm text-gray-400 leading-relaxed font-sans">
          {feature.description}
        </p>
      </div>

      <div className="pt-6 relative z-10">
        <Link
          href={feature.href}
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 hover:text-purple-300 transition-colors group-hover:translate-x-1 duration-200"
        >
          <span>Explore Feature</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Institutional-Grade Analytics. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-purple-400">
              Simplified For Every Strategy.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            Built from the ground up for forex, futures, crypto, and stock traders looking to transform raw trades into a repeatable edge.
          </p>
        </div>

        {/* Feature Cards Grid with Staggered Motion */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
