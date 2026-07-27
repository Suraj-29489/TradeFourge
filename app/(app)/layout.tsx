"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { PersistenceErrorBoundary } from "@/components/common/PersistenceErrorBoundary";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PersistenceErrorBoundary>
      <UserProfileProvider>
        <AppLayout>{children}</AppLayout>
      </UserProfileProvider>
    </PersistenceErrorBoundary>
  );
}
