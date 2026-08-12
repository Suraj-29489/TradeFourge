"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  MT5Account,
  MT5Trade,
  MT5ConnectionStatus,
  MT5Settings,
  MT5TradeFilter,
  MT5Timeframe,
  MT5EquityPoint,
  MT5LivePosition,
  MT5LiveAccountState,
} from "@/types/mt5";
import { defaultMT5DataProvider } from "@/lib/mt5/SupabaseMT5DataProvider";
import type { MT5ConnectorRecord, MT5SyncBatchRecord } from "@/types/mt5-api";

interface MT5CompanionContextType {
  accounts: MT5Account[];
  selectedAccountId: string;
  selectedAccount: MT5Account | null;
  connectionStatus: MT5ConnectionStatus;
  trades: MT5Trade[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdatedText: string;
  settings: MT5Settings;
  connectors: MT5ConnectorRecord[];
  syncHistory: MT5SyncBatchRecord[];
  isConnectorLoading: boolean;
  // Transient Live Position State
  liveState: MT5LiveAccountState | null;
  openPositions: MT5LivePosition[];
  isLiveStale: boolean;
  lastLiveUpdateText: string;
  isReconciling: boolean;
  fetchLiveState: () => Promise<void>;
  reconcileHistory: (days?: number) => Promise<{ status: string; message: string }>;
  selectAccount: (accountId: string) => void;
  refreshAccount: (accountId?: string) => Promise<void>;
  addAccount: (accountData: Omit<MT5Account, "id" | "balance" | "equity" | "freeMargin" | "floatingPnl" | "profitToday" | "connectionStatus" | "lastUpdated"> & { password?: string }) => Promise<MT5Account>;
  disconnectAccount: (accountId: string) => Promise<boolean>;
  getTradesForAccount: (filter?: MT5TradeFilter) => Promise<MT5Trade[]>;
  fetchHistoricalTrades: (fromDate: string, toDate: string) => Promise<{ addedCount: number }>;
  getEquityHistory: (timeframe: MT5Timeframe) => Promise<{
    points: MT5EquityPoint[];
    startingBalance: number;
    currentEquity: number;
    high: number;
    low: number;
  }>;
  updateSettings: (newSettings: Partial<MT5Settings>) => void;
  fetchConnectors: () => Promise<void>;
  pairNewConnector: (userEmail: string, connectorName?: string) => Promise<{ apiKey: string; connectorId: string } | null>;
  revokeConnector: (connectorId: string) => Promise<boolean>;
  fetchSyncHistory: () => Promise<void>;
}


const DEFAULT_SETTINGS: MT5Settings = {
  defaultAccountId: "",
  autoRefresh: true,
  autoRefreshInterval: 30,
  defaultHistoryRange: "Recent Trades",
  defaultTradeSide: "ALL",
  timeFormat: "24h",
  dateFormat: "DD/MM/YYYY",
  timezone: "UTC",
  currency: "USD",
};

const STORAGE_ACCOUNT_KEY = "tf_mt5_selected_account";
const STORAGE_SETTINGS_KEY = "tf_mt5_settings";

const MT5CompanionContext = createContext<MT5CompanionContextType | null>(null);

export const MT5CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<MT5Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [trades, setTrades] = useState<MT5Trade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [settings, setSettings] = useState<MT5Settings>(DEFAULT_SETTINGS);

  // Backend Connector State
  const [connectors, setConnectors] = useState<MT5ConnectorRecord[]>([]);
  const [syncHistory, setSyncHistory] = useState<MT5SyncBatchRecord[]>([]);
  const [isConnectorLoading, setIsConnectorLoading] = useState<boolean>(false);

