"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ArrowRight, RefreshCw, AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function VerifyEmailFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

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

    if (!email) {
      setErrorMessage("Please provide your email address.");
      return;
    }

    if (token.length < 6) {
      setErrorMessage("Please enter all 6 digits of the confirmation code.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "signup",
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setErrorMessage("Verification completed, but no active session was returned. Please sign in.");
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Verification failed. Please check your code.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setErrorMessage("Please enter your email address to resend confirmation.");
      return;
    }

    setErrorMessage(null);
    setResending(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setResending(false);
      } else {
        setResending(false);
        setResentSuccess(true);
        setTimeout(() => setResentSuccess(false), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to resend confirmation email.");
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shadow-glow">
          <Mail className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white">Check Your Email Inbox</h3>
        <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
          We have sent an official confirmation link to{" "}
          <strong className="text-purple-300 font-mono">{email || "your email"}</strong>.
          Click the link in your email to instantly verify your account and open your terminal.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {resentSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Confirmation email resent! Please check your inbox.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 border-t border-white/10 pt-5">
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-medium text-gray-300 block">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trader@tradefourge.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-xs font-mono focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono font-medium text-gray-300 block text-center">
            Or Enter 6-Digit Email Code
          </label>
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-glow flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Verify Code & Access Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center border-t border-white/10 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-xs font-mono text-gray-400 hover:text-purple-300 flex items-center justify-center gap-1.5 mx-auto transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin text-purple-400" : ""}`} />
          {resending ? "Sending confirmation..." : "Didn't receive email? Resend confirmation link"}
        </button>

        <Link href="/login" className="text-xs font-mono text-purple-400 hover:underline">
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}

export const VerifyEmailForm: React.FC = () => {
  return (
    <Suspense fallback={<div className="text-center py-6 text-xs text-gray-400 font-mono">Loading Verification...</div>}>
      <VerifyEmailFormContent />
    </Suspense>
  );
};
