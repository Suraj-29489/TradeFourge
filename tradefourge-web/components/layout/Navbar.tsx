"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useUserProfile } from "@/context/UserProfileContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { useCompanionAccount } from "@/context/CompanionAccountContext";
import { Menu, LogOut, User, Settings, ChevronDown, Layers, Zap, RefreshCw, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { useWorkspace } from "@/context/WorkspaceContext";
import { SharedBadge } from "@/components/ui/SharedBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

interface NavbarProps {
  onOpenMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileNav }) => {
  const router = useRouter();
  const init = useJournalStore((s) => s.init);

  const { profile } = useUserProfile();
  const { activeAccount, openAccountTypeModal } = useActiveAccount();
  const { currentWorkspace, getWorkspaceMetadata } = useWorkspace();
  const currentMeta = getWorkspaceMetadata(currentWorkspace);
  const isTfc = currentWorkspace === "tfc";
  const { theme } = useTheme();
  const isLight = theme === "light";

  const {
    currentAccount: tfcAccount,
    connectionStatus,
    extensionInfo,
    reconnect,
    disconnect,
    refreshConnection,
  } = useCompanionAccount();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [connectionDropdownOpen, setConnectionDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const userRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);
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
      if (connectionRef.current && !connectionRef.current.contains(event.target as Node)) {
        setConnectionDropdownOpen(false);
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

  const accountDisplayName = isTfc
    ? tfcAccount ? `${tfcAccount.broker} • ${tfcAccount.accountNumber}` : "TradeForge Companion Account"
    : activeAccount?.account_name ? `CSV • ${activeAccount.account_name}` : "CSV • Personal Account";

  const WorkspaceIcon = currentMeta.icon;

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 backdrop-blur-md select-none font-mono transition-colors ${
      isLight
        ? "bg-white/90 border-b border-[#E5E7EB] shadow-[0_4px_18px_rgba(15,23,42,0.05)] text-slate-900"
        : "bg-[#090D14]/90 border-b border-white/[0.08] text-white"
    }`}>
      {/* LEFT: Mobile hamburger + Workspace Badge & Current Account Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className={`flex items-center justify-center w-9 h-9 rounded-xl border md:hidden transition-colors ${
            isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-white/[0.03] border-white/[0.08] text-gray-300 hover:text-white"
          }`}
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <SharedBadge
            label={currentMeta.name}
            variant="primary"
            icon={WorkspaceIcon}
            size="md"
          />

          <span className={`text-xs font-bold hidden sm:inline-block font-sans ${isLight ? "text-slate-900" : "text-gray-200"}`}>
            {accountDisplayName}
          </span>
        </div>
      </div>

      {/* CENTER: Nothing */}
      <div className="hidden md:block" />

      {/* RIGHT: Connection Dropdown (if TFC) + Change Workspace + User Profile Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* TFC Connection Status Dropdown */}
        {isTfc && (
          <div className="relative" ref={connectionRef}>
            <button
              onClick={() => setConnectionDropdownOpen(!connectionDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                isLight
                  ? "bg-white border-[#E5E7EB] shadow-sm hover:border-emerald-500/40 text-slate-800"
                  : "bg-white/[0.03] border-white/[0.08] hover:border-blue-500/40 text-gray-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${connectionStatus === "Connected" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className={`font-bold text-[11px] ${connectionStatus === "Connected" ? (isLight ? "text-emerald-700" : "text-emerald-400") : "text-rose-500"}`}>
                ● {connectionStatus}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 ${isLight ? "text-slate-400" : "text-gray-400"}`} />
            </button>

            {connectionDropdownOpen && (
              <div className={`absolute right-0 mt-2 w-72 p-3.5 rounded-2xl z-50 space-y-3 shadow-2xl border text-xs font-mono ${
                isLight ? "bg-white border-[#E5E7EB] text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
              }`}>
                <div className={`flex items-center justify-between border-b pb-2 ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
                  <span className={`font-bold flex items-center gap-1.5 font-sans ${isLight ? "text-slate-900" : "text-white"}`}>
                    <Radio className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                    <span>Connection Status</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    connectionStatus === "Connected"
                      ? isLight ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}>
                    {connectionStatus}
                  </span>
                </div>

                {/* Details */}
                <div className={`space-y-1.5 text-[11px] p-2.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-white/[0.02] border-white/[0.06] text-gray-400"
                }`}>
                  <div className="flex justify-between">
                    <span>Browser:</span>
                    <strong className={isLight ? "text-slate-900" : "text-white"}>{extensionInfo.browser}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Runtime:</span>
                    <strong className={isLight ? "text-slate-900" : "text-white"}>{extensionInfo.version}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Scan:</span>
                    <strong className={isLight ? "text-emerald-700" : "text-emerald-400"}>{extensionInfo.lastScan}</strong>
                  </div>
                </div>

                {/* Dropdown Action Items */}
                <div className={`space-y-1 pt-1 border-t ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
                  <button
                    onClick={() => {
                      refreshConnection();
                      setConnectionDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs transition-colors ${
                      isLight ? "text-slate-700 hover:bg-slate-100" : "text-gray-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                    <span>Refresh Connection</span>
                  </button>

                  <button
                    onClick={() => {
                      reconnect();
                      setConnectionDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs transition-colors ${
                      isLight ? "text-slate-700 hover:bg-slate-100" : "text-gray-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Reconnect Engine</span>
                  </button>

                  <button
                    onClick={() => {
                      disconnect();
                      setConnectionDropdownOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Theme Toggle */}
        <ThemeToggle />

        {/* Change Workspace Button */}
        <button
          onClick={openAccountTypeModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
            isLight
              ? "bg-white border-[#E5E7EB] shadow-sm text-slate-800 hover:bg-emerald-50 hover:border-emerald-500/40"
              : "bg-white/[0.03] border-white/[0.08] hover:border-blue-500/40 hover:bg-white/[0.06] text-gray-200"
          }`}
          title="Change Workspace Type"
        >
          <Layers className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
          <span className="font-bold text-[11px]">Change Workspace</span>
        </button>

        {/* User Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
              isLight
                ? "bg-white border-[#E5E7EB] shadow-sm text-slate-800 hover:bg-slate-100"
                : "bg-white/[0.03] border-white/[0.08] hover:border-white/20 text-gray-200"
            }`}
          >
            <User className={`w-3.5 h-3.5 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
            <span className="font-bold max-w-[120px] truncate">{displayName}</span>
            <ChevronDown className={`w-3.5 h-3.5 ${isLight ? "text-slate-400" : "text-gray-400"} shrink-0`} />
          </button>

          {userDropdownOpen && (
            <div className={`absolute right-0 mt-2 w-64 p-3 rounded-2xl border z-50 space-y-2 shadow-2xl ${
              isLight ? "bg-white border-[#E5E7EB] text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
            }`}>
              <div className={`px-2 py-1.5 border-b space-y-0.5 ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
                <p className={`text-xs font-bold font-mono truncate ${isLight ? "text-slate-900" : "text-white"}`}>{profile?.full_name || "Trader"}</p>
                <p className={`text-[10px] font-mono truncate ${isLight ? "text-slate-500" : "text-gray-400"}`}>{userEmail || "user@tradefourge.com"}</p>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs transition-colors font-mono ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-gray-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <User className={`w-4 h-4 ${isLight ? "text-emerald-600" : "text-blue-400"}`} />
                  <span>Profile</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs transition-colors font-mono ${
                    isLight ? "text-slate-700 hover:bg-slate-100" : "text-gray-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <Settings className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
                  <span>Settings</span>
                </Link>
              </div>

              <div className={`pt-1 border-t ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors font-mono"
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
