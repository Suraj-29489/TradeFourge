"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CompanionAccount } from "@/lib/demo/demoAccounts";
import { useSafeCompanion } from "@/lib/companion/provider";

interface CompanionAccountContextType {
  accounts: CompanionAccount[];
  currentAccount: CompanionAccount | null;
  connectionStatus: "Connected" | "Disconnected";
  isDiscovering: boolean;
  discoveryError: string | null;
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
  resetTFCState: () => void;
  clearDiscoveryError: () => void;
}

const STORAGE_COMPANION_ACC_KEY = "tf_selected_companion_account_id";

const CompanionAccountContext = createContext<CompanionAccountContextType>({
  accounts: [],
  currentAccount: null,
  connectionStatus: "Disconnected",
  isDiscovering: false,
  discoveryError: null,
  extensionInfo: {
    browser: "Chrome / Chromium",
    version: "v5.5.3 Manifest V3",
    status: "Disconnected",
    lastScan: "Never",
  },
  switchAccount: () => {},
  discoverAccounts: async () => [],
  reconnect: () => {},
  disconnect: () => {},
  refreshConnection: () => {},
  removeAccount: () => {},
  setDefaultAccount: () => {},
  resetTFCState: () => {},
  clearDiscoveryError: () => {},
});

export const CompanionAccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const companion = useSafeCompanion();
  const [accounts, setAccounts] = useState<CompanionAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Disconnected");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastScanTime, setLastScanTime] = useState("Never");

  // Synchronize connection status from CompanionProvider
  useEffect(() => {
    setConnectionStatus(companion?.isConnected ? "Connected" : "Disconnected");
  }, [companion?.isConnected]);

  // Clean stale demo account IDs from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_COMPANION_ACC_KEY);
    if (saved && (saved.startsWith("tfc_exness_") || saved.startsWith("tfc_icmarkets_"))) {
      localStorage.removeItem(STORAGE_COMPANION_ACC_KEY);
      setSelectedAccountId(null);
    } else if (saved) {
      setSelectedAccountId(saved);
    }
  }, []);

  // Synchronize discovered accounts from CompanionProvider when live events arrive
  useEffect(() => {
    if (companion?.discoveredAccounts && companion.discoveredAccounts.length > 0) {
      const mapped: CompanionAccount[] = companion.discoveredAccounts.map((da, index) => ({
        id: da.id || `acc_${da.account_number}`,
        accountNumber: da.account_number,
        broker: da.broker || "Exness",
        server: da.server || "Exness-Real",
        accountType: (da.account_type as any) || "Live",
        currency: da.currency || "USD",
        leverage: "1:500",
        balance: da.balance || 0,
        equity: da.equity || da.balance || 0,
        margin: 0,
        freeMargin: da.equity || da.balance || 0,
        profitToday: 0,
        floatingPnL: 0,
        isConnected: true,
        isDefault: index === 0,
        lastScanTime: "Just Now",
        stats: {
          winRate: 0,
          profitFactor: 0,
          totalTrades: da.history_count || 0,
          winningTrades: 0,
          losingTrades: 0,
          netPnL: 0,
          maxDrawdownPct: 0,
          averageRR: 0,
        },
        trades: [],
      }));

      setAccounts(mapped);
      setConnectionStatus("Connected");
      setLastScanTime(new Date().toLocaleTimeString());

      if (!selectedAccountId && mapped.length > 0) {
        setSelectedAccountId(mapped[0].id);
      }
    }
  }, [companion?.discoveredAccounts, selectedAccountId]);

  // Active account selection
  const currentAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;

  const switchAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_COMPANION_ACC_KEY, id);
    }
  }, []);

  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const discoverAccounts = useCallback(async (): Promise<CompanionAccount[]> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    try {
      const liveDiscovered = companion ? await companion.discoverAccounts() : [];
      setLastScanTime(new Date().toLocaleTimeString());

      if (companion?.lastError) {
        setDiscoveryError(companion.lastError.message);
      }

      if (liveDiscovered.length > 0) {
        const mapped: CompanionAccount[] = liveDiscovered.map((da, index) => ({
          id: da.id || `acc_${da.account_number}`,
          accountNumber: da.account_number,
          broker: da.broker || "Exness",
          server: da.server || "Exness-Real",
          accountType: (da.account_type as any) || "Live",
          currency: da.currency || "USD",
          leverage: "1:500",
          balance: da.balance || 0,
          equity: da.equity || da.balance || 0,
          margin: 0,
          freeMargin: da.equity || da.balance || 0,
          profitToday: 0,
          floatingPnL: 0,
          isConnected: true,
          isDefault: index === 0,
          lastScanTime: "Just Now",
          stats: {
            winRate: 0,
            profitFactor: 0,
            totalTrades: da.history_count || 0,
            winningTrades: 0,
            losingTrades: 0,
            netPnL: 0,
            maxDrawdownPct: 0,
            averageRR: 0,
          },
          trades: [],
        }));

        setAccounts(mapped);
        setConnectionStatus("Connected");
        setDiscoveryError(null);
        if (mapped.length > 0) {
          switchAccount(mapped[0].id);
        }
        return mapped;
      } else {
        setAccounts([]);
        if (!companion?.isConnected) {
          setDiscoveryError("TradeFourge Companion Extension is not connected. Please ensure the extension is installed and active.");
        } else if (!discoveryError) {
          setDiscoveryError("No Exness accounts detected on the active page. Please ensure you are logged into my.exness.com.");
        }
        return [];
      }
    } catch (err: any) {
      setAccounts([]);
      setDiscoveryError(err?.message || "Account discovery failed. Ensure Exness is open in your browser.");
      return [];
    } finally {
      setIsDiscovering(false);
    }
  }, [companion, switchAccount, discoveryError]);

  const clearDiscoveryError = useCallback(() => setDiscoveryError(null), []);

  const reconnect = useCallback(() => {
    companion?.reconnect();
    setLastScanTime(new Date().toLocaleTimeString());
  }, [companion]);

  const disconnect = useCallback(() => {
    companion?.disconnect();
    setConnectionStatus("Disconnected");
  }, [companion]);

  const refreshConnection = useCallback(() => {
    companion?.checkExtension();
    setLastScanTime(new Date().toLocaleTimeString());
  }, [companion]);

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

  const resetTFCState = useCallback(() => {
    setAccounts([]);
    setSelectedAccountId(null);
    setConnectionStatus("Disconnected");
    setLastScanTime("Never");
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_COMPANION_ACC_KEY);
    }
  }, []);

  return (
    <CompanionAccountContext.Provider
      value={{
        accounts,
        currentAccount,
        connectionStatus,
        isDiscovering,
        discoveryError,
        extensionInfo: {
          browser: companion?.browser || "Chrome / Chromium",
          version: companion?.version || "v5.5.3 Manifest V3",
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
        resetTFCState,
        clearDiscoveryError,
      }}
    >
      {children}
    </CompanionAccountContext.Provider>
  );
};

export const useCompanionAccount = () => useContext(CompanionAccountContext);
