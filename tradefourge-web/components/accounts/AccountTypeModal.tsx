"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ArrowRight, Lock } from "lucide-react";
import { useWorkspace, WorkspaceMode } from "@/context/WorkspaceContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { SharedBadge } from "@/components/ui/SharedBadge";
import { useTheme } from "@/context/ThemeContext";

interface AccountTypeModalProps {
  open: boolean;
  onSelectWorkspace?: (mode: WorkspaceMode) => void;
}

export const AccountTypeModal: React.FC<AccountTypeModalProps> = ({ open, onSelectWorkspace }) => {
  const router = useRouter();
  const { currentWorkspace, selectWorkspace, isWorkspaceActive, workspaces } = useWorkspace();
  const { selectAccountType, closeAccountTypeModal } = useActiveAccount();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Listen for ESC key press to dismiss modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAccountTypeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeAccountTypeModal]);

  if (!open) return null;

  const handleCardClick = (mode: WorkspaceMode) => {
    selectWorkspace(mode);
    if (mode === "csv" || mode === "tfc") {
      selectAccountType(mode);
    }
    closeAccountTypeModal();

    if (onSelectWorkspace) {
      onSelectWorkspace(mode);
    } else {
      if (mode === "mt5") {
        router.push("/mt5/dashboard");
      } else {
        router.push(mode === "tfc" ? "/dashboard" : "/accounts");
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAccountTypeModal}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Centered Institutional Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={`relative z-10 w-full max-w-4xl p-7 sm:p-9 rounded-3xl border shadow-2xl space-y-7 ${
            isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
          }`}
        >
          {/* Close Button X */}
          <button
            onClick={closeAccountTypeModal}
            className={`absolute top-7 right-7 p-2 rounded-xl transition-colors ${
              isLight ? "text-slate-400 hover:text-slate-900 hover:bg-slate-100" : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className={`space-y-1.5 text-center sm:text-left border-b pb-5 pr-12 ${isLight ? "border-slate-200" : "border-white/[0.08]"}`}>
            <h2 className={`text-xl sm:text-2xl font-bold tracking-tight font-sans ${isLight ? "text-slate-900" : "text-white"}`}>
              Select Trading Workspace Mode
            </h2>
            <p className={`text-xs sm:text-sm font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              Choose how you want to interact with your trading accounts.
            </p>
          </div>

          {/* Option Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch font-mono">
            {workspaces.map((ws) => {
              const Icon = ws.icon;
              const isActive = isWorkspaceActive(ws.id);
              const isEnabled = ws.isEnabled;

              return (
                <motion.div
                  key={ws.id}
                  whileHover={isEnabled ? { scale: 1.01 } : {}}
                  transition={{ duration: 0.15 }}
                  onClick={() => handleCardClick(ws.id)}
                  className={`relative p-6 sm:p-7 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-6 h-full select-none ${
                    !isEnabled
                      ? isLight ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed" : "bg-white/[0.01] border-white/[0.06] opacity-40 cursor-not-allowed"
                      : isActive
                      ? isLight ? "bg-emerald-500/10 border-2 border-emerald-600 shadow-xl cursor-pointer" : "bg-blue-600/10 border-2 border-blue-600 shadow-xl cursor-pointer"
                      : isLight ? "bg-slate-50 border-slate-200 hover:border-emerald-500/60 hover:bg-slate-100 cursor-pointer" : "bg-white/[0.02] border-white/[0.08] hover:border-blue-500/60 hover:bg-white/[0.04] cursor-pointer"
                  }`}
                >
                  <div className="space-y-5">
                    {/* Icon & Badge Row */}
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                          isActive
                            ? isLight ? "bg-emerald-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                            : isEnabled
                            ? isLight ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600" : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                            : isLight ? "bg-slate-200 text-slate-500" : "bg-white/[0.04] text-gray-500"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {isActive ? (
                        <SharedBadge label="Current Workspace" variant="primary" icon={Check} size="sm" />
                      ) : !isEnabled ? (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          isLight ? "bg-slate-200 border-slate-300 text-slate-600" : "bg-white/5 border-white/10 text-gray-400"
                        }`}>
                          <Lock className="w-3 h-3" /> Coming Soon
                        </span>
                      ) : null}
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <h3 className={`text-base font-extrabold tracking-tight font-sans ${isLight ? "text-slate-900" : "text-white"}`}>
                        {ws.name}
                      </h3>
                      <p className={`text-xs leading-relaxed font-sans ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                        {ws.description}
                      </p>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className={`pt-4 border-t flex items-center justify-between text-xs font-bold font-sans ${
                    isLight ? "border-slate-200" : "border-white/[0.08]"
                  }`}>
                    {isActive ? (
                      <span className={isLight ? "text-emerald-700" : "text-blue-400"}>Active Mode</span>
                    ) : isEnabled ? (
                      <span className={`flex items-center gap-1.5 transition-colors ${
                        isLight ? "text-slate-700 hover:text-emerald-700" : "text-gray-300 hover:text-white"
                      }`}>
                        Switch Workspace <ArrowRight className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className={isLight ? "text-slate-400" : "text-gray-500"}>Unavailable</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
