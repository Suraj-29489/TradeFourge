"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { AccountsProvider } from "@/context/AccountsContext";
import { ActiveAccountProvider } from "@/context/ActiveAccountContext";
import { CompanionProvider } from "@/lib/companion/provider";
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
          <ActiveAccountProvider>
            <CompanionProvider>
              <AppLayout>{children}</AppLayout>
            </CompanionProvider>
          </ActiveAccountProvider>
        </AccountsProvider>
      </UserProfileProvider>
    </PersistenceErrorBoundary>
  );
}
