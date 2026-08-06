"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  TableProperties,
  Activity,
  CalendarDays,
  BarChart3,
  BookOpen,
  Settings,
  X,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const CSV_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Journal", href: "/journal", icon: TableProperties },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

const TFC_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Journal", href: "/journal", icon: TableProperties },
  { name: "Trades", href: "/trades", icon: Activity },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Reports", href: "/reports", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { currentWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const isTfc = currentWorkspace === "tfc";
  const navItems = isTfc ? TFC_NAV_ITEMS : CSV_NAV_ITEMS;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  // ── Mobile Drawer ─────────────────────────────────────────────────────────
  const MobileDrawer = (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={`fixed inset-y-0 left-0 z-50 w-72 border-r flex flex-col justify-between md:hidden shadow-2xl overflow-y-auto font-mono ${
              isLight ? "bg-white border-slate-200" : "bg-[#090D14] border-white/[0.08]"
            }`}
          >
            <div>
              {/* Top Header - Workspace Branding */}
              <div className={`flex items-center justify-between h-16 px-4 border-b ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={isLight ? "/logo_full_light.png" : "/logo_full.png"}
                    alt="TradeFourge Logo"
                    className="h-7 w-auto object-contain"
                  />
                </div>
                <button
                  onClick={onCloseMobile}
                  className={`p-2 rounded-xl transition-colors ${
                    isLight ? "text-slate-500 hover:bg-slate-100" : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav Items */}
              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-medium transition-all ${
                        active
                          ? isLight
                            ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-bold"
                            : "bg-blue-500/10 text-white border border-blue-500/30 font-bold"
                          : isLight
                          ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? (isLight ? "text-emerald-600" : "text-blue-400") : "text-gray-400"}`} />
                      <span className="font-sans text-xs">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className={`p-4 border-t flex items-center justify-center ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
              <span className="text-[11px] font-mono opacity-60 text-slate-500 dark:text-gray-500 select-none">
                TradeFourge v5.5.0
              </span>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );

  // ── Desktop Sidebar ───────────────────────────────────────────────────────
  const DesktopSidebar = (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`relative z-30 hidden md:flex flex-col h-screen border-r select-none shrink-0 overflow-hidden font-mono ${
        isLight ? "bg-white border-slate-200" : "bg-[#090D14] border-white/[0.08]"
      }`}
    >
      {/* Top Header - Workspace Branding & Toggle */}
      <div className={`flex items-center justify-between h-16 px-3 border-b shrink-0 ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 overflow-hidden min-w-0 w-full hover:opacity-90 transition-opacity text-left"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collapsed ? (isLight ? "/logo_icon_light.png" : "/logo_icon.png") : (isLight ? "/logo_full_light.png" : "/logo_full.png")}
            alt="TradeFourge"
            className={`${collapsed ? "w-8 h-8" : "h-7"} w-auto object-contain shrink-0`}
          />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-1 scrollbar-thin">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block relative">
              <div
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-medium transition-all duration-150 group ${
                  active
                    ? isLight
                      ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 font-bold"
                      : "bg-blue-500/10 text-white border border-blue-500/30 font-bold"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                }`}
                title={collapsed ? item.name : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    active ? (isLight ? "text-emerald-600" : "text-blue-400") : isLight ? "text-slate-500" : "text-gray-400"
                  }`}
                />
                {!collapsed && (
                  <span className="whitespace-nowrap truncate font-sans text-xs">
                    {item.name}
                  </span>
                )}

                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className={`absolute right-2 w-1.5 h-4 rounded-full ${isLight ? "bg-emerald-600" : "bg-blue-500"}`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer Version Badge */}
      <div className={`p-3.5 border-t shrink-0 flex items-center justify-center ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
        <span className={`text-[11px] font-mono opacity-60 select-none ${collapsed ? "text-[10px]" : ""} ${isLight ? "text-slate-500" : "text-gray-500"}`}>
          {collapsed ? "v5.5.0" : "TradeFourge v5.5.0"}
        </span>
      </div>
    </motion.aside>
  );

  return (
    <>
      {MobileDrawer}
      {DesktopSidebar}
    </>
  );
};
