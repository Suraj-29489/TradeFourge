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
  FileSpreadsheet,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useActiveAccount } from "@/context/ActiveAccountContext";

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

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href} onClick={onClick} className="block relative">
      <div
        className={cn(
          "flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-mono text-xs font-medium transition-all duration-150 group",
          isActive
            ? "bg-blue-500/10 text-white border border-blue-500/30 font-bold"
            : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
        )}
        title={collapsed ? item.name : undefined}
      >
        <Icon
          className={cn(
            "w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105",
            isActive ? "text-blue-400" : "text-gray-400 group-hover:text-gray-200"
          )}
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="whitespace-nowrap truncate font-sans text-xs"
            >
              {item.name}
            </motion.span>
          )}
        </AnimatePresence>

        {isActive && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute right-2 w-1.5 h-4 rounded-full bg-blue-500"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </div>
    </Link>
  );
}

import { useWorkspace } from "@/context/WorkspaceContext";

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { currentWorkspace, getWorkspaceMetadata } = useWorkspace();
  const currentMeta = getWorkspaceMetadata(currentWorkspace);

  const isTfc = currentWorkspace === "tfc";
  const navItems = isTfc ? TFC_NAV_ITEMS : CSV_NAV_ITEMS;
  const WorkspaceIcon = currentMeta.icon;

  const isActive = (href: string) => pathname === href;

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
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
            className="fixed inset-y-0 left-0 z-50 w-72 bg-[#090D14] border-r border-white/[0.08] flex flex-col justify-between md:hidden shadow-2xl overflow-y-auto font-mono"
          >
            <div>
              {/* Top Header - Workspace Branding */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                    {isTfc ? <Zap className="w-4 h-4 text-blue-400 fill-blue-400" /> : <FileSpreadsheet className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-bold text-white font-sans tracking-tight">
                    {isTfc ? "TradeForge Companion" : "CSV Workspace"}
                  </span>
                </div>
                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="px-3 py-4 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={isActive(item.href)}
                    collapsed={false}
                    onClick={handleNavClick}
                  />
                ))}
              </nav>
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
      className="relative z-30 hidden md:flex flex-col h-screen bg-[#090D14] border-r border-white/[0.08] select-none shrink-0 overflow-hidden font-mono"
    >
      {/* Top Header - Workspace Branding & Toggle */}
      <div className="flex items-center justify-between h-16 px-3 border-b border-white/[0.08] shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 overflow-hidden min-w-0 w-full hover:opacity-90 transition-opacity text-left"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            {isTfc ? <Zap className="w-4.5 h-4.5 text-blue-400 fill-blue-400" /> : <FileSpreadsheet className="w-4.5 h-4.5" />}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex flex-col whitespace-nowrap overflow-hidden"
              >
                <span className="text-sm font-bold tracking-tight text-white font-sans">
                  {isTfc ? "TradeForge Companion" : "CSV Workspace"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-1 scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </motion.aside>
  );

  return (
    <>
      {MobileDrawer}
      {DesktopSidebar}
    </>
  );
};
