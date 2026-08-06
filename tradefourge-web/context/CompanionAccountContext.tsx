"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { INITIAL_DEMO_ACCOUNTS, CompanionAccount } from "@/lib/demo/demoAccounts";

interface CompanionAccountContextType {
  accounts: CompanionAccount[];
  currentAccount: CompanionAccount | null;
  connectionStatus: "Connected" | "Disconnected";
  isDiscovering: boolean;
  extensionInfo: {
    browser: string;
    version: string;
    status: string;
    lastScan: string;
  };
  switchAccount: (id: string) => void;
  discoverAccounts: () => Promise<CompanionAccount[]>;
  reconnect: () => void;
  disconnect: () => void;
  refreshConnection: () => void;
  removeAccount: (id: string) => void;
  setDefaultAccount: (id: string) => void;
}

const STORAGE_COMPANION_ACC_KEY = "tf_selected_companion_account_id";

const CompanionAccountContext = createContext<CompanionAccountContextType>({
  accounts: [],
  currentAccount: null,
  connectionStatus: "Disconnected",
  isDiscovering: false,
  extensionInfo: {
    browser: "Chrome / Chromium",
    version: "v5.1.0 Manifest V3",
    status: "Active Runtime",
    lastScan: "Just Now",
  },
  switchAccount: () => {},
  discoverAccounts: async () => [],
  reconnect: () => {},
  disconnect: () => {},
  refreshConnection: () => {},
  removeAccount: () => {},
  setDefaultAccount: () => {},
});

export const CompanionAccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<CompanionAccount[]>(INITIAL_DEMO_ACCOUNTS);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Connected");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastScanTime, setLastScanTime] = useState("Just Now");

  // Restore stored active account on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_COMPANION_ACC_KEY);
    if (saved && INITIAL_DEMO_ACCOUNTS.some((a) => a.id === saved)) {
      setSelectedAccountId(saved);
    } else {
      setSelectedAccountId(INITIAL_DEMO_ACCOUNTS[0]?.id ?? null);
    }
  }, []);

  // Sync current account
  const currentAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;

  const switchAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_COMPANION_ACC_KEY, id);
    }
  }, []);

  const discoverAccounts = useCallback(async (): Promise<CompanionAccount[]> => {
    setIsDiscovering(true);
    // Simulate extension scanner latency
    await new Promise((res) => setTimeout(res, 1200));
    setAccounts(INITIAL_DEMO_ACCOUNTS);
    setConnectionStatus("Connected");
    setLastScanTime(new Date().toLocaleTimeString());
    setIsDiscovering(false);
    if (INITIAL_DEMO_ACCOUNTS.length > 0) {
      switchAccount(INITIAL_DEMO_ACCOUNTS[0].id);
    }
    return INITIAL_DEMO_ACCOUNTS;
  }, [switchAccount]);

  const reconnect = useCallback(() => {
    setConnectionStatus("Connected");
    setLastScanTime(new Date().toLocaleTimeString());
  }, []);

  const disconnect = useCallback(() => {
    setConnectionStatus("Disconnected");
  }, []);

  const refreshConnection = useCallback(() => {
    setConnectionStatus("Connected");
    setLastScanTime(new Date().toLocaleTimeString());
  }, []);

  const removeAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => {
        const next = prev.filter((a) => a.id !== id);
        if (selectedAccountId === id) {
          const nextAccount = next[0] ?? null;
          setSelectedAccountId(nextAccount?.id ?? null);
          if (typeof window !== "undefined") {
            if (nextAccount) {
              localStorage.setItem(STORAGE_COMPANION_ACC_KEY, nextAccount.id);
            } else {
              localStorage.removeItem(STORAGE_COMPANION_ACC_KEY);
            }
          }
        }
        return next;
      });
    },
    [selectedAccountId]
  );

  const setDefaultAccount = useCallback((id: string) => {
    setAccounts((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
  }, []);

  return (
    <CompanionAccountContext.Provider
      value={{
        accounts,
        currentAccount,
        connectionStatus,
        isDiscovering,
        extensionInfo: {
          browser: "Chrome / Chromium",
          version: "v5.1.0 Manifest V3",
          status: connectionStatus === "Connected" ? "Active Stream" : "Disconnected",
          lastScan: lastScanTime,
        },
        switchAccount,
        discoverAccounts,
        reconnect,
        disconnect,
        refreshConnection,
        removeAccount,
        setDefaultAccount,
      }}
    >
      {children}
    </CompanionAccountContext.Provider>
  );
};

export const useCompanionAccount = () => useContext(CompanionAccountContext);
