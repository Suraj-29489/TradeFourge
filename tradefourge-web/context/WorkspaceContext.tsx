"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  // MT5 has its own unambiguous URL prefix ("/mt5/..."), so we can resolve
  // it correctly on the very first render — no need to wait for an effect
  // to run after the page has already painted. That's what was causing the
  // "CSV" workspace to flash briefly on MT5 pages when opening a link
  // (rather than a hard refresh): the state used to always start as "csv"
  // and only got corrected after the page had already rendered once.
  //
  // CSV vs TFC still share the exact same URLs, so those two can only be
  // told apart via localStorage, which is only readable on the client —
  // that part still resolves in the effect below.
  const initialWorkspace: WorkspaceMode = pathname?.startsWith("/mt5") ? "mt5" : "csv";
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceMode>(initialWorkspace);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (pathname?.startsWith("/mt5")) {
      setCurrentWorkspace((prev) => (prev === "mt5" ? prev : "mt5"));
      localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, "mt5");
      return;
    }

    const saved = localStorage.getItem(STORAGE_WORKSPACE_MODE_KEY) as WorkspaceMode | null;
    // Global routes (for example Admin Controls) do not identify a workspace
    // in their URL, so restore all valid workspace modes instead of treating
    // a saved MT5 selection as CSV.
    const resolved: WorkspaceMode =
      saved === "csv" || saved === "tfc" || saved === "mt5" ? saved : "csv";
    setCurrentWorkspace((prev) => (prev === resolved ? prev : resolved));
    // Re-run whenever the route changes so navigating between workspaces via
    // a direct link (not just a sidebar click) always keeps state in sync.
  }, [pathname]);

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
