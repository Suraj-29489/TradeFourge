"use client";

import React, { useState, useEffect } from "react";
import { validateMT5Credentials } from "@/lib/live-sync/mt5-authenticator";
import { createLiveCredential } from "@/lib/supabase/live-credentials";
import type { AccountPlatform } from "@/types/database";
import {
  Zap,
  Server,
  Key,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Globe,
  Radio,
  X,
  Building2,
  ChevronRight,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { TradingAccount } from "@/types/database";

interface ConnectLiveBrokerModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onAccountLinked?: () => Promise<void>;
  existingAccounts?: TradingAccount[];
  userId: string;
}

export const ConnectLiveBrokerModal: React.FC<ConnectLiveBrokerModalProps> = ({
  isOpen: propIsOpen,
  open: propOpen,
  onClose,
  onSuccess,
  onAccountLinked,
  userId,
}) => {
  const isModalOpen = propIsOpen ?? propOpen ?? false;
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Connection Form State
  const [selectedBroker, setSelectedBroker] = useState("Exness");
  const [selectedPlatform, setSelectedPlatform] = useState<AccountPlatform>("MetaTrader 5");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [server, setServer] = useState("Exness-MT5Real");
  const [investorPassword, setInvestorPassword] = useState("");
  const [description, setDescription] = useState("");

  // Testing & Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setStep(1);
      setSelectedBroker("Exness");
      setSelectedPlatform("MetaTrader 5");
      setAccountName("Exness Primary Account");
      setAccountNumber("");
      setServer("Exness-MT5Real");
      setInvestorPassword("");
      setDescription("");
      setErrorMessage(null);
      setIsSubmitting(false);
      // Lock body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const handleSubmitConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!accountName || !accountNumber || !server || !investorPassword) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authenticate MT5 Investor Credential (Read-only)
      const authRes = await validateMT5Credentials({
        broker: selectedBroker,
        platform: selectedPlatform,
        accountNumber,
        server,
        encryptedPassword: investorPassword,
      });

      if (!authRes.success) {
        setErrorMessage(authRes.message);
        setIsSubmitting(false);
        return;
      }

      // 2. Persist Encrypted Credential to Supabase live_broker_credentials
      const { error: dbErr } = await createLiveCredential(userId, {
        broker: selectedBroker,
        platform: selectedPlatform,
        account_name: accountName,
        account_number: accountNumber,
        server: server.trim(),
        encrypted_password: investorPassword,
        status: "Connected",
        auto_sync: true,
      });

      if (dbErr) {
        setErrorMessage(dbErr);
        setIsSubmitting(false);
        return;
      }

      // Success
      if (onSuccess) onSuccess();
      if (onAccountLinked) await onAccountLinked();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to link MT5 account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Institutional Translucent Blur Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-xl rounded-2xl bg-[#0D111A] border border-purple-500/30 shadow-2xl overflow-hidden font-mono text-xs text-gray-200"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Connect Live Broker Account
                </h2>
                <p className="text-[11px] text-gray-400">
                  Step {step} of 3 — {step === 1 ? "Select Broker" : step === 2 ? "Select Platform" : "MT5 Investor Password Form"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="flex border-b border-white/10">
            {[
              { num: 1, name: "1. Broker" },
              { num: 2, name: "2. Platform" },
              { num: 3, name: "3. Connection" },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex-1 py-2 text-center text-[10px] font-bold border-b-2 transition-all ${
                  step === s.num
                    ? "border-purple-500 text-purple-400 bg-purple-500/10"
                    : step > s.num
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-gray-500"
                }`}
              >
                {s.name}
              </div>
            ))}
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6">
            {/* STEP 1: SELECT BROKER */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Select Supported Broker</h3>
                  <p className="text-gray-400 text-[11px]">
                    Choose your broker. Exness MT5 is fully supported in Phase 1.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div
                    onClick={() => {
                      setSelectedBroker("Exness");
                      setStep(2);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedBroker === "Exness"
                        ? "bg-purple-500/10 border-purple-500/50 shadow-glow"
                        : "bg-black/20 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-extrabold flex items-center justify-center">
                        EX
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">Exness</div>
                        <div className="text-[10px] text-gray-400">Official Exness MT5 Server Sync</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                      READY
                    </span>
                  </div>

                  {/* Future Brokers preview */}
                  {[
                    { name: "IC Markets", desc: "MetaTrader 5 Live Feed" },
                    { name: "OANDA", desc: "v20 REST API Sync" },
                  ].map((b) => (
                    <div
                      key={b.name}
                      className="p-4 rounded-xl bg-black/10 border border-white/5 opacity-50 flex items-center justify-between cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-500/10 border border-gray-500/30 text-gray-400 font-bold flex items-center justify-center">
                          {b.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-300">{b.name}</div>
                          <div className="text-[10px] text-gray-500">{b.desc}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[10px] font-bold">
                        COMING SOON
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs flex items-center gap-2"
                  >
                    <span>Next: Select Platform</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SELECT PLATFORM */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Select Trading Platform</h3>
                  <p className="text-gray-400 text-[11px]">
                    TradeFourge v4 supports MetaTrader 5 live account connections.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setSelectedPlatform("MetaTrader 5");
                      setStep(3);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      selectedPlatform === "MetaTrader 5"
                        ? "bg-purple-500/10 border-purple-500/50 shadow-glow"
                        : "bg-black/20 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-base">MT5</span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                        Active
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-white">MetaTrader 5</div>
                      <div className="text-[10px] text-gray-400">Closed trade history feed</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/10 border border-white/5 opacity-50 flex flex-col justify-between space-y-3 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-gray-400 text-base">MT4</span>
                      <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[10px] font-bold">
                        Phase 2
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-400">MetaTrader 4</div>
                      <div className="text-[10px] text-gray-500">Legacy MT4 support</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all text-xs"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs flex items-center gap-2"
                  >
                    <span>Next: Connection Form</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONNECTION FORM */}
            {step === 3 && (
              <form onSubmit={handleSubmitConnection} className="space-y-4">
                {/* Security Notice Banner */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-white text-xs">Read-Only Investor Password Security</div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      TradeFourge only uses your MT5 Investor Password (read-only). Your account cannot be traded through TradeFourge. Never enter your Master Password.
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">Selected Broker</label>
                    <input
                      type="text"
                      value={selectedBroker}
                      disabled
                      className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-400 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">Platform</label>
                    <input
                      type="text"
                      value={selectedPlatform}
                      disabled
                      className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-400 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase">Trading Account Name *</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Exness Scalping Account"
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">Account Number *</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 7788912"
                      className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">MT5 Server *</label>
                    <input
                      type="text"
                      value={server}
                      onChange={(e) => setServer(e.target.value)}
                      placeholder="e.g. Exness-MT5Real"
                      className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase flex items-center justify-between">
                    <span>MT5 Investor Password (Read-Only) *</span>
                    <span className="text-purple-400 font-normal">Encrypted on Client</span>
                  </label>
                  <input
                    type="password"
                    value={investorPassword}
                    onChange={(e) => setInvestorPassword(e.target.value)}
                    placeholder="Enter your read-only Investor Password"
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase">Optional Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Main intraday forex account"
                    className="w-full p-2.5 rounded-xl bg-black/40 border border-dark-border text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-glow text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Linking...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Validate & Link Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
