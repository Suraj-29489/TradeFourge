import { create } from "zustand";
import { Journal, NormalizedTrade, AccountType, BrokerType } from "@/lib/engine/types";
import { validateAndParseCsv } from "@/lib/engine/validator";
import { tradeFingerprint } from "@/lib/engine/normalizer";
import { UserSettings, FilterOptions, ColumnVisibility } from "@/types/trade";
import { DisplayCurrency, saveCurrencyToStorage, loadCurrencyFromStorage } from "@/lib/config/currency";
import { INITIAL_NORMALIZED_TRADES } from "@/lib/sample-data";
import {
  saveJournals,
  loadJournals,
  saveSelectedJournalIds,
  loadSelectedJournalIds,
  saveSettingsToStorage,
  loadSettingsFromStorage,
  saveTheme,
  loadTheme,
  clearAllStorage,
} from "@/lib/storage/db";

/* ─── Defaults ─────────────────────────────────────────────────────────────── */

const DEFAULT_SETTINGS: UserSettings = {
  currency: "USD",
  timezone: "UTC+0",
  dateFormat: "YYYY-MM-DD",
  theme: "dark",
  initialBalance: 0,
  sidebarCollapsed: false,
  accountBalance: null,
};

const DEFAULT_FILTERS: FilterOptions = {
  search: "",
  symbol: "ALL",
  direction: "ALL",
  status: "ALL",
  dateRange: "ALL",
};

const DEFAULT_COLUMNS: ColumnVisibility = {
  date: true,
  time: false,
  ticket: false,
  symbol: true,
  direction: true,
  lot: true,
  entry: true,
  exit: true,
  pnl: true,
  commission: true,
  swap: true,
  rr: true,
  status: true,
};

/* ─── Import Result ────────────────────────────────────────────────────────── */

export interface ImportResult {
  success: boolean;
  warning: string | null;
  count: number;
  duplicatesSkipped: number;
  journalId: string | null;
}

/* ─── Store Interface ──────────────────────────────────────────────────────── */

interface JournalStoreState {
  // ── Core Data ──────────────────────────────────────────────────────────────
  journals: Journal[];
  selectedJournalIds: string[];

  // ── Derived (updated whenever selection changes) ────────────────────────────
  accountType: AccountType;
  accountBalance: number | null;
  broker: BrokerType;
  warningMessage: string | null;

  // ── UI State ───────────────────────────────────────────────────────────────
  displayCurrency: DisplayCurrency;
  theme: "dark" | "light";
  filters: FilterOptions;
  columnVisibility: ColumnVisibility;
  settings: UserSettings;
  isInitialized: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  init: () => Promise<void>;
  loadDemoJournal: () => Promise<void>;
  importCsvText: (csvText: string, filename: string) => Promise<ImportResult>;

  // Journal CRUD
  deleteJournal: (id: string) => Promise<void>;
  renameJournal: (id: string, name: string) => Promise<void>;
  combineJournals: (ids: string[], combinedName: string) => Promise<void>;

  // Selection
  selectJournals: (ids: string[]) => Promise<void>;
  toggleJournal: (id: string) => Promise<void>;
  selectLatest: () => Promise<void>;
  selectAll: () => Promise<void>;
  clearSelection: () => Promise<void>;

  // Trade-level
  deleteTrade: (journalId: string, ticket: string) => Promise<void>;

  // Settings
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setTheme: (theme: "dark" | "light") => void;
  setFilters: (updater: FilterOptions | ((prev: FilterOptions) => FilterOptions)) => void;
  setColumnVisibility: (cols: Partial<ColumnVisibility>) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Misc
  clearAll: () => Promise<void>;

  // ── Legacy shims (used by components not yet migrated) ─────────────────────
  /** @deprecated Use journals + selectedJournalIds instead */
  selectedAccount: string;
  /** @deprecated */
  setSelectedAccount: (account: string) => void;
}

/* ─── Helper: derive meta from selected journals ───────────────────────────── */

