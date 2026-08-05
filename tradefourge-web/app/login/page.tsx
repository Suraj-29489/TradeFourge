"use client";

import React from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome Back to TradeFourge"
      subtitle="Enter your credentials to access your trading terminal & performance lab."
    >
      <LoginForm />
    </AuthLayout>
  );
}
