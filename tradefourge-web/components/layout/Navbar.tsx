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

        {/* Right: Theme Toggle + Username Dropdown */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={() => alert("Light Mode Coming Soon")}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-dark-card border border-dark-border text-gray-400 hover:text-purple-400 hover:border-purple-500/40 transition-all"
            title="Light Mode Coming Soon"
          >
            <Moon className="w-4 h-4 text-purple-400" />
          </button>

          {/* Username Dropdown Container */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-purple-500/40 text-xs font-mono text-gray-200 transition-all"
            >
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-bold max-w-[120px] truncate">{displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>

            {/* User Account Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 p-3 rounded-2xl dropdown-menu z-50 space-y-2 shadow-2xl">
                <div className="px-2 py-1.5 border-b border-dark-border space-y-0.5">
                  <p className="text-xs font-bold text-white font-mono truncate">{profile?.full_name || "Trader"}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{userEmail || "user@tradefourge.com"}</p>
                </div>

                <div className="space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-dark-hover transition-colors font-mono"
                  >
                    <User className="w-4 h-4 text-purple-400" />
                    <span>Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-dark-hover transition-colors font-mono"
                  >
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="pt-1 border-t border-dark-border">
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
