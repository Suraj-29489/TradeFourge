"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  TableProperties,
  Wallet,
  Upload,
  History,
  Activity,
  CalendarDays,
  User,
  Settings,
  Bell,
  CreditCard,
  Key,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  LogOut,
  BookOpen,
  Target,
  Users,
  MessageSquare,
  Megaphone,
  Sliders,
  Terminal,
  Radio,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { isOwner as checkIsOwner } from "@/lib/config/owner";
import { useUserProfile } from "@/context/UserProfileContext";

// ─── Nav Structure ────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const BASE_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Accounts", href: "/accounts", icon: Wallet },
      { name: "Journal", href: "/journal", icon: TableProperties },
      { name: "Trades", href: "/trades", icon: Activity },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      { name: "Reports", href: "/reports", icon: BookOpen },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const OWNER_NAV_SECTION: NavSection = {
  label: "ADMIN CONTROLS",
  items: [
    { name: "Admin Controls", href: "/admin-controls", icon: ShieldCheck },
    { name: "Users", href: "/admin-controls?tab=users", icon: Users },
    { name: "Monitoring", href: "/admin-controls?tab=monitoring", icon: Activity },
    { name: "Feature Flags", href: "/admin-controls?tab=feature-flags", icon: Sliders },
    { name: "Developer Tools", href: "/admin-controls?tab=developer-tools", icon: Terminal },
  ],
};

// Flat list for backward compatibility
export const NAV_ITEMS = BASE_NAV_SECTIONS.flatMap((s) => s.items);

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

// ─── Single Nav Link ──────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
  requiresAccount,
  hasAccounts,
  onRequireAccount,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
  requiresAccount?: boolean;
  hasAccounts?: boolean;
  onRequireAccount?: () => void;
}) {
  const Icon = item.icon;

  const handleClick = (e: React.MouseEvent) => {
    if (requiresAccount && !hasAccounts && onRequireAccount) {
      e.preventDefault();
      onRequireAccount();
      return;
    }
    if (onClick) onClick();
  };

  return (
    <Link href={item.href} onClick={handleClick} className="block relative">
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl font-mono text-xs font-medium transition-all duration-150 group",
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

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-3 h-px bg-white/10" />;
  }
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 font-mono">
        {label}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isOwnerState, setIsOwnerState] = useState(false);
  const [guardrailModalOpen, setGuardrailModalOpen] = useState(false);
  const { profile, accounts } = useUserProfile();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const hasAccounts = accounts && accounts.length > 0;
  const restrictedHrefs = ["/trades", "/analytics", "/reports", "/calendar"];

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (checkIsOwner({ role: profile?.role, email: user?.email })) {
          setIsOwnerState(true);
        }
      } catch {}
    })();
  }, [profile]);

  const isOwner = isOwnerState || checkIsOwner(profile);
  const navSections = isOwner ? [...BASE_NAV_SECTIONS, OWNER_NAV_SECTION] : BASE_NAV_SECTIONS;

  const isActive = (href: string) => {
    if (href.includes("?")) {
      const [baseHref, query] = href.split("?");
      if (pathname === baseHref && typeof window !== "undefined") {
        return window.location.search.includes(query);
      }
      return false;
    }
    return pathname === href;
  };

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile();
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    if (onCloseMobile) onCloseMobile();
    router.push("/login");
    router.refresh();
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
            className="fixed inset-y-0 left-0 z-50 w-72 bg-dark-bg border-r border-dark-border flex flex-col justify-between md:hidden shadow-2xl overflow-y-auto"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-dark-border">
                <Link href="/" onClick={handleNavClick} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 shadow-glow shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 font-mono">
                    TRADE<span className="text-purple-400">FOURGE</span>
                  </span>
                </Link>
                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav */}
              <nav className="px-3 py-4">
                {navSections.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <div className="px-3 pt-4 pb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 font-mono">
                          {section.label}
                        </span>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.href}
                          item={item}
                          isActive={isActive(item.href)}
                          collapsed={false}
                          onClick={handleNavClick}
                          requiresAccount={restrictedHrefs.includes(item.href)}
                          hasAccounts={hasAccounts}
                          onRequireAccount={() => setGuardrailModalOpen(true)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-dark-border space-y-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              <div className="text-center text-[10px] font-mono text-gray-400">
                TradeFourge · v5.1 Hybrid
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );

  // ── Desktop Sidebar ───────────────────────────────────────────────────────
  const DesktopSidebar = (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="relative z-30 hidden md:flex flex-col h-screen bg-dark-bg border-r border-dark-border select-none shrink-0 overflow-hidden"
    >
      {/* Brand & Logo Collapse Toggle */}
      <div className="flex items-center justify-between h-16 px-3 border-b border-dark-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 overflow-hidden min-w-0 w-full hover:opacity-90 transition-opacity text-left"
          title={collapsed ? "Click logo to expand sidebar" : "Click logo to collapse sidebar"}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 shadow-glow shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col whitespace-nowrap overflow-hidden"
              >
                <span className="text-sm font-extrabold tracking-tight text-white font-mono">
                  TRADE<span className="text-purple-400">FOURGE</span>
                </span>
                <span className="text-[10px] text-purple-400 tracking-wider font-mono font-semibold">
                  HYBRID ENGINE
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5 scrollbar-thin">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.label && (
              <SectionLabel label={section.label} collapsed={collapsed} />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  collapsed={collapsed}
                  requiresAccount={restrictedHrefs.includes(item.href)}
                  hasAccounts={hasAccounts}
                  onRequireAccount={() => setGuardrailModalOpen(true)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Footer */}
      <div className="p-3 border-t border-dark-border shrink-0">
        <div
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-xl bg-[#080B11] border border-dark-border",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            {!collapsed && (
              <span className="text-xs font-mono font-medium text-emerald-400">HYBRID HYBRID</span>
            )}
          </div>
          {!collapsed && (
            <span className="text-[10px] text-gray-400 font-mono">v5.1</span>
          )}
        </div>
      </div>
    </motion.aside>
  );

  return (
    <>
      {MobileDrawer}
      {DesktopSidebar}

      {/* Account Required Guardrail Modal */}
      <AnimatePresence>
        {guardrailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-mono text-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGuardrailModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-sm p-6 rounded-2xl bg-[#0F141C] border border-blue-500/40 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white font-sans">Account Connection Required</h3>
                <p className="text-xs text-gray-400">
                  You need to connect a trading account first before accessing detailed trade analytics, reports, or journal.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setGuardrailModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 font-bold transition-all text-xs"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    setGuardrailModalOpen(false);
                    router.push("/connect");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>Connect Now</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
