"use client";
// context/AccountsContext.tsx
// TradeFourge v3.6.0 Dedicated Accounts Context.
// Responsible ONLY for Trading Accounts collection, Selected Account IDs, and Account CRUD.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchTradingAccounts, createTradingAccount } from "@/lib/supabase/accounts";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { useAppEventListener } from "@/lib/events/event-bus";
import type { TradingAccount, NewTradingAccount } from "@/types/database";

interface AccountsContextType {
  accounts: TradingAccount[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;
  loadingAccounts: boolean;
  refreshAccounts: () => Promise<void>;
  addNewAccount: (payload: NewTradingAccount) => Promise<TradingAccount | null>;
}

const AccountsContext = createContext<AccountsContextType>({
  accounts: [],
  selectedAccountIds: ["ALL"],
  setSelectedAccountIds: () => {},
  loadingAccounts: true,
  refreshAccounts: async () => {},
  addNewAccount: async () => null,
});

function getSelectionStorageKey(userId: string): string {
  return `tf_selected_accounts_${userId || "default_user"}`;
}

export function loadSelectedAccountsFromStorage(userId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getSelectionStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSelectedAccountsToStorage(userId: string, selectedIds: string[]): void {
  if (typeof window === "undefined") return;
  const key = getSelectionStorageKey(userId);
  try {
    const serialized = JSON.stringify(selectedIds);
    if (localStorage.getItem(key) === serialized) return;
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.error(`Failed to save selected accounts (${key}):`, err);
  }
}

export const AccountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIdsState] = useState<string[]>(["ALL"]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const userIdRef = useRef<string | null>(null);
  const supabase = createClient();

  const setSelectedAccountIds = useCallback((ids: string[], targetUid?: string) => {
    setSelectedAccountIdsState(ids);
    const store = useJournalStore.getState();
    store.setFilters((prev) => ({
      ...prev,
      accountIds: ids,
      accountId: ids.length === 1 ? ids[0] : "ALL",
    }));

    const uid = targetUid || userIdRef.current;
    if (uid) {
      saveSelectedAccountsToStorage(uid, ids);
    }
  }, []);

  const loadAccounts = useCallback(async (userId: string) => {
    try {
      const { data } = await fetchTradingAccounts(userId);
      const loaded = data ?? [];
      setAccounts(loaded);

      if (loaded.length === 1) {
        setSelectedAccountIds([loaded[0].id], userId);
      } else if (loaded.length > 1) {
        const saved = loadSelectedAccountsFromStorage(userId);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          const validSaved = saved.includes("ALL")
            ? ["ALL"]
            : saved.filter((id) => loaded.some((a) => a.id === id));
          setSelectedAccountIds(validSaved.length > 0 ? validSaved : ["ALL"], userId);
        } else {
          setSelectedAccountIds(["ALL"], userId);
        }
      } else {
        setSelectedAccountIds([], userId);
      }
    } catch (err) {
      console.error("[AccountsProvider] Failed to load trading accounts:", err);
      setAccounts([]);
      setSelectedAccountIds([], userId);
    } finally {
      setLoadingAccounts(false);
    }
  }, [setSelectedAccountIds]);

  useEffect(() => {
    let isMounted = true;

    async function initAccounts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (user) {
        userIdRef.current = user.id;
        await loadAccounts(user.id);
      } else {
        userIdRef.current = null;
        setAccounts([]);
        setSelectedAccountIdsState([]);
        setLoadingAccounts(false);
      }
    }

    initAccounts();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!isMounted) return;
      if (session?.user) {
        if (session.user.id !== userIdRef.current) {
          userIdRef.current = session.user.id;
          loadAccounts(session.user.id);
        }
      } else {
        userIdRef.current = null;
        setAccounts([]);
        setSelectedAccountIdsState([]);
        setLoadingAccounts(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadAccounts]);

  const refreshAccounts = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid) {
      await loadAccounts(uid);
    }
  }, [loadAccounts]);

  const addNewAccount = async (payload: NewTradingAccount): Promise<TradingAccount | null> => {
    let targetUserId = userIdRef.current;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (!targetUserId) return null;
    const { data, error } = await createTradingAccount(targetUserId, payload);
    if (data) {
      await loadAccounts(targetUserId);
      return data;
    }
    if (error) console.error("[AccountsProvider] addNewAccount error:", error);
    return null;
  };

  useAppEventListener(
    ["tradefourge:account-created", "tradefourge:account-updated", "tradefourge:account-deleted"],
    () => {
      refreshAccounts();
    }
  );

  return (
    <AccountsContext.Provider
      value={{
        accounts,
        selectedAccountIds,
        setSelectedAccountIds: (ids: string[]) => setSelectedAccountIds(ids, userIdRef.current || undefined),
        loadingAccounts,
        refreshAccounts,
        addNewAccount,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
};

export const useAccounts = () => useContext(AccountsContext);
