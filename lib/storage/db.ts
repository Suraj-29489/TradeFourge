import { get, set, del } from "idb-keyval";
import { NormalizedTrade } from "@/lib/engine/types";
import { Journal } from "@/lib/engine/types";
import { UserSettings } from "@/types/trade";

/* ─── Storage Keys ─────────────────────────────────────────────────────────── */
const IDB_KEYS = {
  JOURNALS_V3:   "tj_journals_v3",        // Journal[] with embedded trades
  SELECTED_IDS:  "tj_selected_ids_v1",    // string[] of selected journal IDs
  SETTINGS_V3:   "tj_settings_v3",
};

const LS_KEYS = {
  THEME:            "tj_theme",
  DISPLAY_CURRENCY: "trading_journal_display_currency",
  // Legacy keys for one-time migration
  TRADES_LEGACY:    "trading_journal_normalized_trades_v2",
  JOURNALS_LEGACY:  "trading_journal_history_v2",
  SETTINGS_LEGACY:  "trading_journal_settings_v2",
};

/* ─── Journals (authoritative source) ─────────────────────────────────────── */

export async function saveJournals(journals: Journal[]): Promise<void> {
  try {
    await set(IDB_KEYS.JOURNALS_V3, journals);
  } catch {
    localStorage.setItem(IDB_KEYS.JOURNALS_V3, JSON.stringify(journals));
  }
}

export async function loadJournals(): Promise<Journal[]> {
  try {
    const data = await get<Journal[]>(IDB_KEYS.JOURNALS_V3);
    if (data && Array.isArray(data)) return data;
    const local = localStorage.getItem(IDB_KEYS.JOURNALS_V3);
    if (local) return JSON.parse(local);
    return [];
  } catch {
    return [];
  }
}

/* ─── Selected Journal IDs ─────────────────────────────────────────────────── */

export async function saveSelectedJournalIds(ids: string[]): Promise<void> {
  try {
    await set(IDB_KEYS.SELECTED_IDS, ids);
  } catch {
    localStorage.setItem(IDB_KEYS.SELECTED_IDS, JSON.stringify(ids));
  }
}

export async function loadSelectedJournalIds(): Promise<string[]> {
  try {
    const data = await get<string[]>(IDB_KEYS.SELECTED_IDS);
    if (data && Array.isArray(data)) return data;
    const local = localStorage.getItem(IDB_KEYS.SELECTED_IDS);
    if (local) return JSON.parse(local);
    return [];
  } catch {
    return [];
  }
}

/* ─── Settings ─────────────────────────────────────────────────────────────── */

export async function saveSettingsToStorage(settings: UserSettings): Promise<void> {
  try {
    await set(IDB_KEYS.SETTINGS_V3, settings);
  } catch {
    localStorage.setItem(IDB_KEYS.SETTINGS_V3, JSON.stringify(settings));
  }
}

export async function loadSettingsFromStorage(): Promise<UserSettings | null> {
  try {
    const data = await get<UserSettings>(IDB_KEYS.SETTINGS_V3);
    if (data) return data;
    const local = localStorage.getItem(IDB_KEYS.SETTINGS_V3);
    if (local) return JSON.parse(local);
    return null;
  } catch {
    return null;
  }
}

/* ─── Theme (localStorage only — needed before hydration) ─────────────────── */

export function saveTheme(theme: "dark" | "light"): void {
  try {
    localStorage.setItem(LS_KEYS.THEME, theme);
  } catch { /* SSR */ }
}

export function loadTheme(): "dark" | "light" {
  try {
    const v = localStorage.getItem(LS_KEYS.THEME);
    if (v === "dark" || v === "light") return v;
  } catch { /* SSR */ }
  return "dark";
}

/* ─── Clear All ─────────────────────────────────────────────────────────────── */

export async function clearAllStorage(): Promise<void> {
  try {
    await del(IDB_KEYS.JOURNALS_V3);
    await del(IDB_KEYS.SELECTED_IDS);
    await del(IDB_KEYS.SETTINGS_V3);
    Object.values(IDB_KEYS).forEach(k => localStorage.removeItem(k));
    Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
  } catch {
    console.error("Error clearing storage");
  }
}

/* ─── Legacy Shims (keep old imports compiling) ──────────────────────────── */
/** @deprecated Use saveJournals instead */
export async function saveTradesToStorage(trades: NormalizedTrade[]): Promise<void> {
  // No-op shim — trades are now embedded in Journal objects
  void trades;
}

/** @deprecated Use loadJournals instead */
export async function loadTradesFromStorage(): Promise<NormalizedTrade[]> {
  return [];
}

/** @deprecated */
export async function saveJournalsHistory(history: unknown[]): Promise<void> {
  void history;
}

/** @deprecated */
export async function loadJournalsHistory(): Promise<unknown[]> {
  return [];
}
