"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CompanionAccount } from "@/lib/demo/demoAccounts";
import { useSafeCompanion } from "@/lib/companion/provider";
import type { DiscoveredAccount } from "@/lib/companion/protocol";
import { createClient } from "@/lib/supabase/client";
import { AccountService } from "@/lib/services/AccountService";
import { bulkInsertTrades, fetchTrades } from "@/lib/supabase/trades";
import { emitAppEvent, useAppEventListener } from "@/lib/events/event-bus";
import { CompanionBridge } from "@/lib/companion/bridge";
import type { NewCloudTrade, TradingAccount } from "@/types/database";

interface CompanionAccountContextType {
  accounts: CompanionAccount[];
  currentAccount: CompanionAccount | null;
  connectionStatus: "Connected" | "Disconnected";
  isDiscovering: boolean;
  discoveryError: string | null;
  rawDiscoveredList: DiscoveredAccount[];
  extensionInfo: {
    browser: string;
    version: string;
    status: string;
    lastScan: string;
  };
  switchAccount: (id: string) => void;
  discoverAccounts: () => Promise<DiscoveredAccount[]>;
  importSelectedAccounts: (selectedAccounts: DiscoveredAccount[]) => Promise<void>;
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
  rawDiscoveredList: [],
  extensionInfo: {
    browser: "Chrome / Chromium",
    version: "v5.5.3 Manifest V3",
    status: "Disconnected",
    lastScan: "Never",
  },
  switchAccount: () => {},
  discoverAccounts: async () => [],
  importSelectedAccounts: async () => {},
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
  const [rawDiscoveredList, setRawDiscoveredList] = useState<DiscoveredAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Disconnected");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastScanTime, setLastScanTime] = useState("Never");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const supabase = createClient();

  // Helper to map TradingAccount from canonical store to CompanionAccount
  const mapDbToCompanionAccount = (dbAcc: TradingAccount, isDefault = false): CompanionAccount => {
    return {
      id: dbAcc.id,
      accountNumber: dbAcc.account_number || dbAcc.display_id || dbAcc.id,
      broker: dbAcc.broker || "Exness",
      server: dbAcc.server || "Server unavailable",
      accountType: (dbAcc.account_type as any) || "Standard",
      currency: dbAcc.currency || "USD",
      leverage: dbAcc.leverage || "1:2000",
      balance: dbAcc.current_balance ?? dbAcc.starting_balance ?? 0,
      equity: dbAcc.current_balance ?? dbAcc.starting_balance ?? 0,
      margin: 0,
      freeMargin: dbAcc.current_balance ?? dbAcc.starting_balance ?? 0,
      profitToday: 0,
      floatingPnL: 0,
      isConnected: true,
      isDefault: dbAcc.is_default ?? isDefault,
      lastScanTime: "Just Now",
      stats: {
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        netPnL: 0,
        maxDrawdownPct: 0,
        averageRR: 0,
      },
      trades: [],
    };
  };

  // Load canonical persistent accounts into CompanionAccountContext
  const loadSavedAccounts = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || "default_user";

      const res = await AccountService.getAccounts(userId);
      const dbAccounts = res.data || [];

