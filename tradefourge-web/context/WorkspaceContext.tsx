"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { FileSpreadsheet, Zap, Layers, LucideIcon } from "lucide-react";

export type WorkspaceMode = "csv" | "tfc" | "mt5";

export interface WorkspaceMetadata {
  id: WorkspaceMode;
  name: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  isEnabled: boolean;
  statusText: string;
}

export const WORKSPACE_LIST: WorkspaceMetadata[] = [
  {
    id: "csv",
    name: "CSV Journal",
    badge: "CSV MODE",
    description: "Import CSV statement files & analyze historical trade performance with institutional metrics.",
    icon: FileSpreadsheet,
    isEnabled: true,
    statusText: "Active Workspace",
  },
  {
    id: "tfc",
    name: "TradeForge Companion",
    badge: "LIVE TFC",
    description: "Discovered account manager & real-time execution synchronization workspace.",
    icon: Zap,
    isEnabled: true,
    statusText: "Active Stream",
  },
  {
    id: "mt5",
    name: "MT5 Companion",
    badge: "MT5 WORKSPACE",
    description: "Dedicated workspace for connected MetaTrader 5 trading accounts, executions & analytics.",
    icon: Layers,
    isEnabled: true,
    statusText: "Active Workspace",
  },
];

interface WorkspaceContextType {
  currentWorkspace: WorkspaceMode;
  selectWorkspace: (mode: WorkspaceMode) => void;
  isWorkspaceActive: (mode: WorkspaceMode) => boolean;
  getWorkspaceMetadata: (mode: WorkspaceMode) => WorkspaceMetadata;
  workspaces: WorkspaceMetadata[];
}

const STORAGE_WORKSPACE_MODE_KEY = "tf_workspace_mode";

const WorkspaceContext = createContext<WorkspaceContextType>({
  currentWorkspace: "csv",
  selectWorkspace: () => {},
  isWorkspaceActive: () => false,
  getWorkspaceMetadata: () => WORKSPACE_LIST[0],
  workspaces: WORKSPACE_LIST,
});

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceMode>("csv");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_WORKSPACE_MODE_KEY) as WorkspaceMode | null;
    if (saved && (saved === "csv" || saved === "tfc" || saved === "mt5")) {
      setCurrentWorkspace(saved);
    }
  }, []);

  const selectWorkspace = useCallback((mode: WorkspaceMode) => {
    setCurrentWorkspace(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, mode);
    }
  }, []);

  const isWorkspaceActive = useCallback(
    (mode: WorkspaceMode) => currentWorkspace === mode,
    [currentWorkspace]
  );

  const getWorkspaceMetadata = useCallback(
    (mode: WorkspaceMode) => WORKSPACE_LIST.find((w) => w.id === mode) ?? WORKSPACE_LIST[0],
    []
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        selectWorkspace,
        isWorkspaceActive,
        getWorkspaceMetadata,
        workspaces: WORKSPACE_LIST,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
