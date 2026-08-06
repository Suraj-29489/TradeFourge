"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ArrowRight, Lock } from "lucide-react";
import { useWorkspace, WorkspaceMode } from "@/context/WorkspaceContext";
import { useActiveAccount } from "@/context/ActiveAccountContext";
import { SharedBadge } from "@/components/ui/SharedBadge";

interface AccountTypeModalProps {
  open: boolean;
  onSelectWorkspace?: (mode: WorkspaceMode) => void;
}

export const AccountTypeModal: React.FC<AccountTypeModalProps> = ({ open, onSelectWorkspace }) => {
  const router = useRouter();
  const { currentWorkspace, selectWorkspace, isWorkspaceActive, workspaces } = useWorkspace();
  const { selectAccountType, closeAccountTypeModal } = useActiveAccount();

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
    if (mode === "mt5") return;

    selectWorkspace(mode);
    selectAccountType(mode as "csv" | "tfc");

    if (onSelectWorkspace) {
      onSelectWorkspace(mode);
    } else {
      router.push(mode === "tfc" ? "/dashboard" : "/accounts");
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
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Centered Dark Institutional Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative z-10 w-full max-w-3xl p-6 sm:p-8 rounded-3xl bg-[#0F141C] border border-white/[0.08] shadow-2xl text-white space-y-6"
        >
          {/* Close Button X */}
          <button
            onClick={closeAccountTypeModal}
            className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1.5 text-center sm:text-left border-b border-white/[0.08] pb-5 pr-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
              Select Trading Workspace Mode
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 font-sans">
              Choose how you want to interact with your trading accounts.
            </p>
          </div>

          {/* Equal Height Option Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch font-mono">
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
                  className={`relative p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-6 h-full select-none ${
                    !isEnabled
                      ? "bg-white/[0.01] border-white/[0.06] opacity-40 cursor-not-allowed"
                      : isActive
                      ? "bg-blue-600/10 border-2 border-blue-600 shadow-xl shadow-blue-500/10 cursor-pointer"
                      : "bg-white/[0.02] border-white/[0.08] hover:border-blue-500/60 hover:bg-white/[0.04] cursor-pointer"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Icon & Badge Row */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : isEnabled
                            ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                            : "bg-white/[0.04] text-gray-500"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {isActive ? (
                        <SharedBadge label="CURRENT WORKSPACE" variant="primary" icon={Check} />
                      ) : (
                        <SharedBadge
                          label={ws.badge}
                          variant={isEnabled ? "neutral" : "warning"}
                        />
                      )}
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-white font-sans">{ws.name}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed font-sans min-h-[48px]">
                        {ws.description}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Action Indicator (No hardcoded CTA buttons) */}
                  <div
                    className={`py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      !isEnabled
                        ? "bg-white/[0.04] text-gray-500 font-mono"
                        : isActive
                        ? "bg-blue-600 text-white font-mono shadow-sm"
                        : "bg-white/[0.04] text-gray-300 group-hover:text-white font-mono"
                    }`}
                  >
                    {!isEnabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Disabled</span>
                      </>
                    ) : isActive ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Current Workspace</span>
                      </>
                    ) : (
                      <>
                        <span>Switch Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
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
