"use client";

import React from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter your account email to receive secure recovery instructions."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
