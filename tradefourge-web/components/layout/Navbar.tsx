"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { Moon, Sun, Menu, LogOut, User, Settings, FileSpreadsheet, ChevronDown, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init = useJournalStore((s) => s.init);
  const theme = useJournalStore((s) => s.theme);
  const setTheme = useJournalStore((s) => s.setTheme);

  const { profile } = useUserProfile();
  const { activeAccount } = useActiveAccount();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const userRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    init();

    async function loadAuthUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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

  const displayName = profile?.username
    ? `@${profile.username}`
    : profile?.full_name || "Trader";

  const accountDisplayName = activeAccount?.account_name
    ? `CSV • ${activeAccount.account_name}`
    : "CSV • Personal Account";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-[#090D14]/90 backdrop-blur-md border-b border-white/[0.08] select-none font-mono">
      {/* LEFT: Mobile hamburger + CSV Workspace Badge & Current Account Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-300 hover:text-white md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 font-bold">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV WORKSPACE</span>
          </div>
          <span className="text-xs font-bold text-gray-200 hidden sm:inline-block font-sans">
            {accountDisplayName}
          </span>
        </div>
      </div>

      {/* CENTER: Nothing */}
      <div className="hidden md:block" />

      {/* RIGHT: Light/Dark Toggle + Notifications + User Profile Dropdown (No AI Companion elements) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Light / Dark Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20 transition-all"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-blue-400" />
          )}
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 text-xs font-mono text-gray-200 transition-all"
          >
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold max-w-[120px] truncate">{displayName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>

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
    </header>
  );
};
