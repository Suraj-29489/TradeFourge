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
import { useTheme } from "@/context/ThemeContext";

const FEATURES = [
  {
    title: "Admin Controls",
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
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

function FeatureCard({ feature }: { feature: typeof FEATURES[0] }) {
  const Icon = feature.icon;
  const { isHovered, mousePos, spotlightProps } = useMouseSpotlight();
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <motion.div
      {...spotlightProps}
      variants={cardVariants}
      className={`group relative p-7 rounded-2xl border transition-all duration-300 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between ${
        isLight
          ? "bg-white border-[#E5E7EB] shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] hover:border-emerald-500/40"
          : "bg-[#131622] border-white/10 hover:border-blue-500/40 shadow-xl"
      }`}
    >
      {/* Mouse Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${isLight ? "rgba(22, 163, 74, 0.12)" : "rgba(37, 99, 235, 0.12)"}, transparent 80%)`
            : "none",
        }}
      />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between font-mono">
          <div className={`p-3 rounded-xl border transition-colors ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-[#0B0D13] border-white/10 text-gray-300 group-hover:text-blue-400"
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-white/5 border-white/10 text-gray-400"
          }`}>
            {feature.badge}
          </span>
        </div>

        <h3 className={`text-xl font-bold tracking-tight transition-colors ${
          isLight ? "text-slate-900 group-hover:text-emerald-700" : "text-white group-hover:text-blue-300"
        }`}>
          {feature.title}
        </h3>

        <p className={`text-sm leading-relaxed font-sans ${
          isLight ? "text-slate-600" : "text-gray-400"
        }`}>
          {feature.description}
        </p>
      </div>

      <div className="pt-6 relative z-10">
        <Link
          href={feature.href}
          className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold transition-colors group-hover:translate-x-1 duration-200 ${
            isLight ? "text-emerald-600 hover:text-emerald-700" : "text-blue-400 hover:text-blue-300"
          }`}
        >
          <span>Explore Feature</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

export const FeaturesSection: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section id="features" className={`py-24 relative z-10 ${isLight ? "bg-[#F8FAFC]" : "bg-[#0B0D13]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-semibold uppercase tracking-wider ${
            isLight ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-[#131622] border-white/10 text-gray-300"
          }`}>
            Platform Capabilities
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            Institutional-Grade Analytics. <br />
            <span className={isLight ? "text-emerald-600" : "text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400"}>
              Simplified For Every Strategy.
            </span>
          </h2>
          <p className={`text-base sm:text-lg ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            Built from the ground up for forex, futures, crypto, and stock traders looking to transform raw trades into a repeatable edge.
          </p>
        </div>

        {/* Feature Cards Grid with Staggered Motion */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
