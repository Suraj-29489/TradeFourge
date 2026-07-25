"use client";

import React from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Verify Email Address"
      subtitle="Confirm your identity to unlock your TradeFourge terminal session."
    >
      <VerifyEmailForm />
    </AuthLayout>
  );
}
