"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DEFAULT_COMPANION_STATE, calculateHealth } from "./status";
import { CompanionContextValue, CompanionState, CompanionLogEntry } from "./types";
import { CompanionConnectionService } from "./connection";

const CompanionContext = createContext<CompanionContextValue | null>(null);

export const CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CompanionState>(DEFAULT_COMPANION_STATE);

  const connectionService = CompanionConnectionService.getInstance();

  const checkExtension = useCallback(async (): Promise<boolean> => {
    const isFound = await connectionService.detectExtension();
    const { latency, alive } = await connectionService.pingHeartbeat();

    setState((prev) => ({
      ...prev,
      isInstalled: isFound,
      isConnected: isFound && alive,
      connectionState: isFound && alive ? "connected" : "waiting",
      latency,
      health: calculateHealth(latency, isFound && alive),
      lastHeartbeat: "Just now",
    }));

    return isFound;
  }, [connectionService]);

  const reconnect = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, connectionState: "syncing" }));
    await new Promise((r) => setTimeout(r, 600));
    await checkExtension();
    const newLog: CompanionLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      severity: "INFO",
      event: "Manual Reconnect",
      description: "User triggered manual connection refresh.",
    };
    setState((prev) => ({ ...prev, logs: [newLog, ...prev.logs] }));
  }, [checkExtension]);

  const syncNow = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, connectionState: "syncing" }));
    await new Promise((r) => setTimeout(r, 800));
    const newLog: CompanionLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      severity: "SUCCESS",
      event: "Manual Sync Completed",
      description: "Synchronized account balances and trade tickets.",
    };
    setState((prev) => ({
      ...prev,
      connectionState: "connected",
      lastSyncTime: "Just now",
      logs: [newLog, ...prev.logs],
    }));
  }, []);

  const disconnect = useCallback((): void => {
    const newLog: CompanionLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      severity: "WARNING",
      event: "Disconnected",
      description: "Extension bridge connection was severed by user.",
    };
    setState((prev) => ({
      ...prev,
      isConnected: false,
      connectionState: "disconnected",
      health: "Disconnected",
      realtimeStatus: "Disconnected",
      logs: [newLog, ...prev.logs],
    }));
  }, []);

  const repairConnection = useCallback(async (): Promise<void> => {
    await reconnect();
  }, [reconnect]);

  const toggleMockInstallation = useCallback((): void => {
    setState((prev) => {
      const nextInstalled = !prev.isInstalled;
      return {
        ...prev,
        isInstalled: nextInstalled,
        isConnected: nextInstalled,
        connectionState: nextInstalled ? "connected" : "waiting",
        health: nextInstalled ? "Excellent" : "Disconnected",
        realtimeStatus: nextInstalled ? "Connected" : "Disconnected",
      };
    });
  }, []);

  useEffect(() => {
    // Initial heartbeat ping
    checkExtension();
  }, [checkExtension]);

  const value: CompanionContextValue = {
    ...state,
    checkExtension,
    reconnect,
    syncNow,
    disconnect,
    repairConnection,
    toggleMockInstallation,
  };

  return (
    <CompanionContext.Provider value={value}>
      {children}
    </CompanionContext.Provider>
  );
};

export const useCompanion = (): CompanionContextValue => {
  const context = useContext(CompanionContext);
  if (!context) {
    throw new Error("useCompanion must be used within a CompanionProvider");
  }
  return context;
};
