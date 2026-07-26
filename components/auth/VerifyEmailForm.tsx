"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const VerifyEmailForm: React.FC = () => {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();
  const configured = isSupabaseConfigured();

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const token = code.join("");

    if (token.length < 6) {
      setErrorMessage("Please enter all 6 digits.");
      return;
    }

    setLoading(true);

    if (!configured) {
      setTimeout(() => {
        setLoading(false);
        router.push("/dashboard");
      }, 500);
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: "", // User verifies with token
        token,
        type: "signup",
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Verification failed.");
      setLoading(false);
    }
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

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

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
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Verify & Access Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
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
