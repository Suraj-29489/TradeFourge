import { create } from "zustand";
import {
  NormalizedTrade,
  AccountType,
  BrokerType,
} from "@/lib/engine/types";
import { validateAndParseCsv } from "@/lib/engine/validator";
import { JournalHistoryItem, UserSettings, FilterOptions, ColumnVisibility } from "@/types/trade";
import { DisplayCurrency, saveCurrencyToStorage, loadCurrencyFromStorage } from "@/lib/config/currency";
import { INITIAL_NORMALIZED_TRADES } from "@/lib/sample-data";
import {
  loadTradesFromStorage,
  saveTradesToStorage,
  loadJournalsHistory,
  saveJournalsHistory,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  clearAllJournalStorage,
} from "@/lib/storage/db";

const DEFAULT_SETTINGS: UserSettings = {
  currency: "USD",
  timezone: "UTC+0",
  dateFormat: "YYYY-MM-DD",
  theme: "dark",
  initialBalance: 10000,
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

interface JournalStoreState {
  trades: NormalizedTrade[];
  history: JournalHistoryItem[];
  selectedAccount: string;
  accountType: AccountType;
  currency: "USD"; // raw trade currency — always USD from Exness
  displayCurrency: DisplayCurrency; // user-selected display currency
  accountBalance: number | null; // last equity from CSV, null if unavailable
  broker: BrokerType;
  filters: FilterOptions;
  columnVisibility: ColumnVisibility;
  settings: UserSettings;
  isInitialized: boolean;
  warningMessage: string | null;

  // Actions
  init: () => Promise<void>;
  loadDemoJournal: () => Promise<void>;
  importCsvText: (csvText: string, filename: string) => Promise<{ success: boolean; warning: string | null; count: number }>;
  clearJournal: () => Promise<void>;
  deleteTrade: (ticket: string) => Promise<void>;
  setSelectedAccount: (account: string) => void;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  setFilters: (updater: FilterOptions | ((prev: FilterOptions) => FilterOptions)) => void;
  setColumnVisibility: (cols: Partial<ColumnVisibility>) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const useJournalStore = create<JournalStoreState>((set, get) => ({
  trades: [],
  history: [],
  selectedAccount: "Primary Exness Account",
  accountType: "Pro",
  currency: "USD",
  displayCurrency: "USD",
  accountBalance: null,
  broker: "Exness",
  filters: DEFAULT_FILTERS,
  columnVisibility: DEFAULT_COLUMNS,
  settings: DEFAULT_SETTINGS,
  isInitialized: false,
  warningMessage: null,

  init: async () => {
    if (get().isInitialized) return;

    const storedTrades = await loadTradesFromStorage();
    const storedHistory = await loadJournalsHistory();
    const storedSettings = await loadSettingsFromStorage();
    const savedCurrency = loadCurrencyFromStorage();

    const activeSettings = storedSettings
      ? { ...DEFAULT_SETTINGS, ...storedSettings }
      : DEFAULT_SETTINGS;

    let detectedAccountType: AccountType = "Pro";
    let detectedBroker: BrokerType = "Exness";

    if (storedTrades.length > 0) {
      if (storedTrades[0].accountType) detectedAccountType = storedTrades[0].accountType;
      if (storedTrades[0].broker) detectedBroker = storedTrades[0].broker;
    }

    set({
      trades: storedTrades,
      history: storedHistory,
      settings: activeSettings,
      currency: "USD",
      displayCurrency: savedCurrency,
      accountType: detectedAccountType,
      broker: detectedBroker,
      accountBalance: activeSettings.accountBalance ?? null,
      isInitialized: true,
    });
  },

  loadDemoJournal: async () => {
    await saveTradesToStorage(INITIAL_NORMALIZED_TRADES);

    const demoHistoryItem: JournalHistoryItem = {
      id: `demo-${Date.now()}`,
      filename: "Exness_Position_History.csv",
      uploadDate: new Date().toISOString(),
      tradeCount: INITIAL_NORMALIZED_TRADES.length,
      broker: "Exness",
      currency: "USD",
      accountType: "Pro",
      accountName: "Primary Exness Account",
    };

    await saveJournalsHistory([demoHistoryItem]);

    set({
      trades: INITIAL_NORMALIZED_TRADES,
      history: [demoHistoryItem],
      currency: "USD",
      accountType: "Pro",
      broker: "Exness",
      selectedAccount: "Primary Exness Account",
      accountBalance: null,
      warningMessage: null,
    });
  },

  importCsvText: async (csvText: string, filename: string) => {
    const parseRes = validateAndParseCsv(csvText, get().selectedAccount);

    if (!parseRes.success || parseRes.trades.length === 0) {
      return {
        success: false,
        warning: parseRes.errors.join("; ") || "Failed to parse CSV file",
        count: 0,
      };
    }

    const updatedTrades = [...parseRes.trades, ...get().trades];

    const historyItem: JournalHistoryItem = {
      id: `hist-${Date.now()}`,
      filename,
      uploadDate: new Date().toISOString(),
      tradeCount: parseRes.trades.length,
      broker: parseRes.broker,
      currency: "USD",
      accountType: parseRes.accountType,
      accountName: parseRes.trades[0]?.accountName || "Primary Account",
    };

    const updatedHistory = [historyItem, ...get().history];

    // Persist lastKnownBalance into settings so it survives page refreshes
    const newSettings = {
      ...get().settings,
      accountBalance: parseRes.lastKnownBalance,
    };

    await saveTradesToStorage(updatedTrades);
    await saveJournalsHistory(updatedHistory);
    await saveSettingsToStorage(newSettings);

    set({
      trades: updatedTrades,
      history: updatedHistory,
      currency: "USD",
      accountType: parseRes.accountType,
      broker: parseRes.broker,
      selectedAccount: historyItem.accountName,
      accountBalance: parseRes.lastKnownBalance,
      settings: newSettings,
      warningMessage: parseRes.warningMessage,
    });

    return {
      success: true,
      warning: parseRes.warningMessage,
      count: parseRes.trades.length,
    };
  },

  clearJournal: async () => {
    await clearAllJournalStorage();
    const newSettings = { ...get().settings, accountBalance: null };
    await saveSettingsToStorage(newSettings);
    set({
      trades: [],
      history: [],
      selectedAccount: "Primary Exness Account",
      currency: "USD",
      accountType: "Pro",
      broker: "Exness",
      accountBalance: null,
      settings: newSettings,
      warningMessage: null,
    });
  },

  deleteTrade: async (ticket: string) => {
    const updated = get().trades.filter((t) => t.ticket !== ticket);
    await saveTradesToStorage(updated);
    set({ trades: updated });
  },

  setSelectedAccount: (account: string) => set({ selectedAccount: account }),

  setDisplayCurrency: (currency: DisplayCurrency) => {
    saveCurrencyToStorage(currency);
    set({ displayCurrency: currency });
  },

  setFilters: (updater) => {
    set((state) => ({
      filters: typeof updater === "function" ? updater(state.filters) : updater,
    }));
  },

  setColumnVisibility: (cols) => {
    set((state) => ({
      columnVisibility: { ...state.columnVisibility, ...cols },
    }));
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    saveSettingsToStorage(updated);
    set({ settings: updated });
  },
}));