      if (dbAccounts.length > 0) {
        const mappedAccounts = dbAccounts.map((a, idx) => mapDbToCompanionAccount(a, idx === 0));
        setAccounts(mappedAccounts);

        const savedSelected = typeof window !== "undefined" ? localStorage.getItem(STORAGE_COMPANION_ACC_KEY) : null;
        const validSelected = savedSelected && mappedAccounts.some((a) => a.id === savedSelected) ? savedSelected : mappedAccounts[0].id;
        setSelectedAccountId(validSelected);
      } else {
        setAccounts([]);
        setSelectedAccountId(null);
      }
    } catch (err) {
      console.warn("[CompanionAccountContext] Failed to load saved accounts:", err);
    }
  }, [supabase]);

  // Synchronize connection status from CompanionProvider
  useEffect(() => {
    setConnectionStatus(companion?.isConnected ? "Connected" : "Disconnected");
  }, [companion?.isConnected]);

  // Hydrate accounts on mount
  useEffect(() => {
    loadSavedAccounts();
  }, [loadSavedAccounts]);

  // Listen for account mutations and reload persistence
  useAppEventListener(
    ["tradefourge:account-created", "tradefourge:account-updated", "tradefourge:account-deleted", "tradefourge:data-changed"],
    () => {
      loadSavedAccounts();
    }
  );

  const currentAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;

  const switchAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_COMPANION_ACC_KEY, id);
    }
  }, []);

  /**
   * Phase 1 & 3: Run account discovery via Companion extension.
   * Returns discovered accounts list WITHOUT forcing them directly into account state.
   */
  const discoverAccounts = useCallback(async (): Promise<DiscoveredAccount[]> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    try {
      const liveDiscovered = companion ? await companion.discoverAccounts() : [];
      setLastScanTime(new Date().toLocaleTimeString());
      setRawDiscoveredList(liveDiscovered);

      if (companion?.lastError) {
        setDiscoveryError(companion.lastError.message);
      }

      if (liveDiscovered.length === 0) {
        if (!companion?.isConnected) {
          setDiscoveryError("TradeFourge Companion Extension is not connected. Please ensure the extension is installed and active.");
        } else if (!discoveryError) {
          setDiscoveryError("No Exness accounts detected on the active page. Please ensure you are logged into my.exness.com.");
        }
      } else {
        setDiscoveryError(null);
      }

      return liveDiscovered;
    } catch (err: any) {
      setRawDiscoveredList([]);
      setDiscoveryError(err?.message || "Account discovery failed. Ensure Exness is open in your browser.");
      return [];
    } finally {
      setIsDiscovering(false);
    }
  }, [companion, discoveryError]);

  /**
   * Phase 11 & 12: Import Selected Accounts.
   * Creates canonical account records, fetches trade history from Exness,
   * normalizes trade records, and writes to canonical trade store.
   */
  const importSelectedAccounts = useCallback(
    async (selectedAccounts: DiscoveredAccount[]): Promise<void> => {
      if (!selectedAccounts || selectedAccounts.length === 0) return;

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || "default_user";

      for (let i = 0; i < selectedAccounts.length; i++) {
        const da = selectedAccounts[i];
        const cleanNum = String(da.account_number).replace(/\D/g, "");

        // 1. Create canonical account record in AccountService / AccountsContext
        const accPayload = {
          account_name: da.account_name || `Exness ${da.account_type || "Standard"} #${cleanNum}`,
          broker: da.broker || "Exness",
          platform: (da.platform as any) || "MetaTrader 5",
          account_number: cleanNum,
          account_type: (da.account_type as any) || "Standard",
          currency: da.currency || "USD",
          starting_balance: da.balance || 0,
          current_balance: da.balance || 0,
          server: da.server || "Server unavailable",
          leverage: da.leverage || "1:2000",
          is_default: i === 0,
          is_active: true,
          notes: null,
        };

        const accRes = await AccountService.createAccount(userId, accPayload);
        const createdAccountId = accRes.data?.id || `acc_${cleanNum}`;

        // 2. Fetch trade history via Companion bridge
        try {
          let fetchedTrades: any[] = [];
          if (companion) {
            const importRes = await companion.importHistory([cleanNum]);
            fetchedTrades = importRes?.trades || [];
          }

          if (fetchedTrades.length > 0) {
            // 3. Normalize trade records into NewCloudTrade model
            const normalizedTrades: NewCloudTrade[] = fetchedTrades.map((t: any) => ({
              account_id: createdAccountId,
              ticket: String(t.ticket || `${cleanNum}_${Date.now()}`),
              symbol: String(t.symbol || "EURUSD").toUpperCase(),
              side: String(t.side || "BUY").toUpperCase().includes("SELL") ? "SELL" : "BUY",
              volume: Number(t.volume) || 0.1,
              open_price: Number(t.open_price) || 1.0,
              close_price: Number(t.close_price) || 1.0,
              stop_loss: t.stop_loss !== undefined ? Number(t.stop_loss) : null,
              take_profit: t.take_profit !== undefined ? Number(t.take_profit) : null,
              open_time: t.open_time || new Date().toISOString(),
              close_time: t.close_time || new Date().toISOString(),
              duration_seconds: t.duration_seconds !== undefined ? Number(t.duration_seconds) : null,
              profit: Number(t.profit) || 0,
              commission: Number(t.commission) || 0,
              swap: Number(t.swap) || 0,
              rr_ratio: null,
              risk_amount: null,
              outcome: (Number(t.profit) || 0) > 0 ? "WIN" : (Number(t.profit) || 0) < 0 ? "LOSS" : "BREAKEVEN",
              source: "api",
              session: null,
              strategy: null,
              notes: null,
              emotions: null,
              lessons: null,
              mistakes: null,
              magic_number: null,
            }));

            // 4. Bulk insert into canonical trade store
            await bulkInsertTrades(userId, normalizedTrades);
            console.log(`[CompanionImport] Persisted ${normalizedTrades.length} trades for account #${cleanNum}.`);
          } else {
            console.log(`[CompanionImport] No history trades found for account #${cleanNum}. Account ready with 0 trades.`);
          }
        } catch (err) {
          console.warn(`Trade history fetch note for #${cleanNum}:`, err);
        }
      }

      await loadSavedAccounts();
      emitAppEvent("tradefourge:account-created", { count: selectedAccounts.length });
    },
    [supabase, companion, loadSavedAccounts]
  );

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
    async (id: string) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || "default_user";

      await AccountService.deleteAccount(id, userId);
      await loadSavedAccounts();
    },
    [supabase, loadSavedAccounts]
  );

  const setDefaultAccount = useCallback(
    async (id: string) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || "default_user";

      await AccountService.updateAccount(id, userId, { is_default: true });
      await loadSavedAccounts();
    },
    [supabase, loadSavedAccounts]
  );

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
        rawDiscoveredList,
        extensionInfo: {
          browser: companion?.browser || "Chrome / Chromium",
          version: companion?.version || "v5.5.3 Manifest V3",
          status: connectionStatus === "Connected" ? "Active Stream" : "Disconnected",
          lastScan: lastScanTime,
        },
        switchAccount,
        discoverAccounts,
        importSelectedAccounts,
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
