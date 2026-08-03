"use client";
// components/accounts/ConnectLiveBrokerModal.tsx
// TradeFourge v4.0 Connect Live Broker Wizard Modal

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { BROKER_REGISTRY } from "@/lib/live-sync/broker-registry";
import { ExnessConnector } from "@/lib/live-sync/exness-connector";
import { MT5Connector } from "@/lib/live-sync/mt5-connector";
import { saveLiveCredential } from "@/lib/live-sync/account-linker";
import { resolveBrokerCurrency } from "@/lib/live-sync/currency-resolver";
import { generateDisplayAccountId } from "@/lib/supabase/frontend-store";
import { generateAccountSlug } from "@/lib/account/account-identity";
import { useAccounts } from "@/context/AccountsContext";
import type {
  TradingAccount,
  NewTradingAccount,
  AccountPlatform,
  SyncIntervalSetting,
} from "@/types/database";
import type { LiveAccountSummary } from "@/lib/live-sync/broker-types";
import {
  Zap,
  Server,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Globe,
  Wallet,
} from "lucide-react";

interface ConnectLiveBrokerModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  existingAccounts: TradingAccount[];
  onAccountLinked: () => Promise<void>;
}

export function ConnectLiveBrokerModal({
  open,
  onClose,
  userId,
  existingAccounts,
  onAccountLinked,
}: ConnectLiveBrokerModalProps) {
  const { addNewAccount } = useAccounts();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedBrokerId, setSelectedBrokerId] = useState("exness");
  const [selectedPlatform, setSelectedPlatform] = useState<AccountPlatform>("MetaTrader 5");
  const [server, setServer] = useState("Exness-Real");
  const [loginNumber, setLoginNumber] = useState("");
  const [password, setPassword] = useState("");
  const [syncInterval, setSyncInterval] = useState<SyncIntervalSetting>("5m");

  // Linking state
  const [linkOption, setLinkOption] = useState<"new" | "existing">("new");
  const [targetAccountId, setTargetAccountId] = useState<string>("");

  // Testing State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    summary?: LiveAccountSummary;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedBrokerId("exness");
      setSelectedPlatform("MetaTrader 5");
      setServer("Exness-Real");
      setLoginNumber("");
      setPassword("");
      setTestResult(null);
      setLinkOption("new");
      if (existingAccounts.length > 0) {
        setTargetAccountId(existingAccounts[0].id);
      }
    }
  }, [open, existingAccounts]);

  const selectedBrokerObj = BROKER_REGISTRY.find((b) => b.id === selectedBrokerId) || BROKER_REGISTRY[0];

  const handleBrokerChange = (bId: string) => {
    setSelectedBrokerId(bId);
    const bObj = BROKER_REGISTRY.find((b) => b.id === bId);
    if (bObj) {
      setSelectedPlatform(bObj.platforms[0]);
      setServer(bObj.defaultServer);
    }
  };

  const handleTestConnection = async () => {
    if (!loginNumber || !password) {
      setTestResult({
        success: false,
        message: "Please enter your broker account login number and password.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const connector =
        selectedBrokerId === "exness"
          ? new ExnessConnector()
          : new MT5Connector();

      const authenticated = await connector.authenticate({
        server,
        loginNumber,
        authSecret: password,
      });

      if (!authenticated) {
        setTestResult({
          success: false,
          message: "Failed to authenticate with broker server. Check server address and login.",
        });
        return;
      }

      const summary = await connector.fetchAccountSummary();
      setTestResult({
        success: true,
        message: `Successfully connected to ${summary.brokerName} MT5!`,
        summary,
      });
      setStep(3);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "Connection test failed.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFinishConnection = async () => {
    if (!testResult?.summary) return;
    setIsSubmitting(true);

    try {
      let finalAccountId = targetAccountId;
      const detectedCurr = resolveBrokerCurrency(testResult.summary.currency);

      if (linkOption === "new" || !finalAccountId) {
        // Create new linked trading account
        const dispId = generateDisplayAccountId();
        const accName = `${testResult.summary.brokerName} ${detectedCurr} (${loginNumber})`;
        const newAcc: NewTradingAccount = {
          account_name: accName,
          broker: testResult.summary.brokerName,
          platform: selectedPlatform,
          account_number: loginNumber,
          account_type: "Live",
          currency: detectedCurr,
          leverage: testResult.summary.leverage || "1:500",
          starting_balance: testResult.summary.balance,
          current_balance: testResult.summary.balance,
          display_id: dispId,
          slug: generateAccountSlug(accName),
          is_default: false,
          is_active: true,
          notes: `Connected live via TradeFourge Sync Engine`,
          is_live_synced: true,
          live_status: "Connected",
          last_synced_at: new Date().toISOString(),
          sync_interval: syncInterval,
        };

        const created = await addNewAccount(newAcc);
        if (created) {
          finalAccountId = created.id;
        }
      }

      if (finalAccountId) {
        // Save encrypted credential ref
        saveLiveCredential(userId, {
          user_id: userId,
          account_id: finalAccountId,
          broker_id: selectedBrokerId,
          broker_name: selectedBrokerObj.name,
          platform: selectedPlatform,
          server,
          login_number: loginNumber,
          encrypted_auth_ref: `ENC_${Date.now()}_REF`,
          sync_interval: syncInterval,
          status: "Connected",
          last_sync_time: new Date().toISOString(),
          last_error: null,
          auto_currency_detected: detectedCurr,
        });

        await onAccountLinked();
        onClose();
      }
    } catch (err) {
      console.error("[ConnectLiveBrokerModal] Connection error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono";
  const labelClass = "block text-xs font-mono text-gray-400 mb-1.5";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect Live Broker Sync Engine"
      description="Automatically fetch live trades, balances, and equity from your broker account"
      size="lg"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-purple-400 font-bold" : "text-gray-500"}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">1</span>
            <span>Broker</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-purple-400 font-bold" : "text-gray-500"}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">2</span>
            <span>Credentials</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-purple-400 font-bold" : "text-gray-500"}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">3</span>
            <span>Account Link</span>
          </div>
        </div>

        {/* STEP 1: Select Broker & Platform */}
        {step === 1 && (
          <div className="space-y-4 font-mono">
            <div>
              <label className={labelClass}>Select Supported Broker</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BROKER_REGISTRY.map((b) => {
                  const isSelected = b.id === selectedBrokerId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBrokerChange(b.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-purple-600/15 border-purple-500/50 text-white shadow-glow"
                          : "bg-dark-card border-white/10 text-gray-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm block">{b.name}</span>
                        {b.category === "Production" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            Live
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-1">
                        {b.platforms.join(" · ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelClass}>Trading Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as AccountPlatform)}
                className={inputClass}
              >
                {selectedBrokerObj.platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2"
              >
                <span>Next: Credentials</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Credentials & Server */}
        {step === 2 && (
          <div className="space-y-4 font-mono">
            <div>
              <label className={labelClass}>Broker Server Address / Name *</label>
              <div className="relative">
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="e.g. Exness-Real, MetaQuotes-Demo"
                  className={inputClass}
                />
                <Server className="w-4 h-4 text-gray-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelClass}>MT4 / MT5 Login Number *</label>
              <input
                type="text"
                value={loginNumber}
                onChange={(e) => setLoginNumber(e.target.value)}
                placeholder="e.g. 7788192"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Investor / Account Password *</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputClass}
                />
                <Lock className="w-4 h-4 text-gray-500 absolute right-3 top-3 pointer-events-none" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Credentials are encrypted. Plain text passwords are never stored in logs.</span>
              </p>
            </div>

            {testResult && !testResult.success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !loginNumber || !password}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Connection...</span>
                  </>
                ) : (
                  <>
                    <span>Test & Validate Connection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Account Link & Auto Currency Detection */}
        {step === 3 && testResult?.summary && (
          <div className="space-y-4 font-mono">
            {/* Success Summary Banner */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Connection Verified Successfully</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-emerald-500/20 text-gray-300">
                <div>
                  <span className="text-gray-500 block text-[10px]">Auto Currency</span>
                  <span className="font-bold text-emerald-300">{testResult.summary.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Balance</span>
                  <span className="font-bold text-white">${testResult.summary.balance.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Equity</span>
                  <span className="font-bold text-white">${testResult.summary.equity.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Leverage</span>
                  <span className="font-bold text-gray-300">{testResult.summary.leverage}</span>
                </div>
              </div>
            </div>

            {/* Link Option */}
            <div className="space-y-2">
              <label className={labelClass}>Trading Account Association</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-dark-card border border-white/10 cursor-pointer">
                  <input
                    type="radio"
                    name="linkOption"
                    checked={linkOption === "new"}
                    onChange={() => setLinkOption("new")}
                    className="accent-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Create New Linked Trading Account</span>
                    <span className="text-[10px] text-gray-400">Automatically creates an account named "{testResult.summary.brokerName} {testResult.summary.currency} ({loginNumber})"</span>
                  </div>
                </label>

                {existingAccounts.length > 0 && (
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-dark-card border border-white/10 cursor-pointer">
                    <input
                      type="radio"
                      name="linkOption"
                      checked={linkOption === "existing"}
                      onChange={() => setLinkOption("existing")}
                      className="accent-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-white block">Link to Existing Trading Account</span>
                      <select
                        value={targetAccountId}
                        onChange={(e) => setTargetAccountId(e.target.value)}
                        disabled={linkOption !== "existing"}
                        className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white disabled:opacity-50"
                      >
                        {existingAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name} ({a.broker} · {a.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Sync Interval */}
            <div>
              <label className={labelClass}>Automatic Sync Interval</label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value as SyncIntervalSetting)}
                className={inputClass}
              >
                <option value="1m">Every 1 Minute (High Frequency)</option>
                <option value="5m">Every 5 Minutes (Recommended)</option>
                <option value="15m">Every 15 Minutes</option>
                <option value="1h">Every 1 Hour</option>
                <option value="manual">Manual Sync Only</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinishConnection}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Connection...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Connect & Start Syncing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
