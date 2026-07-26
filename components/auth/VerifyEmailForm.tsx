"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, AlertCircle, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/supabase/config";

function VerifyEmailFormContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleResend = async () => {
    if (!email) {
      setErrorMessage("Please enter your email address to resend confirmation.");
      return;
    }

    setErrorMessage(null);
    setResentSuccess(false);
    setResending(true);

    try {
      const callbackUrl = getAuthCallbackUrl("/auth/callback");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setResending(false);
      } else {
        setResending(false);
        setResentSuccess(true);
        setTimeout(() => setResentSuccess(false), 5000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to resend confirmation email.");
      setResending(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      {/* Header Icon & Title */}
      <div className="space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-300 flex items-center justify-center shadow-glow">
          <Mail className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-xl font-extrabold text-white font-mono tracking-tight">
          Check Your Email Inbox
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
          We have sent an official verification link to{" "}
          <strong className="text-purple-300 font-mono block mt-1 text-sm">{email || "your email address"}</strong>.
          Click the link in your email to activate your account and open your terminal.
        </p>
      </div>

      {/* Error Feedback */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Feedback */}
      {resentSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 text-left">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Verification email resent! Please check your inbox.</span>
        </div>
      )}

      {/* Resend Action */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <div className="text-xs text-gray-300 font-mono">
          Didn't receive the email or link expired?
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resending ? "animate-spin text-purple-400" : ""}`} />
          <span>{resending ? "Resending Verification Email..." : "Resend Verification Email"}</span>
        </button>
      </div>

      {/* Return to Login */}
      <div className="pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
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
