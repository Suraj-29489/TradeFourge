"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { CompanionBridge } from "./bridge";
import {
  DiscoveredAccount,
  ImportProgressPayload,
  LiveTradeEventPayload,
  TFMessageEnvelope,
  TFMessageError,
} from "./protocol";
import { CompanionContextValue, CompanionHealth, CompanionLogEntry, CompanionState } from "./types";

const TAG = "[CompanionProvider]";

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

// ─── Heartbeat / Auto-Reconnect Config ──────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const RECONNECT_INTERVAL_MS = 5000; // 5 seconds when disconnected
const MAX_RECONNECT_ATTEMPTS = 60; // Stop after 5 minutes

export const CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CompanionState>({
    ...INITIAL_STATE,
    browser: CompanionBridge.getInstance().getBrowser(),
  });

  const bridge = CompanionBridge.getInstance();
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectedRef = useRef(false);

  // Keep ref in sync with state for use in intervals
  useEffect(() => {
    isConnectedRef.current = state.isConnected;
  }, [state.isConnected]);

  const addLog = useCallback((severity: CompanionLogEntry["severity"], event: string, description: string) => {
    const entry: CompanionLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      severity,
      event,
      description,
    };
    console.log(`${TAG} [${severity}] ${event}: ${description}`);
    setState((prev) => ({
      ...prev,
      logs: [entry, ...prev.logs].slice(0, 50),
    }));
  }, []);

  // ─── Check Extension (PING → PONG) ─────────────────────────────────────────
  const checkExtension = useCallback(async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const response = await bridge.send("PING", undefined, 3000);
      const latency = Math.max(1, Date.now() - startTime);

      const version = response?.version || "3.4.0";
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
        lastHeartbeat: new Date().toISOString().replace("T", " ").slice(0, 19),
        connectionTime: prev.connectionTime || new Date().toISOString().replace("T", " ").slice(0, 19),
        lastError: null,
      }));

      // Reset reconnect counter on success
      reconnectAttemptsRef.current = 0;

      addLog("SUCCESS", "Extension Detected", `Handshake verified with TradeFourge Companion v${version} (${latency}ms).`);
      return true;
    } catch (err: any) {
      const errorPayload: TFMessageError = {
        code: "EXTENSION_MISSING",
        message: "TradeFourge Companion Extension is not detected or not responding.",
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

      addLog("WARNING", "Extension Not Responding", "Waiting for TradeFourge Companion Extension.");
      return false;
    }
  }, [bridge, addLog]);

  // ─── Discover Accounts ────────────────────────────────────────────────────
  const discoverAccounts = useCallback(async (): Promise<DiscoveredAccount[]> => {
    try {
      addLog("INFO", "Discovering Accounts", "Requesting active Exness trading accounts from extension...");
      const accounts = await bridge.send<DiscoveredAccount[]>("DISCOVER_ACCOUNTS", undefined, 8000);

      const accountList = Array.isArray(accounts) ? accounts : [];
      const readyIds = accountList
        .filter((acc) => acc.status === "Ready" || !acc.is_archived)
        .map((acc) => acc.account_number);

      setState((prev) => ({
        ...prev,
        discoveredAccounts: accountList,
        selectedAccountIds: readyIds,
        accountsCount: accountList.length,
        lastError: null,
      }));

      addLog("SUCCESS", "Accounts Discovered", `Discovered ${accountList.length} trading accounts from Exness bridge.`);
      return accountList;
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

  // ─── Import Selected Accounts ─────────────────────────────────────────────
  const importSelectedAccounts = useCallback(
    async (accountIds: string[]): Promise<boolean> => {
      try {
        addLog("INFO", "Import Selected Accounts", `Initiating history import for ${accountIds.length} accounts...`);
        setState((prev) => ({
          ...prev,
          historyStatus: "Syncing",
          realtimeStatus: "Syncing",
          importProgress: {
            fetchedTrades: 0,
            totalTrades: 0,
            offset: 0,
            percentage: 0,
            stage: "connecting",
            message: "Connecting to Exness import pipeline...",
          },
          lastError: null,
        }));

        // This resolves with IMPORT_STARTED. Further IMPORT_PROGRESS and IMPORT_COMPLETED
        // events arrive via push channel (background → injector → window.postMessage → bridge subscription)
        await bridge.send("IMPORT_SELECTED_ACCOUNTS", { accountIds }, 10000);
        addLog("INFO", "Import Pipeline Active", "Import started. Listening for progress events via push channel.");
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

  // ─── Reconnect / Sync / Disconnect ────────────────────────────────────────
  const reconnect = useCallback(async (): Promise<void> => {
    addLog("INFO", "Manual Reconnect", "Re-establishing extension bridge connection...");
    await checkExtension();
  }, [checkExtension, addLog]);

  const syncNow = useCallback(async (): Promise<void> => {
    addLog("INFO", "Manual Sync", "Triggering sync request across connected accounts...");
    try {
      await bridge.send("HEARTBEAT", undefined, 3000);
      setState((prev) => ({
        ...prev,
        lastSyncTime: new Date().toISOString().replace("T", " ").slice(0, 19),
        lastHeartbeat: new Date().toISOString().replace("T", " ").slice(0, 19),
      }));
      addLog("SUCCESS", "Sync Complete", "Trade tickets and account balances synchronized.");
    } catch {
      addLog("WARNING", "Sync Timeout", "Extension did not respond to sync request.");
    }
  }, [bridge, addLog]);

  const disconnect = useCallback((): void => {
    // Stop heartbeat
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
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
    reconnectAttemptsRef.current = 0; // Reset counter
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

  // ─── Push Event Subscriptions ─────────────────────────────────────────────
  // These fire when the background pushes events through:
  //   Background → Injector content script → window.postMessage → bridge window listener
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Import Progress
    unsubs.push(
      bridge.subscribe("IMPORT_PROGRESS", (msg: TFMessageEnvelope<ImportProgressPayload>) => {
        console.log(`${TAG} Received IMPORT_PROGRESS push event`, msg.payload);
        if (msg.payload) {
          setState((prev) => ({
            ...prev,
            historyStatus: "Syncing",
            importProgress: msg.payload ?? null,
          }));
          addLog("INFO", "Import Progress", `${msg.payload.percentage}% — ${msg.payload.message || msg.payload.stage}`);
        }
      })
    );

    // Import Completed
    unsubs.push(
      bridge.subscribe("IMPORT_COMPLETED", (msg: TFMessageEnvelope<ImportProgressPayload>) => {
        console.log(`${TAG} Received IMPORT_COMPLETED push event`, msg.payload);
        if (msg.payload) {
          const p = msg.payload;
          setState((prev) => ({
            ...prev,
            historyStatus: "Imported",
            realtimeStatus: "Connected",
            importProgress: {
              account_number: p.account_number,
              fetchedTrades: p.fetchedTrades ?? 0,
              totalTrades: p.totalTrades ?? 0,
              offset: p.offset ?? 0,
              percentage: 100,
              stage: "completed",
              message: p.message,
            },
            lastSyncTime: new Date().toISOString().replace("T", " ").slice(0, 19),
          }));
          addLog("SUCCESS", "History Import Completed", `Successfully imported ${p.totalTrades ?? 0} historical trades.`);
        }
      })
    );

    // Live Trade Events (individual types)
    const liveEventTypes = [
      "LIVE_EVENT",
      "POSITION_OPENED",
      "POSITION_MODIFIED",
      "POSITION_CLOSED",
      "BALANCE_UPDATED",
      "EQUITY_UPDATED",
      "ACCOUNT_UPDATED",
    ];

    for (const eventType of liveEventTypes) {
      unsubs.push(
        bridge.subscribe(eventType, (msg: TFMessageEnvelope) => {
          console.log(`${TAG} Received ${eventType} push event`, msg.payload);
          setState((prev) => ({
            ...prev,
            realtimeStatus: "Connected",
            lastSyncTime: new Date().toISOString().replace("T", " ").slice(0, 19),
          }));
          addLog("INFO", "Live Event", `${eventType}: ${JSON.stringify(msg.payload || {}).slice(0, 120)}`);
        })
      );
    }

    // PONG (from heartbeat push events)
    unsubs.push(
      bridge.subscribe("PONG", (msg: TFMessageEnvelope) => {
        if (msg.payload) {
          setState((prev) => ({
            ...prev,
            isConnected: true,
            connectionState: "connected",
            lastHeartbeat: new Date().toISOString().replace("T", " ").slice(0, 19),
            health: (msg.payload as any)?.health || prev.health,
          }));
        }
      })
    );

    // Errors
    unsubs.push(
      bridge.subscribe("ERROR", (msg: TFMessageEnvelope<TFMessageError>) => {
        if (msg.error) {
          setState((prev) => ({ ...prev, lastError: msg.error! }));
          addLog("ERROR", "Extension Error", msg.error.message);
        }
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [bridge, addLog]);

  // ─── Initial Detection + Auto-Reconnect ───────────────────────────────────
  useEffect(() => {
    // Initial check
    checkExtension().then((connected) => {
      if (connected) {
        // Start heartbeat polling
        startHeartbeat();
      } else {
        // Start reconnect loop
        startReconnect();
      }
    });

    function startHeartbeat() {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(async () => {
        try {
          const startTime = Date.now();
          await bridge.send("HEARTBEAT", undefined, 3000);
          const latency = Math.max(1, Date.now() - startTime);
          setState((prev) => ({
            ...prev,
            isConnected: true,
            connectionState: "connected",
            latency,
            lastHeartbeat: new Date().toISOString().replace("T", " ").slice(0, 19),
            health: latency < 150 ? "Excellent" : latency < 400 ? "Good" : "Warning",
          }));
        } catch {
          // Connection lost — switch to reconnect mode
          console.warn(`${TAG} Heartbeat failed. Switching to reconnect mode.`);
          setState((prev) => ({
            ...prev,
            isConnected: false,
            connectionState: "waiting",
            health: "Disconnected",
          }));
          if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
          }
          startReconnect();
        }
      }, HEARTBEAT_INTERVAL_MS);
    }

    function startReconnect() {
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
      reconnectAttemptsRef.current = 0;
      reconnectTimerRef.current = setInterval(async () => {
        if (isConnectedRef.current) {
          // Already connected — switch to heartbeat mode
          if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          startHeartbeat();
          return;
        }
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.warn(`${TAG} Max reconnect attempts reached. Stopping.`);
          if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          return;
        }
        reconnectAttemptsRef.current++;
        const result = await checkExtension();
        if (result) {
          // Connected — switch to heartbeat
          if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          startHeartbeat();
        }
      }, RECONNECT_INTERVAL_MS);
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
