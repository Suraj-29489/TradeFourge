"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAccounts } from "@/context/AccountsContext";
import type { TradingAccount } from "@/types/database";

interface ActiveAccountContextType {
  activeAccount: TradingAccount | null;
  activeAccountId: string | null;
  setActiveAccountId: (id: string) => void;
  workspaceMode: "csv" | "mt5" | "none";
  setWorkspaceMode: (mode: "csv" | "mt5" | "none") => void;
  isAccountTypeModalOpen: boolean;
  openAccountTypeModal: () => void;
  closeAccountTypeModal: () => void;
  selectAccountType: (type: "csv" | "mt5") => void;
}

const STORAGE_ACTIVE_ACC_KEY = "tf_active_csv_account_id";
const STORAGE_WORKSPACE_MODE_KEY = "tf_workspace_mode";

const ActiveAccountContext = createContext<ActiveAccountContextType>({
  activeAccount: null,
  activeAccountId: null,
  setActiveAccountId: () => {},
  workspaceMode: "csv",
  setWorkspaceMode: () => {},
  isAccountTypeModalOpen: false,
  openAccountTypeModal: () => {},
  closeAccountTypeModal: () => {},
  selectAccountType: () => {},
});

export const ActiveAccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts, selectedAccountIds, setSelectedAccountIds } = useAccounts();
  const [activeAccountIdState, setActiveAccountIdState] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceModeState] = useState<"csv" | "mt5" | "none">("csv");
  const [isAccountTypeModalOpen, setIsAccountTypeModalOpen] = useState(false);

  // Restore workspace mode & active account from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedMode = localStorage.getItem(STORAGE_WORKSPACE_MODE_KEY) as "csv" | "mt5" | "none" | null;
    if (savedMode) {
      setWorkspaceModeState(savedMode);
    }
    const savedAccId = localStorage.getItem(STORAGE_ACTIVE_ACC_KEY);
    if (savedAccId) {
      setActiveAccountIdState(savedAccId);
    }
  }, []);

  // Sync active account with available accounts
  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      setActiveAccountIdState(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_ACTIVE_ACC_KEY);
      }
      return;
    }

    // Check if current activeAccountId still exists in accounts
    const exists = accounts.some((a) => a.id === activeAccountIdState);
    if (!exists) {
      // Pick first available account
      const firstAcc = accounts[0];
      setActiveAccountIdState(firstAcc.id);
      setSelectedAccountIds([firstAcc.id]);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_ACTIVE_ACC_KEY, firstAcc.id);
      }
    } else if (activeAccountIdState) {
      // Sync selectedAccountIds in AccountsContext if needed
      if (selectedAccountIds.length !== 1 || selectedAccountIds[0] !== activeAccountIdState) {
        setSelectedAccountIds([activeAccountIdState]);
      }
    }
  }, [accounts, activeAccountIdState, selectedAccountIds, setSelectedAccountIds]);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    setSelectedAccountIds([id]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_ACTIVE_ACC_KEY, id);
    }
  }, [setSelectedAccountIds]);

  const setWorkspaceMode = useCallback((mode: "csv" | "mt5" | "none") => {
    setWorkspaceModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, mode);
    }
  }, []);

  const openAccountTypeModal = useCallback(() => setIsAccountTypeModalOpen(true), []);
  const closeAccountTypeModal = useCallback(() => setIsAccountTypeModalOpen(false), []);

  const selectAccountType = useCallback((type: "csv" | "mt5") => {
    if (type === "csv") {
      setWorkspaceMode("csv");
      setIsAccountTypeModalOpen(false);
    }
  }, [setWorkspaceMode]);

  const activeAccount = accounts.find((a) => a.id === activeAccountIdState) ?? accounts[0] ?? null;

  return (
    <ActiveAccountContext.Provider
      value={{
        activeAccount,
        activeAccountId: activeAccount?.id ?? activeAccountIdState,
        setActiveAccountId,
        workspaceMode,
        setWorkspaceMode,
        isAccountTypeModalOpen,
        openAccountTypeModal,
        closeAccountTypeModal,
        selectAccountType,
      }}
    >
      {children}
    </ActiveAccountContext.Provider>
  );
};

export const useActiveAccount = () => useContext(ActiveAccountContext);
