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
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";

export const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Trades", href: "/trades", icon: TableProperties },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Statistics", href: "/statistics", icon: BarChart3 },
  { name: "Upload CSV", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Slide-over Drawer Backdrop (<768px) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Slide-over Drawer Content (<768px) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-dark-card border-r border-dark-border flex flex-col justify-between md:hidden shadow-2xl"
          >
            <div>
              {/* Header with Close button */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-dark-border">
                <Link href="/" onClick={handleNavClick} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 shadow-glow shrink-0">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-mono">
                    TRADING
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-brand-600/30 text-brand-400 border border-brand-500/30">
                      Pro
                    </span>
                  </span>
                </Link>

                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Nav Links */}
              <nav className="px-3 py-4 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link key={item.href} href={item.href} onClick={handleNavClick} className="block relative">
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                          isActive
                            ? "bg-brand-600/20 text-white border border-brand-500/30 shadow-glow font-bold"
                            : "text-gray-400 hover:text-gray-200 hover:bg-dark-hover"
                        )}
                      >
                        <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-brand-400" : "text-gray-400")} />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-dark-border text-center text-xs font-mono text-gray-400">
              Yamada Trading Journal · v1.2.0
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (>=768px) */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="relative z-30 hidden md:flex flex-col h-screen bg-dark-card border-r border-dark-border select-none shrink-0"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-dark-border">
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
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors flex items-center justify-center"
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
        <div className="p-3 border-t border-dark-border">
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
                <span className="text-xs font-mono font-medium text-emerald-500">
                  CONNECTED
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="text-[10px] text-gray-500 font-mono">v1.2.0</span>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
};
