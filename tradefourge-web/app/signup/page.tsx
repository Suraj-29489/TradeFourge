"use client";

import React from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create Your TradeFourge Account"
      subtitle="Start tracking performance with institutional-grade AI analytics."
    >
      <SignupForm />
    </AuthLayout>
  );
}
