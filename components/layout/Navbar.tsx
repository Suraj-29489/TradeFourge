"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useJournalMetrics } from "@/hooks/useJournalMetrics";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { ExportToolbar } from "@/components/export/ExportToolbar";
import { Upload, Wallet, Moon, Sun, ShieldCheck, Menu, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init           = useJournalStore(s => s.init);
  const accountType    = useJournalStore(s => s.accountType);
  const accountBalance = useJournalStore(s => s.accountBalance);
  const theme          = useJournalStore(s => s.theme);
  const setTheme       = useJournalStore(s => s.setTheme);
  const journals       = useJournalStore(s => s.journals);

  const { stats } = useJournalMetrics();
  const { format, formatSigned } = useCurrencyFormatter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    init();
    
    // Fetch logged in Supabase user profile
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch {}
    }
    fetchUser();
  }, [init]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
    router.refresh();
  };

  const accountName = journals.length > 0
    ? journals.find(j => j.lastKnownBalance === accountBalance)?.accountName ?? journals[0].accountName
    : "No Journal";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-3 sm:px-6 backdrop-blur-md border-b"
            style={{ backgroundColor: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
      {/* Left: Mobile Menu Toggle + Account Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Button (<768px) */}
        <button
          onClick={onOpenMobileNav}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-hover transition-colors md:hidden"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Account Name */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs sm:text-sm hover:border-brand-500/40 transition-colors">
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-400 flex-shrink-0" />
          <span className="text-gray-200 font-medium max-w-[100px] sm:max-w-[140px] truncate">{accountName}</span>
        </div>

        {/* Account Type Badge */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 font-mono text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{accountType}</span>
        </div>

        {/* Balance (Medium & Up) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-mono">
          <span className="text-gray-400">Balance:</span>
          <span className="font-bold text-white">
            {accountBalance !== null ? format(accountBalance) : "N/A"}
          </span>
          <span className={`font-semibold ml-1 ${stats.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            ({formatSigned(stats.netProfit)})
          </span>
        </div>
      </div>

      {/* Right: Actions & Profile Logout */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ExportToolbar />

        <Link
          href="/upload"
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm shadow-glow transition-all active:scale-95"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Upload CSV</span>
        </Link>

        {/* User Email Chip (if logged in) */}
        {userEmail && (
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border text-xs font-mono text-gray-300">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <span className="max-w-[120px] truncate">{userEmail}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-dark-card border border-dark-border text-gray-400 hover:text-brand-400 hover:border-brand-500/40 transition-all"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Moon className="w-4 h-4 text-brand-400" />
            : <Sun className="w-4 h-4 text-amber-400" />
          }
        </button>

        {/* Logout Button */}
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
