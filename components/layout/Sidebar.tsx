"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TableProperties,
  CalendarDays,
  BarChart3,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Trades", href: "/trades", icon: TableProperties },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Statistics", href: "/statistics", icon: BarChart3 },
  { name: "Upload CSV", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="relative z-30 flex flex-col h-screen bg-[#0C1019] border-r border-[#1F293D] select-none"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#1F293D]">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 shadow-glow shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col whitespace-nowrap"
              >
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  TRADING
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-brand-600/30 text-brand-400 border border-brand-500/30">
                    Pro
                  </span>
                </span>
                <span className="text-[10px] text-gray-400 tracking-wider font-mono">
                  JOURNAL TERMINAL
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors hidden md:flex items-center justify-center"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="block relative">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                  isActive
                    ? "bg-brand-600/20 text-white border border-brand-500/30 shadow-glow"
                    : "text-gray-400 hover:text-gray-200 hover:bg-dark-hover"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-brand-400" : "text-gray-400 group-hover:text-gray-200"
                  )}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute right-2 w-1.5 h-5 rounded-full bg-brand-500 shadow-glow"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Terminal Live Status Badge */}
      <div className="p-3 border-t border-[#1F293D]">
        <div
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-xl bg-dark-card border border-dark-border",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {!collapsed && (
              <span className="text-xs font-mono font-medium text-emerald-400">
                CONNECTED
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="text-[10px] text-gray-500 font-mono">v1.0.0</span>
          )}
        </div>
      </div>
    </motion.aside>
  );
};
