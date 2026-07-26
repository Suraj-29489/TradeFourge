"use client";

import React, { useState } from "react";
import { ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";

export const VerifyEmailForm: React.FC = () => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resent, setResent] = useState(false);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleResend = () => {
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shadow-glow">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <p className="text-xs text-gray-400">
          Enter the 6-digit confirmation code sent to your email.
        </p>
      </div>

      {/* 6-Digit OTP Inputs */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {code.map((digit, idx) => (
          <input
            key={idx}
            id={`code-input-${idx}`}
            type="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className="w-11 h-13 text-center text-xl font-extrabold font-mono rounded-xl bg-white/5 border border-white/15 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        ))}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95"
      >
        <span>Verify & Access Terminal</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* Resend Code Button */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resent}
          className="text-xs font-mono text-gray-400 hover:text-purple-300 flex items-center justify-center gap-1.5 mx-auto transition-colors disabled:text-emerald-400"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resent ? "animate-spin text-emerald-400" : ""}`} />
          {resent ? "New Code Sent To Inbox!" : "Didn't receive code? Resend"}
        </button>
      </div>
    </form>
  );
};
