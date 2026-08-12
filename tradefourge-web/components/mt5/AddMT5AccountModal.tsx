"use client";

import React, { useState } from "react";
import { X, Layers, Check, Loader2 } from "lucide-react";
import { useMT5Companion } from "@/context/MT5CompanionContext";
import { MT5AccountType, MT5Currency } from "@/types/mt5";
import { useTheme } from "@/context/ThemeContext";

interface AddMT5AccountModalProps {
  open: boolean;
  onClose: () => void;
}

export const AddMT5AccountModal: React.FC<AddMT5AccountModalProps> = ({ open, onClose }) => {
  const { addAccount } = useMT5Companion();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("Exness-MT5Real");
  const [accountType, setAccountType] = useState<MT5AccountType>("Standard");
  const [currency, setCurrency] = useState<MT5Currency>("USD");
  const [isConnecting, setIsConnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!accountNumber.trim()) {
      setErrorMessage("Account Number is required.");
      return;
    }
    if (!server.trim()) {
      setErrorMessage("Server name is required.");
      return;
    }

    setIsConnecting(true);
    try {
      await addAccount({
        accountNumber: accountNumber.trim(),
        password: password.trim(),
        server: server.trim(),
        accountType,
        currency,
        leverage: "1:2000",
      });
      setSuccessMessage("Account connected successfully.");
      setTimeout(() => {
        setIsConnecting(false);
        setSuccessMessage("");
        onClose();
      }, 1200);
    } catch {
      setIsConnecting(false);
      setErrorMessage("Connection failed. Please verify credentials.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 font-mono ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 border-b pb-4 border-slate-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight font-sans">Add MT5 Account</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-sans">
            Enter your MetaTrader 5 account credentials and server specifications.
          </p>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-sans">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-sans flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {/* Account Number */}
          <div className="space-y-1">
            <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
              MT5 Account Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 267588210"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
              MT5 Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            />
          </div>

          {/* Server */}
          <div className="space-y-1">
            <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
              MT5 Server *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Exness-MT5Real39"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-mono transition-all ${
                isLight
                  ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                  : "bg-white/[0.04] border-white/[0.1] focus:border-blue-500 text-white"
              }`}
            />
          </div>

          {/* Account Type & Currency Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as MT5AccountType)}
                className={`w-full px-3 py-2.5 rounded-xl border outline-none font-mono transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                    : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
                }`}
              >
                <option value="Standard">Standard</option>
                <option value="Standard Cent">Standard Cent</option>
                <option value="Raw Spread">Raw Spread</option>
                <option value="Zero">Zero</option>
                <option value="Pro">Pro</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-gray-300 font-mono text-[11px] font-bold">
                Account Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as MT5Currency)}
                className={`w-full px-3 py-2.5 rounded-xl border outline-none font-mono transition-all ${
                  isLight
                    ? "bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900"
                    : "bg-[#0F141C] border-white/[0.1] focus:border-blue-500 text-white"
                }`}
              >
                <option value="USD">USD</option>
                <option value="USC">USC</option>
                <option value="EUR">EUR</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 font-mono">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-white/[0.05] hover:bg-white/[0.1] text-gray-300"
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isConnecting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 ${
                isConnecting ? "opacity-60 cursor-not-allowed bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-500 shadow-md"
              }`}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
