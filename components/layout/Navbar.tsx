"use client";
// components/layout/Navbar.tsx
// Global application navbar synchronized with useUserProfile context.
// Clean layout without redundant toolbar exports.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { Upload, Moon, Sun, Menu, LogOut, User, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchDefaultAccount } from "@/lib/supabase/accounts";
import type { TradingAccount } from "@/types/database";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init     = useJournalStore(s => s.init);
  const theme    = useJournalStore(s => s.theme);
  const setTheme = useJournalStore(s => s.setTheme);

  const { profile } = useUserProfile();
  const [defaultAccount, setDefaultAccount] = useState<TradingAccount | null>(null);
  const supabase = createClient();

  useEffect(() => {
    init();

    async function fetchNavbarAccount() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: acc } = await fetchDefaultAccount(user.id);
          if (acc) setDefaultAccount(acc);
        }
      } catch {}
    }
    fetchNavbarAccount();
  }, [init]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-3 sm:px-6 backdrop-blur-md border-b bg-dark-bg/80 border-dark-border">
      {/* Left: Mobile Menu Toggle + Account Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileNav}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors md:hidden"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Default Account Chip */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs sm:text-sm hover:border-purple-500/40 transition-colors">
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
          <span className="text-gray-200 font-medium max-w-[100px] sm:max-w-[160px] truncate font-mono">
            {defaultAccount?.account_name ?? "Default Account"}
          </span>
        </div>

        {/* Account Type Badge */}
        {defaultAccount && (
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-xs font-semibold">
            {defaultAccount.account_type}
          </div>
        )}

        {/* Balance (large screens) */}
        {defaultAccount && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-mono">
            <span className="text-gray-400">Balance:</span>
            <span className="font-bold text-white">
              {defaultAccount.currency} {defaultAccount.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Link
          href="/upload"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm shadow-glow transition-all active:scale-95"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Upload CSV</span>
        </Link>

        {/* User Profile Avatar Link */}
        <Link
          href="/profile"
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-dark-card border border-dark-border hover:border-purple-500/40 text-xs font-mono text-gray-200 transition-colors"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-6 h-6 rounded-lg object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-lg bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-[10px]">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
            </div>
          )}
          <span className="hidden md:inline font-bold">{profile?.full_name || "Trader"}</span>
        </Link>

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

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-mono font-medium transition-all"
          title="Sign out of TradeFourge"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