function deriveFromSelected(
  journals: Journal[],
  selectedIds: string[]
): { accountType: AccountType; accountBalance: number | null; broker: BrokerType } {
  if (selectedIds.length === 0 || journals.length === 0) {
    return { accountType: "Pro", accountBalance: null, broker: "Exness" };
  }
  const selected = journals.filter(j => selectedIds.includes(j.id));
  if (selected.length === 0) return { accountType: "Pro", accountBalance: null, broker: "Exness" };

  // Use the most recently uploaded selected journal for these values
  const latest = selected.reduce((a, b) =>
    new Date(a.uploadDate) > new Date(b.uploadDate) ? a : b
  );
  return {
    accountType: latest.accountType,
    accountBalance: latest.lastKnownBalance,
    broker: latest.broker,
  };
}

/* ─── Duplicate detection across all journals ──────────────────────────────── */

function getAllFingerprints(journals: Journal[]): Set<string> {
  const set = new Set<string>();
  journals.forEach(j => {
    j.trades.forEach(t => set.add(tradeFingerprint(t)));
  });
  return set;
}

/* ─── Store ────────────────────────────────────────────────────────────────── */

export const useJournalStore = create<JournalStoreState>((set, get) => ({
  journals: [],
  selectedJournalIds: [],
  accountType: "Pro",
  accountBalance: null,
  broker: "Exness",
  warningMessage: null,
  displayCurrency: "USD",
  theme: "dark",
  filters: DEFAULT_FILTERS,
  columnVisibility: DEFAULT_COLUMNS,
  settings: DEFAULT_SETTINGS,
  isInitialized: false,
  selectedAccount: "Primary Account",

  /* ── Init ──────────────────────────────────────────────────────────────── */
  init: async () => {
    if (get().isInitialized) return;

    const [journals, selectedIds, settings, savedTheme] = await Promise.all([
      loadJournals(),
      loadSelectedJournalIds(),
      loadSettingsFromStorage(),
      Promise.resolve(typeof window !== "undefined" ? loadTheme() : "dark"),
    ]);

    const savedCurrency = loadCurrencyFromStorage();
    const activeSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;

    // If no selection saved, auto-select the most recently uploaded journal
    let effectiveIds = selectedIds;
    if (effectiveIds.length === 0 && journals.length > 0) {
      const latest = journals.reduce((a, b) =>
        new Date(a.uploadDate) > new Date(b.uploadDate) ? a : b
      );
      effectiveIds = [latest.id];
    }

    // Filter to only IDs that still exist
    const validIds = effectiveIds.filter(id => journals.some(j => j.id === id));

    const derived = deriveFromSelected(journals, validIds);

    // Apply stored theme to document
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", savedTheme as string);
    }

    set({
      journals,
      selectedJournalIds: validIds,
      settings: activeSettings,
      displayCurrency: savedCurrency,
      theme: savedTheme,
      isInitialized: true,
      ...derived,
    });
  },

  /* ── Demo Journal ──────────────────────────────────────────────────────── */
  loadDemoJournal: async () => {
    const trades = INITIAL_NORMALIZED_TRADES.map(t => ({ ...t, journalId: "demo" }));
    const sorted = [...trades].sort((a, b) =>
      new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime()
    );

    const demoJournal: Journal = {
      id: "demo",
      filename: "Exness_Position_History_DEMO.csv",
      displayName: "Demo Journal",
      uploadDate: new Date().toISOString(),
      accountName: "Demo Account",
      trades,
      tradeCount: trades.length,
      broker: "Exness",
      accountType: "Pro",
      isCentAccount: false,
      lastKnownBalance: null,
      dateFrom: sorted[0]?.closeTime ?? null,
      dateTo: sorted[sorted.length - 1]?.closeTime ?? null,
    };

    const existing = get().journals.filter(j => j.id !== "demo");
    const updated = [demoJournal, ...existing];
    await saveJournals(updated);
    await saveSelectedJournalIds(["demo"]);

    const derived = deriveFromSelected(updated, ["demo"]);
    set({ journals: updated, selectedJournalIds: ["demo"], warningMessage: null, ...derived });
  },

  /* ── Import CSV ─────────────────────────────────────────────────────────── */
  importCsvText: async (csvText: string, filename: string): Promise<ImportResult> => {
    const parseRes = validateAndParseCsv(csvText, filename.replace(/\.[^.]+$/, ""));

    if (!parseRes.success || parseRes.trades.length === 0) {
      return {
        success: false,
        warning: parseRes.errors.join("; ") || "Failed to parse CSV file",
        count: 0,
        duplicatesSkipped: 0,
        journalId: null,
      };
    }

    // Duplicate detection across all existing journals
    const existingFingerprints = getAllFingerprints(get().journals);
    const newTrades: NormalizedTrade[] = [];
    let duplicatesSkipped = 0;

    const journalId = `journal-${Date.now()}`;

    for (const t of parseRes.trades) {
      const fp = tradeFingerprint(t);
      if (existingFingerprints.has(fp)) {
        duplicatesSkipped++;
      } else {
        newTrades.push({ ...t, journalId });
      }
    }

    if (newTrades.length === 0) {
      return {
        success: false,
        warning: `All ${parseRes.trades.length} trades already exist in another journal (duplicates skipped).`,
        count: 0,
        duplicatesSkipped,
        journalId: null,
      };
    }

    // Compute date range
    const sortedByClose = [...newTrades].sort((a, b) =>
      new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime()
    );

    const journal: Journal = {
      id: journalId,
      filename,
      displayName: filename,
      uploadDate: new Date().toISOString(),
      accountName: newTrades[0]?.accountName || filename,
      trades: newTrades,
      tradeCount: newTrades.length,
      broker: parseRes.broker,
      accountType: parseRes.accountType,
      isCentAccount: parseRes.isCentAccount,
      lastKnownBalance: parseRes.lastKnownBalance,
      dateFrom: sortedByClose[0]?.closeTime ?? null,
      dateTo: sortedByClose[sortedByClose.length - 1]?.closeTime ?? null,
    };

    const updatedJournals = [journal, ...get().journals];
    const selectedIds = [journalId]; // Auto-select ONLY the new journal

    await saveJournals(updatedJournals);
    await saveSelectedJournalIds(selectedIds);

    const derived = deriveFromSelected(updatedJournals, selectedIds);

    set({
      journals: updatedJournals,
      selectedJournalIds: selectedIds,
      warningMessage: parseRes.warningMessage,
      ...derived,
    });

    return {
      success: true,
      warning: parseRes.warningMessage,
      count: newTrades.length,
      duplicatesSkipped,
      journalId,
    };
  },

  /* ── Delete Journal ─────────────────────────────────────────────────────── */
  deleteJournal: async (id: string) => {
    const updated = get().journals.filter(j => j.id !== id);
    const updatedIds = get().selectedJournalIds.filter(sid => sid !== id);

    // Auto-select latest if selection is now empty
    let finalIds = updatedIds;
    if (finalIds.length === 0 && updated.length > 0) {
      const latest = updated.reduce((a, b) =>
        new Date(a.uploadDate) > new Date(b.uploadDate) ? a : b
      );
      finalIds = [latest.id];
    }

    await saveJournals(updated);
    await saveSelectedJournalIds(finalIds);
    const derived = deriveFromSelected(updated, finalIds);
    set({ journals: updated, selectedJournalIds: finalIds, ...derived });
  },

  /* ── Rename Journal ─────────────────────────────────────────────────────── */
  renameJournal: async (id: string, name: string) => {
    const updated = get().journals.map(j =>
      j.id === id ? { ...j, displayName: name } : j
    );
    await saveJournals(updated);
    set({ journals: updated });
  },

  /* ── Combine Journals ───────────────────────────────────────────────────── */
  combineJournals: async (ids: string[], combinedName: string) => {
    const toCombine = get().journals.filter(j => ids.includes(j.id));
    const rest      = get().journals.filter(j => !ids.includes(j.id));

    if (toCombine.length < 2) return;

    const combinedId = `combined-${Date.now()}`;
    const allTrades  = toCombine.flatMap(j => j.trades).map(t => ({ ...t, journalId: combinedId }));
    const sorted     = [...allTrades].sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());

    const combined: Journal = {
      id: combinedId,
      filename: combinedName,
      displayName: combinedName,
      uploadDate: new Date().toISOString(),
      accountName: toCombine[0].accountName,
      trades: allTrades,
      tradeCount: allTrades.length,
      broker: toCombine[0].broker,
      accountType: toCombine[0].accountType,
      isCentAccount: toCombine.some(j => j.isCentAccount),
      lastKnownBalance: toCombine[toCombine.length - 1].lastKnownBalance,
      dateFrom: sorted[0]?.closeTime ?? null,
      dateTo: sorted[sorted.length - 1]?.closeTime ?? null,
    };

    const updated = [combined, ...rest];
    const selectedIds = [combinedId];
    await saveJournals(updated);
    await saveSelectedJournalIds(selectedIds);
    const derived = deriveFromSelected(updated, selectedIds);
    set({ journals: updated, selectedJournalIds: selectedIds, ...derived });
  },

  /* ── Selection ──────────────────────────────────────────────────────────── */
  selectJournals: async (ids: string[]) => {
    const validIds = ids.filter(id => get().journals.some(j => j.id === id));
    await saveSelectedJournalIds(validIds);
    const derived = deriveFromSelected(get().journals, validIds);
    set({ selectedJournalIds: validIds, ...derived });
  },

  toggleJournal: async (id: string) => {
    const current = get().selectedJournalIds;
    const updated = current.includes(id)
      ? current.filter(sid => sid !== id)
      : [...current, id];
    await saveSelectedJournalIds(updated);
    const derived = deriveFromSelected(get().journals, updated);
    set({ selectedJournalIds: updated, ...derived });
  },

  selectLatest: async () => {
    const { journals } = get();
    if (journals.length === 0) return;
    const latest = journals.reduce((a, b) =>
      new Date(a.uploadDate) > new Date(b.uploadDate) ? a : b
    );
    await saveSelectedJournalIds([latest.id]);
    const derived = deriveFromSelected(journals, [latest.id]);
    set({ selectedJournalIds: [latest.id], ...derived });
  },

  selectAll: async () => {
    const ids = get().journals.map(j => j.id);
    await saveSelectedJournalIds(ids);
    const derived = deriveFromSelected(get().journals, ids);
    set({ selectedJournalIds: ids, ...derived });
  },

  clearSelection: async () => {
    await saveSelectedJournalIds([]);
    set({ selectedJournalIds: [], accountType: "Pro", accountBalance: null, broker: "Exness" });
  },

  /* ── Delete Trade ───────────────────────────────────────────────────────── */
  deleteTrade: async (journalId: string, ticket: string) => {
    const updated = get().journals.map(j =>
      j.id === journalId
        ? { ...j, trades: j.trades.filter(t => t.ticket !== ticket), tradeCount: j.trades.filter(t => t.ticket !== ticket).length }
        : j
    );
    await saveJournals(updated);
    set({ journals: updated });
  },

  /* ── Currency ───────────────────────────────────────────────────────────── */
  setDisplayCurrency: (currency: DisplayCurrency) => {
    saveCurrencyToStorage(currency);
    set({ displayCurrency: currency });
  },

  /* ── Theme ──────────────────────────────────────────────────────────────── */
  setTheme: (theme: "dark" | "light") => {
    saveTheme(theme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    set({ theme, settings: { ...get().settings, theme } });
  },

  /* ── Filters ────────────────────────────────────────────────────────────── */
  setFilters: (updater) => {
    set(state => ({
      filters: typeof updater === "function" ? updater(state.filters) : updater,
    }));
  },

  /* ── Column Visibility ──────────────────────────────────────────────────── */
  setColumnVisibility: (cols) => {
    set(state => ({
      columnVisibility: { ...state.columnVisibility, ...cols },
    }));
  },

  /* ── Settings ───────────────────────────────────────────────────────────── */
  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    saveSettingsToStorage(updated);
    set({ settings: updated });
  },

  /* ── Clear All ──────────────────────────────────────────────────────────── */
  clearAll: async () => {
    await clearAllStorage();
    set({
      journals: [],
      selectedJournalIds: [],
      accountType: "Pro",
      accountBalance: null,
      broker: "Exness",
      warningMessage: null,
      settings: DEFAULT_SETTINGS,
    });
  },

  /* ── Legacy Shims ────────────────────────────────────────────────────────── */
  setSelectedAccount: (account: string) => set({ selectedAccount: account }),
}));
