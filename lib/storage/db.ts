import { get, set, del } from "idb-keyval";
import { NormalizedTrade } from "@/lib/engine/types";
import { JournalHistoryItem, UserSettings } from "@/types/trade";

const KEYS = {
  TRADES: "trading_journal_normalized_trades_v2",
  JOURNALS: "trading_journal_history_v2",
  SETTINGS: "trading_journal_settings_v2",
};

export async function saveTradesToStorage(trades: NormalizedTrade[]): Promise<void> {
  try {
    await set(KEYS.TRADES, trades);
  } catch (err) {
    console.warn("IndexedDB write failed, falling back to localStorage", err);
    localStorage.setItem(KEYS.TRADES, JSON.stringify(trades));
  }
}

export async function loadTradesFromStorage(): Promise<NormalizedTrade[]> {
  try {
    const data = await get<NormalizedTrade[]>(KEYS.TRADES);
    if (data && Array.isArray(data)) return data;

    const local = localStorage.getItem(KEYS.TRADES);
    if (local) return JSON.parse(local);

    return [];
  } catch (err) {
    console.error("Failed loading trades from storage", err);
    return [];
  }
}

export async function saveJournalsHistory(history: JournalHistoryItem[]): Promise<void> {
  try {
    await set(KEYS.JOURNALS, history);
  } catch (err) {
    localStorage.setItem(KEYS.JOURNALS, JSON.stringify(history));
  }
}

export async function loadJournalsHistory(): Promise<JournalHistoryItem[]> {
  try {
    const data = await get<JournalHistoryItem[]>(KEYS.JOURNALS);
    if (data) return data;
    const local = localStorage.getItem(KEYS.JOURNALS);
    if (local) return JSON.parse(local);
    return [];
  } catch (err) {
    return [];
  }
}

export async function saveSettingsToStorage(settings: UserSettings): Promise<void> {
  try {
    await set(KEYS.SETTINGS, settings);
  } catch (err) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }
}

export async function loadSettingsFromStorage(): Promise<UserSettings | null> {
  try {
    const data = await get<UserSettings>(KEYS.SETTINGS);
    if (data) return data;
    const local = localStorage.getItem(KEYS.SETTINGS);
    if (local) return JSON.parse(local);
    return null;
  } catch (err) {
    return null;
  }
}

export async function clearAllJournalStorage(): Promise<void> {
  try {
    await del(KEYS.TRADES);
    await del(KEYS.JOURNALS);
    localStorage.removeItem(KEYS.TRADES);
    localStorage.removeItem(KEYS.JOURNALS);
  } catch (err) {
    console.error("Error clearing storage", err);
  }
}
