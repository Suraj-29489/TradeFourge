"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProfileProvider } from "@/context/UserProfileContext";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <AppLayout>{children}</AppLayout>
    </UserProfileProvider>
  );
}
