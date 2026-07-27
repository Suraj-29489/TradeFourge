"use client";
// components/layout/Navbar.tsx
// Production Navbar with Account Selector Dropdown, Theme Toggle, and User Email Dropdown.

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { Moon, Sun, Menu, LogOut, Wallet, ChevronDown, Plus, Check, User, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init     = useJournalStore(s => s.init);
  const theme    = useJournalStore(s => s.theme);
  const setTheme = useJournalStore(s => s.setTheme);

  const { profile, accounts, defaultAccount, switchDefaultAccount } = useUserProfile();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const accountRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    init();

    async function loadAuthUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    }
    loadAuthUser();

    // Close dropdowns when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
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

  const handleSelectAccount = async (accId: string) => {
    await switchDefaultAccount(accId);
    setAccountDropdownOpen(false);
  };

  const displayName = profile?.username
    ? `@${profile.username}`
    : profile?.full_name || "Trader";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-3 sm:px-6 backdrop-blur-md border-b bg-dark-bg/80 border-dark-border text-xs font-mono">
      {/* Left: Mobile Hamburger + Account Selector Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileNav}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors md:hidden"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Account Selector Dropdown Container */}
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => {
              setAccountDropdownOpen(!accountDropdownOpen);
              setUserDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-purple-500/40 text-xs text-left transition-all"
          >
            <Wallet className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-white font-bold max-w-[80px] sm:max-w-[150px] truncate">
                  {defaultAccount?.account_name ?? "Select Account"}
                </span>
                {defaultAccount && (
                  <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                    defaultAccount.account_type === "Live"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}>
                    {defaultAccount.account_type}
                  </span>
                )}
              </div>
              {defaultAccount && (
                <span className="text-gray-400 text-[10px] hidden sm:inline">
                  {defaultAccount.currency} {defaultAccount.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5 shrink-0" />
          </button>

          {/* Account Dropdown Menu */}
          {accountDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 p-2.5 rounded-2xl dropdown-menu z-50 space-y-1 shadow-2xl">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-dark-border mb-1">
                Your Trading Accounts ({accounts.length})
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
                {accounts.map((acc) => {
                  const isSelected = defaultAccount?.id === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc.id)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-purple-600/15 border-purple-500/40 text-white font-bold"
                          : "bg-dark-card border-dark-border hover:bg-dark-hover text-gray-300"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs">{acc.account_name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 font-bold shrink-0">
                            {acc.account_type}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2">
                          <span>{acc.broker || "Generic"}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">
                            {acc.currency} {acc.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Add Account Shortcut */}
              <div className="pt-1 border-t border-dark-border">
                <button
                  onClick={() => {
                    setAccountDropdownOpen(false);
                    router.push("/accounts");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 font-bold text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Theme Toggle + Username Dropdown */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-dark-card border border-dark-border text-gray-400 hover:text-purple-400 hover:border-purple-500/40 transition-all"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Moon className="w-4 h-4 text-purple-400" />
            : <Sun className="w-4 h-4 text-amber-400" />
          }
        </button>

        {/* Username Dropdown Container */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setUserDropdownOpen(!userDropdownOpen);
              setAccountDropdownOpen(false);
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
              {/* User Identity Header */}
              <div className="px-2 py-1.5 border-b border-dark-border space-y-0.5">
                <p className="text-xs font-bold text-white font-mono truncate">{profile?.full_name || "Trader"}</p>
                <p className="text-[10px] text-gray-400 font-mono truncate">{userEmail || "user@tradefourge.com"}</p>
              </div>

              {/* Navigation Links */}
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

              {/* Log Out Action */}
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
    </header>
  );
};
