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
              <CompanionAccountProvider>
                <CompanionProvider>
                  <AppLayout>{children}</AppLayout>
                </CompanionProvider>
              </CompanionAccountProvider>
            </ActiveAccountProvider>
          </WorkspaceProvider>
        </AccountsProvider>
      </UserProfileProvider>
    </PersistenceErrorBoundary>
  );
}
