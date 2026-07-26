"use client";

import React from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Set New Password"
      subtitle="Enter a new secure password for your TradeFourge trading account."
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
