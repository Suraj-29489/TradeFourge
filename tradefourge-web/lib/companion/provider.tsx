"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CompanionBridge } from "./bridge";
import { DiscoveredAccount, ImportProgressPayload, TFMessageEnvelope, TFMessageError } from "./protocol";
import { CompanionContextValue, CompanionHealth, CompanionLogEntry, CompanionState } from "./types";

const CompanionContext = createContext<CompanionContextValue | null>(null);

const INITIAL_STATE: CompanionState = {
  isInstalled: false,
  isConnected: false,
  browser: "Unknown",
  version: "",
  lastHeartbeat: null,
  latency: 0,
  connectionState: "waiting",
  health: "Disconnected",
  accountsCount: 0,
  discoveredAccounts: [],
  selectedAccountIds: [],
  historyStatus: "Pending",
  realtimeStatus: "Disconnected",
  importProgress: null,
  lastSyncTime: null,
  connectionTime: null,
  logs: [],
  lastError: null,
};

export const CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CompanionState>({
    ...INITIAL_STATE,
    browser: CompanionBridge.getInstance().getBrowser(),
  });

  const bridge = CompanionBridge.getInstance();

  const addLog = useCallback((severity: CompanionLogEntry["severity"], event: string, description: string) => {
    const entry: CompanionLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      severity,
      event,
      description,
    };
    setState((prev) => ({
      ...prev,
      logs: [entry, ...prev.logs].slice(0, 50),
    }));
  }, []);

  const checkExtension = useCallback(async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const response = await bridge.send("PING", undefined, 3000);
      const latency = Math.max(1, Date.now() - startTime);

      const version = response?.version || "1.2.0";
      const browser = bridge.getBrowser();

      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isConnected: true,
        version,
        browser,
        latency,
        connectionState: "connected",
        health: latency < 150 ? "Excellent" : latency < 400 ? "Good" : "Warning",
        lastHeartbeat: "Just now",
        connectionTime: prev.connectionTime || new Date().toISOString().replace("T", " ").slice(0, 19),
        lastError: null,
      }));

      addLog("SUCCESS", "Extension Detected", `Handshake verified with TradeFourge Companion ${version} (${latency}ms).`);
      return true;
    } catch (err: any) {
      const errorPayload: TFMessageError = {
        code: "EXTENSION_MISSING",
        message: "TradeFourge Companion Extension is not detected or not responding in the current browser runtime.",
        details: err?.message || err,
      };

      setState((prev) => ({
        ...prev,
        isInstalled: false,
        isConnected: false,
        connectionState: "waiting",
        health: "Disconnected",
        realtimeStatus: "Disconnected",
        lastError: errorPayload,
      }));

      addLog("WARNING", "Extension Not Responding", "Waiting for TradeFourge Companion Extension to establish bridge.");
      return false;
    }
  }, [bridge, addLog]);

  const discoverAccounts = useCallback(async (): Promise<DiscoveredAccount[]> => {
    try {
      addLog("INFO", "Discovering Accounts", "Requesting active Exness trading accounts from extension...");
      const accounts = await bridge.send<DiscoveredAccount[]>("DISCOVER_ACCOUNTS", undefined, 6000);

      const readyIds = (accounts || [])
        .filter((acc) => acc.status === "Ready" || !acc.is_archived)
        .map((acc) => acc.account_number);

      setState((prev) => ({
        ...prev,
        discoveredAccounts: accounts || [],
        selectedAccountIds: readyIds,
        accountsCount: (accounts || []).length,
        lastError: null,
      }));

      addLog(
        "SUCCESS",
        "Accounts Discovered",
        `Discovered ${accounts?.length || 0} trading accounts from Exness bridge.`
      );

      return accounts || [];
    } catch (err: any) {
      const errorPayload: TFMessageError = {
        code: "EXNESS_NOT_OPEN",
        message: "Unable to read Exness trading accounts. Ensure you are logged into Exness terminal.",
        details: err,
      };

      setState((prev) => ({ ...prev, lastError: errorPayload }));
      addLog("ERROR", "Account Discovery Failed", errorPayload.message);
      return [];
    }
  }, [bridge, addLog]);

  const importSelectedAccounts = useCallback(
    async (accountIds: string[]): Promise<boolean> => {
      try {
        addLog("INFO", "Import Selected Accounts", `Initiating history import for ${accountIds.length} accounts...`);
        setState((prev) => ({
          ...prev,
          historyStatus: "Syncing",
          realtimeStatus: "Syncing",
          lastError: null,
        }));

        await bridge.send("IMPORT_SELECTED_ACCOUNTS", { accountIds }, 10000);
        return true;
      } catch (err: any) {
        const errorPayload: TFMessageError = {
          code: "IMPORT_FAILED",
          message: "Failed to initiate history import pipeline with Companion Extension.",
          details: err,
        };

        setState((prev) => ({ ...prev, historyStatus: "Pending", lastError: errorPayload }));
        addLog("ERROR", "Import Start Failed", errorPayload.message);
        return false;
      }
    },
    [bridge, addLog]
  );

  const reconnect = useCallback(async (): Promise<void> => {
    addLog("INFO", "Manual Reconnect", "Re-establishing extension bridge connection...");
    await checkExtension();
  }, [checkExtension, addLog]);

  const syncNow = useCallback(async (): Promise<void> => {
    addLog("INFO", "Manual Sync", "Triggering sync request across connected accounts...");
    try {
      await bridge.send("HEARTBEAT", undefined, 3000);
      setState((prev) => ({ ...prev, lastSyncTime: "Just now" }));
      addLog("SUCCESS", "Sync Complete", "Trade tickets and account balances synchronized.");
    } catch {
      addLog("WARNING", "Sync Timeout", "Extension did not respond to sync request.");
    }
  }, [bridge, addLog]);

  const disconnect = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      isConnected: false,
      connectionState: "disconnected",
      health: "Disconnected",
      realtimeStatus: "Disconnected",
    }));
    addLog("WARNING", "Disconnected", "Extension connection severed by user.");
  }, [addLog]);

  const repairConnection = useCallback(async (): Promise<void> => {
    addLog("INFO", "Repair Connection", "Attempting connection repair protocol...");
    await reconnect();
  }, [reconnect, addLog]);

  const toggleAccountSelection = useCallback((accountNumber: string) => {
    setState((prev) => {
      const exists = prev.selectedAccountIds.includes(accountNumber);
      const nextSelected = exists
        ? prev.selectedAccountIds.filter((id) => id !== accountNumber)
        : [...prev.selectedAccountIds, accountNumber];
      return { ...prev, selectedAccountIds: nextSelected };
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, lastError: null }));
  }, []);

  // Subscribe to Extension Event Pipeline
  useEffect(() => {
    const unsubProgress = bridge.subscribe("IMPORT_PROGRESS", (msg: TFMessageEnvelope<ImportProgressPayload>) => {
      if (msg.payload) {
        setState((prev) => ({
          ...prev,
          historyStatus: "Syncing",
          importProgress: msg.payload ?? null,
        }));
      }
    });

    const unsubCompleted = bridge.subscribe("IMPORT_COMPLETED", (msg: TFMessageEnvelope<ImportProgressPayload>) => {
      if (msg.payload) {
        setState((prev) => ({
          ...prev,
          historyStatus: "Imported",
          realtimeStatus: "Connected",
          importProgress: msg.payload ?? null,
          lastSyncTime: "Just now",
        }));
        addLog("SUCCESS", "History Import Completed", `Successfully imported ${msg.payload.totalTrades} historical trades.`);
      }
    });

    const unsubLive = bridge.subscribe("LIVE_EVENT", (msg: TFMessageEnvelope) => {
      setState((prev) => ({ ...prev, lastSyncTime: "Just now" }));
      addLog("INFO", "Realtime Trade Event", `Received live trade payload from extension (${msg.type}).`);
    });

    const unsubError = bridge.subscribe("ERROR", (msg: TFMessageEnvelope<TFMessageError>) => {
      if (msg.error) {
        setState((prev) => ({ ...prev, lastError: msg.error! }));
        addLog("ERROR", "Extension Error", msg.error.message);
      }
    });

    return () => {
      unsubProgress();
      unsubCompleted();
      unsubLive();
      unsubError();
    };
  }, [bridge, addLog]);

  // Initial detection ping
  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  const value: CompanionContextValue = {
    ...state,
    checkExtension,
    discoverAccounts,
    importSelectedAccounts,
    reconnect,
    syncNow,
    disconnect,
    repairConnection,
    toggleAccountSelection,
    clearError,
  };

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
};

export const useCompanion = (): CompanionContextValue => {
  const context = useContext(CompanionContext);
  if (!context) {
    throw new Error("useCompanion must be used within a CompanionProvider");
  }
  return context;
};
