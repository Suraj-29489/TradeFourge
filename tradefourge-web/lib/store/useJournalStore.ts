"use client";
// lib/store/useJournalStore.ts
//
// Phase 3.0 Refactor: Zustand now handles ONLY ephemeral UI state.
// ─────────────────────────────────────────────────────────────────
// ✅ KEPT:  filters, columnVisibility, displayCurrency, theme, isInitialized
// ❌ REMOVED: journals[], selectedJournalIds, accountBalance, broker
//            and all IndexedDB persistence for trading data.
//
// Persistent trading data (accounts, trades) lives exclusively in Supabase.
// The CSV parse engine (Phase 3.1) will write directly to Supabase.

import { create } from "zustand";
import { CloudTradeFilters, DEFAULT_CLOUD_FILTERS } from "@/types/database";
import { DisplayCurrency, saveCurrencyToStorage, loadCurrencyFromStorage } from "@/lib/config/currency";
import {
  saveTheme,
  loadTheme,
  saveSettingsToStorage,
  loadSettingsFromStorage,
} from "@/lib/storage/db";

// ─── Column Visibility ────────────────────────────────────────────────────────

export interface ColumnVisibility {
  date: boolean;
  time: boolean;
  ticket: boolean;
  symbol: boolean;
  side: boolean;
  volume: boolean;
  open_price: boolean;
  close_price: boolean;
  net_profit: boolean;
  commission: boolean;
  swap: boolean;
  rr_ratio: boolean;
  outcome: boolean;
  duration: boolean;
  account: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  date: true,
  time: false,
  ticket: false,
  symbol: true,
  side: true,
  volume: true,
  open_price: true,
  close_price: true,
  net_profit: true,
  commission: true,
  swap: true,
  rr_ratio: true,
  outcome: true,
  duration: false,
  account: false,
};

// ─── UI Settings (lightweight, not sync'd to Supabase) ────────────────────────

export interface UISettings {
  currency: DisplayCurrency;
  timezone: string;
  dateFormat: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
  theme: "dark" | "light";
  initialBalance: number;
}

const DEFAULT_UI_SETTINGS: UISettings = {
  currency: "USD",
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
  theme: "dark",
  initialBalance: 0,
};

// ─── Store Interface ──────────────────────────────────────────────────────────

interface JournalStoreState {
  // ── Ephemeral UI State ─────────────────────────────────────────────────────
  displayCurrency: DisplayCurrency;
  theme: "dark" | "light";
  filters: CloudTradeFilters;
  columnVisibility: ColumnVisibility;
  settings: UISettings;
  isInitialized: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  init: () => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setTheme: (theme: "dark" | "light") => void;
  setFilters: (updater: CloudTradeFilters | ((prev: CloudTradeFilters) => CloudTradeFilters)) => void;
  resetFilters: () => void;
  setColumnVisibility: (cols: Partial<ColumnVisibility>) => void;
  resetColumnVisibility: () => void;
  updateSettings: (updates: Partial<UISettings>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useJournalStore = create<JournalStoreState>((set, get) => ({
  displayCurrency: "USD",
  theme: "dark",
  filters: DEFAULT_CLOUD_FILTERS,
  columnVisibility: DEFAULT_COLUMN_VISIBILITY,
  settings: DEFAULT_UI_SETTINGS,
  isInitialized: false,

  /* ── Init ─────────────────────────────────────────────────────────────── */
  init: () => {
    if (get().isInitialized) return;
    if (typeof window === "undefined") return;

    const savedCurrency = loadCurrencyFromStorage();
    const savedTheme = loadTheme();
    const savedSettings = loadSettingsFromStorage();

    // Apply theme to document immediately
    document.documentElement.setAttribute("data-theme", savedTheme);

    set({
      displayCurrency: savedCurrency,
      theme: savedTheme,
      settings: savedSettings
        ? {
            ...DEFAULT_UI_SETTINGS,
            ...(savedSettings as Partial<UISettings>),
            theme: savedTheme,
          }
        : { ...DEFAULT_UI_SETTINGS, theme: savedTheme },
      isInitialized: true,
    });
  },

  /* ── Currency ─────────────────────────────────────────────────────────── */
  setDisplayCurrency: (currency) => {
    saveCurrencyToStorage(currency);
    set({ displayCurrency: currency });
  },

  /* ── Theme ────────────────────────────────────────────────────────────── */
  setTheme: (theme) => {
    saveTheme(theme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    set({ theme, settings: { ...get().settings, theme } });
  },

  /* ── Filters ──────────────────────────────────────────────────────────── */
  setFilters: (updater) => {
    set((state) => ({
      filters:
        typeof updater === "function" ? updater(state.filters) : updater,
    }));
  },

  resetFilters: () => set({ filters: DEFAULT_CLOUD_FILTERS }),

  /* ── Column Visibility ────────────────────────────────────────────────── */
  setColumnVisibility: (cols) => {
    set((state) => ({
      columnVisibility: { ...state.columnVisibility, ...cols },
    }));
  },

  resetColumnVisibility: () => set({ columnVisibility: DEFAULT_COLUMN_VISIBILITY }),

  /* ── Settings ─────────────────────────────────────────────────────────── */
  updateSettings: (updates) => {
    const updated = { ...get().settings, ...updates };
    // Only persist non-sensitive UI settings locally
    saveSettingsToStorage(updated as never);
    set({ settings: updated });
  },
}));
