"use client";
// components/layout/Navbar.tsx
// Production Navbar with simplified Accounts ▼ Dropdown, Theme Toggle, and User Profile Dropdown.

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { Moon, Sun, Menu, LogOut, Wallet, ChevronDown, Plus, Check, User, Settings } from "lucide-react";
import { MultiAccountFilter } from "@/components/accounts/MultiAccountFilter";
import { createClient } from "@/lib/supabase/client";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import type { NewTradingAccount } from "@/types/database";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init     = useJournalStore(s => s.init);
  const theme    = useJournalStore(s => s.theme);
  const setTheme = useJournalStore(s => s.setTheme);

  const { profile, accounts, selectedAccountIds, setSelectedAccountIds, addNewAccount } = useUserProfile();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  const userRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    init();

    async function loadAuthUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? "");
      }
    }
    loadAuthUser();

    function handleClickOutside(event: MouseEvent) {
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [init]);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
    router.refresh();
  };

  const handleAddAccount = async (data: NewTradingAccount) => {
    await addNewAccount(data);
    setAddModalOpen(false);
  };

  const displayName = profile?.username
    ? `@${profile.username}`
    : profile?.full_name || "Trader";

  return (
    <header className="sticky top-0 z-20 h-16 backdrop-blur-md border-b bg-dark-bg/80 border-dark-border text-xs font-mono">
      <div className="max-w-7xl mx-auto w-full h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Mobile Hamburger + MultiAccountFilter */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Hamburger */}
          <button
            onClick={onOpenMobileNav}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors md:hidden"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Multi-Account Portfolio Filter */}
          <MultiAccountFilter
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            onChange={setSelectedAccountIds}
          />
        </div>

        {/* Right: Live Status Indicator + Theme Toggle + Username Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Status Popover Dropdown Container */}
          <div className="relative hidden sm:block font-mono">
            <button
              onClick={() => setStatusPopoverOpen(!statusPopoverOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/40 text-xs font-mono transition-all text-left"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-gray-200 font-medium text-[11px]">Companion Connected</span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {statusPopoverOpen && (
              <div className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-2xl z-50 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>🟢 Companion Connected</span>
                  </div>
                  <span className="text-[10px] text-gray-400">WebSocket</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Extension Version:</span>
                    <strong className="text-white">v1.2</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Accounts Linked:</span>
                    <strong className="text-blue-400">3 Connected</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">History Status:</span>
                    <strong className="text-emerald-400">Imported</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Realtime Stream:</span>
                    <strong className="text-emerald-400">Active</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Last Sync:</span>
                    <strong className="text-gray-300">2 seconds ago</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.08]">
                  <Link
                    href="/connect"
                    onClick={() => setStatusPopoverOpen(false)}
                    className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-center font-bold text-[11px] text-blue-400 block transition-colors"
                  >
                    Manage Companion Connection →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => alert("Light Mode Coming Soon")}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-blue-400 hover:border-blue-500/40 transition-all"
            title="Light Mode Coming Soon"
          >
            <Moon className="w-4 h-4 text-blue-400" />
          </button>

          {/* Username Dropdown Container */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-blue-500/40 text-xs font-mono text-gray-200 transition-all"
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold max-w-[120px] truncate">{displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>

            {/* User Account Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 p-3 rounded-2xl dropdown-menu z-50 space-y-2 shadow-2xl bg-[#0F141C] border border-white/[0.08]">
                <div className="px-2 py-1.5 border-b border-white/[0.08] space-y-0.5">
                  <p className="text-xs font-bold text-white font-mono truncate">{profile?.full_name || "Trader"}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{userEmail || "user@tradefourge.com"}</p>
                </div>

                <div className="space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.05] transition-colors font-mono"
                  >
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/[0.05] transition-colors font-mono"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="pt-1 border-t border-white/[0.08]">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors font-mono"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <AccountFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddAccount}
      />
    </header>
  );
};