  // Load saved settings & selected account from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedAccount = localStorage.getItem(STORAGE_ACCOUNT_KEY);
    if (savedAccount) {
      setSelectedAccountId(savedAccount);
    }
    const savedSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch {}
    }
  }, []);

  // Fetch Connectors from Backend API
  const fetchConnectors = useCallback(async () => {
    setIsConnectorLoading(true);
    try {
      const res = await fetch("/api/mt5/connectors");
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setConnectors(json.data);
        }
      }
    } catch (e) {
      console.warn("Notice: Connector API fetch fallback", e);
    } finally {
      setIsConnectorLoading(false);
    }
  }, []);

  // Fetch Sync History from Backend API
  const fetchSyncHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/mt5/sync-history");
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setSyncHistory(json.data);
        }
      }
    } catch (e) {
      console.warn("Notice: Sync History API fetch fallback", e);
    }
  }, []);

  // Pair New Connector via Backend API
  const pairNewConnector = useCallback(async (userEmail: string, connectorName?: string) => {
    try {
      const res = await fetch("/api/mt5/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, connector_name: connectorName }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        await fetchConnectors();
        return { apiKey: json.data.api_key, connectorId: json.data.connector_id };
      }
    } catch (e) {
      console.error("Error pairing connector", e);
    }
    return null;
  }, [fetchConnectors]);

  // Revoke Connector via Backend API
  const revokeConnector = useCallback(async (connectorId: string) => {
    try {
      const res = await fetch(`/api/mt5/connectors?id=${connectorId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConnectors((prev) => prev.filter((c) => c.id !== connectorId));
        return true;
      }
    } catch (e) {
      console.error("Error revoking connector", e);
    }
    return false;
  }, []);

  // Initial accounts fetch
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const accs = await defaultMT5DataProvider.getAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccountId((prev) => {
          const exists = accs.find((a) => a.id === prev || a.accountNumber === prev);
          return exists ? exists.id : accs[0].id;
        });
      } else {
        setSelectedAccountId("");
        setTrades([]);
        setLiveState(null);
      }
    } catch (e) {
      console.error("Error loading MT5 accounts", e);
      setAccounts([]);
      setSelectedAccountId("");
      setTrades([]);
      setLiveState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load trades whenever selected account changes
  const loadTrades = useCallback(async (accId: string) => {
    if (!accId || !accId.trim()) {
      setTrades([]);
      return;
    }
    try {
      const t = await defaultMT5DataProvider.getTrades(accId);
      setTrades(t);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error loading MT5 trades", e);
      setTrades([]);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    fetchConnectors();
    fetchSyncHistory();
  }, [loadAccounts, fetchConnectors, fetchSyncHistory]);

  // Event listener for global tradefourge data updates (from connector or sync)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDataChanged = () => {
      loadAccounts();
      if (selectedAccountId) {
        loadTrades(selectedAccountId);
      }
      fetchConnectors();
      fetchSyncHistory();
    };

    window.addEventListener("tradefourge:data-changed", handleDataChanged);
    window.addEventListener("tradefourge:trade-created", handleDataChanged);

    return () => {
      window.removeEventListener("tradefourge:data-changed", handleDataChanged);
      window.removeEventListener("tradefourge:trade-created", handleDataChanged);
    };
  }, [loadAccounts, loadTrades, selectedAccountId, fetchConnectors, fetchSyncHistory]);

  // Auto-refresh interval polling
  useEffect(() => {
    if (!settings.autoRefresh || !settings.autoRefreshInterval) return;

    const intervalMs = settings.autoRefreshInterval * 1000;
    const timer = setInterval(() => {
      loadAccounts();
      if (selectedAccountId) {
        loadTrades(selectedAccountId);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [settings.autoRefresh, settings.autoRefreshInterval, loadAccounts, loadTrades, selectedAccountId]);

  // Transient Live Position State
  const [liveState, setLiveState] = useState<MT5LiveAccountState | null>(null);

  const openPositions = useMemo(() => {
    return liveState?.positions || [];
  }, [liveState]);

  const isLiveStale = useMemo(() => {
    return liveState ? liveState.isStale : true;
  }, [liveState]);

  const lastLiveUpdateText = useMemo(() => {
    if (!liveState || !liveState.observedAt) return "No live update";
    const sec = liveState.lastUpdateSecAgo;
    if (sec < 0) return "No live update";
    if (sec === 0) return "Just now";
    return `${sec}s ago`;
  }, [liveState]);

  // Fetch Live State from GET /api/mt5/live
  const fetchLiveState = useCallback(async () => {
    if (!selectedAccountId) {
      setLiveState(null);
      return;
    }
    try {
      const res = await fetch(`/api/mt5/live?account_id=${selectedAccountId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setLiveState(json.data);
        }
      }
    } catch (e) {
      console.warn("Notice: Error fetching MT5 live state", e);
    }
  }, [selectedAccountId]);

  // Fast 2-second polling for Live Workspace when account selected
  useEffect(() => {
    if (!selectedAccountId) {
      setLiveState(null);
      return;
    }

    fetchLiveState();
    const timer = setInterval(() => {
      fetchLiveState();
    }, 2000);

    return () => clearInterval(timer);
  }, [selectedAccountId, fetchLiveState]);

  useEffect(() => {
    if (selectedAccountId) {
      loadTrades(selectedAccountId);
      fetchLiveState();
    } else {
      setTrades([]);
      setLiveState(null);
    }
  }, [selectedAccountId, loadTrades, fetchLiveState]);

  const selectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setTrades([]);
    setLiveState(null);
    if (typeof window !== "undefined") {
      if (accountId) {
        localStorage.setItem(STORAGE_ACCOUNT_KEY, accountId);
      } else {
        localStorage.removeItem(STORAGE_ACCOUNT_KEY);
      }
    }
  }, []);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return accounts.find((a) => a.id === selectedAccountId || a.accountNumber === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  const connectionStatus: MT5ConnectionStatus = selectedAccount?.connectionStatus || "Disconnected";

  const refreshAccount = useCallback(async (accountId?: string) => {
    const targetId = accountId || selectedAccountId;
    if (!targetId) return;
    setIsRefreshing(true);
    try {
      const updated = await defaultMT5DataProvider.refreshAccount(targetId);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      await loadTrades(targetId);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error refreshing MT5 account", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedAccountId, loadTrades]);

  const addAccount = useCallback(async (accountData: Omit<MT5Account, "id" | "balance" | "equity" | "freeMargin" | "floatingPnl" | "profitToday" | "connectionStatus" | "lastUpdated"> & { password?: string }) => {
    const created = await defaultMT5DataProvider.addAccount(accountData);
    setAccounts((prev) => [...prev, created]);
    selectAccount(created.id);
    await loadTrades(created.id);
    return created;
  }, [selectAccount, loadTrades]);

  const disconnectAccount = useCallback(async (accountId: string) => {
    const success = await defaultMT5DataProvider.disconnectAccount(accountId);
    if (success) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId || a.accountNumber === accountId ? { ...a, connectionStatus: "Disconnected" } : a))
      );
    }
    return success;
  }, []);

  const getTradesForAccount = useCallback(async (filter?: MT5TradeFilter) => {
    return defaultMT5DataProvider.getTrades(selectedAccountId, filter);
  }, [selectedAccountId]);

  const fetchHistoricalTrades = useCallback(async (fromDate: string, toDate: string) => {
    const res = await defaultMT5DataProvider.fetchHistoricalTrades(selectedAccountId, fromDate, toDate);
    await loadTrades(selectedAccountId);
    return res;
  }, [selectedAccountId, loadTrades]);

  const getEquityHistory = useCallback(async (timeframe: MT5Timeframe) => {
    return defaultMT5DataProvider.getEquityHistory(selectedAccountId, timeframe);
  }, [selectedAccountId]);

  const updateSettings = useCallback((newSettings: Partial<MT5Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  const reconcileHistory = useCallback(async (days = 30) => {
    if (!selectedAccountId) {
      return { status: "error", message: "No account selected for reconciliation." };
    }
    setIsReconciling(true);
    try {
      const res = await fetch("/api/mt5/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: selectedAccountId, days }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        await loadTrades(selectedAccountId);
        await fetchSyncHistory();
        return {
          status: json.data.status || "initiated",
          message: json.data.message || "Historical reconciliation initiated.",
        };
      }
      return { status: "error", message: json.error?.message || "Reconciliation failed." };
    } catch (e: any) {
      return { status: "error", message: e?.message || "Error initiating reconciliation." };
    } finally {
      setIsReconciling(false);
    }
  }, [selectedAccountId, loadTrades, fetchSyncHistory]);

  const lastUpdatedText = useMemo(() => {
    return lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [lastUpdated]);

  return (
    <MT5CompanionContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        connectionStatus,
        trades,
        isLoading,
        isRefreshing,
        lastUpdatedText,
        settings,
        connectors,
        syncHistory,
        isConnectorLoading,
        liveState,
        openPositions,
        isLiveStale,
        lastLiveUpdateText,
        isReconciling,
        fetchLiveState,
        reconcileHistory,
        selectAccount,
        refreshAccount,
        addAccount,
        disconnectAccount,
        getTradesForAccount,
        fetchHistoricalTrades,
        getEquityHistory,
        updateSettings,
        fetchConnectors,
        pairNewConnector,
        revokeConnector,
        fetchSyncHistory,
      }}
    >
      {children}
    </MT5CompanionContext.Provider>
  );
};

export const useMT5Companion = () => {
  const ctx = useContext(MT5CompanionContext);
  if (!ctx) {
    throw new Error("useMT5Companion must be used within an MT5CompanionProvider");
  }
  return ctx;
};
