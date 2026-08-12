"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { AccountsProvider } from "@/context/AccountsContext";
import { ActiveAccountProvider } from "@/context/ActiveAccountContext";
import { CompanionAccountProvider } from "@/context/CompanionAccountContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { CompanionProvider } from "@/lib/companion/provider";
import { PersistenceErrorBoundary } from "@/components/common/PersistenceErrorBoundary";
import { MT5CompanionProvider } from "@/context/MT5CompanionContext";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PersistenceErrorBoundary>
      <UserProfileProvider>
        <AccountsProvider>
          <WorkspaceProvider>
            <ActiveAccountProvider>
              <CompanionProvider>
                <CompanionAccountProvider>
                  <MT5CompanionProvider>
                    <AppLayout>{children}</AppLayout>
                  </MT5CompanionProvider>
                </CompanionAccountProvider>
              </CompanionProvider>
            </ActiveAccountProvider>
          </WorkspaceProvider>
        </AccountsProvider>
      </UserProfileProvider>
    </PersistenceErrorBoundary>
  );
}
