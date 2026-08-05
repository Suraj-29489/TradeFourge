"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { AccountsProvider } from "@/context/AccountsContext";
import { PersistenceErrorBoundary } from "@/components/common/PersistenceErrorBoundary";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PersistenceErrorBoundary>
      <UserProfileProvider>
        <AccountsProvider>
          <AppLayout>{children}</AppLayout>
        </AccountsProvider>
      </UserProfileProvider>
    </PersistenceErrorBoundary>
  );
}
