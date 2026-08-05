"use client";

import { create } from "zustand";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  companionStatus: "connected" | "syncing" | "offline";
  connectedAccountsCount: number;
  importedTradesCount: number;
  lastSyncTimestamp: string;
  extensionVersion: string;

  // Actions
  setCompletedOnboarding: (completed: boolean) => void;
  updateCompanionInfo: (info: {
    status?: "connected" | "syncing" | "offline";
    accountsCount?: number;
    tradesCount?: number;
  }) => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasCompletedOnboarding:
    typeof window !== "undefined"
      ? localStorage.getItem("tf_onboarding_completed") === "true"
      : false,
  companionStatus: "connected",
  connectedAccountsCount: 3,
  importedTradesCount: 4862,
  lastSyncTimestamp: "Just now",
  extensionVersion: "v1.2",

  setCompletedOnboarding: (completed: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tf_onboarding_completed", completed ? "true" : "false");
    }
    set({ hasCompletedOnboarding: completed });
  },

  updateCompanionInfo: (info) => {
    set((state) => ({
      companionStatus: info.status ?? state.companionStatus,
      connectedAccountsCount: info.accountsCount ?? state.connectedAccountsCount,
      importedTradesCount: info.tradesCount ?? state.importedTradesCount,
      lastSyncTimestamp: "Just now",
    }));
  },

  resetOnboarding: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tf_onboarding_completed");
    }
    set({
      hasCompletedOnboarding: false,
      connectedAccountsCount: 0,
      importedTradesCount: 0,
    });
  },
}));
