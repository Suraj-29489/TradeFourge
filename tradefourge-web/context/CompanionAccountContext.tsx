import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CompanionAccount } from "@/lib/demo/demoAccounts";
import { useSafeCompanion } from "@/lib/companion/provider";
import type { DiscoveredAccount } from "@/lib/companion/protocol";
import { createClient } from "@/lib/supabase/client";
import { AccountService } from "@/lib/services/AccountService";
import { bulkInsertTrades } from "@/lib/supabase/trades";
import { emitAppEvent } from "@/lib/events/event-bus";
import { CompanionBridge } from "@/lib/companion/bridge";
import type { NewCloudTrade } from "@/types/database";

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

      const newCompanionAccounts: CompanionAccount[] = [];

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
        const createdAccountId = accRes.data?.id || `exness_${cleanNum}`;

        // 2. Fetch trade history via Companion bridge
        try {
          const importRes = await CompanionBridge.getInstance().send<any>("IMPORT_SELECTED_ACCOUNTS", { accountIds: [cleanNum] }, 10000);
          const rawTrades = importRes?.trades || importRes?.payload?.trades || [];

          if (rawTrades.length > 0) {
              // 3. Normalize trade records into NewCloudTrade model
              const normalizedTrades: NewCloudTrade[] = rawTrades.map((t: any) => ({
                account_id: createdAccountId,
                ticket: String(t.ticket || `${cleanNum}_${Date.now()}`),
                symbol: String(t.symbol || "EURUSD").toUpperCase(),
                side: String(t.side || "BUY").toUpperCase().includes("SELL") ? "SELL" : "BUY",
                volume: Number(t.volume) || 0.1,
                open_price: Number(t.open_price) || 1.0,
                close_price: Number(t.close_price) || 1.0,
                net_profit: Number(t.profit) || 0,
                profit: Number(t.profit) || 0,
                commission: Number(t.commission) || 0,
                swap: Number(t.swap) || 0,
                open_time: t.open_time || new Date().toISOString(),
                close_time: t.close_time || new Date().toISOString(),
                status: "CLOSED",
                source: "companion",
                outcome: (Number(t.profit) || 0) > 0 ? "WIN" : (Number(t.profit) || 0) < 0 ? "LOSS" : "BREAKEVEN",
              }));

              // 4. Bulk insert into canonical trade store
              await bulkInsertTrades(userId, normalizedTrades);
            }
          } catch (err) {
            console.warn(`Trade history fetch note for ${cleanNum}:`, err);
          }

        // 5. Add to local companion account state
        newCompanionAccounts.push({
          id: createdAccountId,
          accountNumber: cleanNum,
          broker: da.broker || "Exness",
          server: da.server || "Server unavailable",
          accountType: (da.account_type as any) || "Standard",
          currency: da.currency || "USD",
          leverage: da.leverage || "1:2000",
          balance: da.balance || 0,
          equity: da.equity || da.balance || 0,
          margin: 0,
          freeMargin: da.equity || da.balance || 0,
          profitToday: 0,
          floatingPnL: 0,
          isConnected: true,
          isDefault: i === 0,
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
        });
      }

      setAccounts((prev) => {
        const merged = [...prev];
        newCompanionAccounts.forEach((nA) => {
          if (!merged.some((m) => m.accountNumber === nA.accountNumber)) {
            merged.push(nA);
          }
        });
        return merged;
      });

      if (newCompanionAccounts.length > 0) {
        setSelectedAccountId(newCompanionAccounts[0].id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_COMPANION_ACC_KEY, newCompanionAccounts[0].id);
        }
      }

      emitAppEvent("tradefourge:account-created", { count: newCompanionAccounts.length });
    },
    [supabase, companion]
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
