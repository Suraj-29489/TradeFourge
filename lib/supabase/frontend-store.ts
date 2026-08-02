// lib/supabase/frontend-store.ts
// In-Memory and sessionStorage Data Store for Frontend Development Mode.
// Intercepts all database operations when FRONTEND_ONLY mode is enabled.

import { emitAppEvent } from "@/lib/events/event-bus";
import type {
  CloudTrade,
  CloudTradeWithRelations,
  NewCloudTrade,
  UpdateCloudTrade,
  CloudTradeFilters,
  PaginatedResult,
  ServiceResult,
  CsvImport,
  TradingAccount,
  NewTradingAccount,
  UpdateTradingAccount,
  TradeTag,
  NewTradeTag,
  TradeChecklist,
  TradeChecklistItem,
  TradeChecklistCompletion,
  TradeImage,
  TradeImageType,
} from "@/types/database";

export interface DeleteImportResult {
  success: boolean;
  status: "NOT_FOUND" | "FILE_MISSING_DB_REMOVED" | "DELETED_SUCCESS";
  message: string;
  error: string | null;
}

// Helper UUID generator with browser fallback
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── SessionStorage Cache Utilities ─────────────────────────────────────────

function loadSessionData<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveSessionData<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const KEYS = {
  TRADES: "tf_frontend_trades",
  IMPORTS: "tf_frontend_imports",
  ACCOUNTS: "tf_frontend_accounts",
  TAGS: "tf_frontend_tags",
  TAG_LINKS: "tf_frontend_tag_links",
  CHECKLISTS: "tf_frontend_checklists",
  CHECKLIST_ITEMS: "tf_frontend_checklist_items",
  CHECKLIST_COMPLETIONS: "tf_frontend_checklist_completions",
  IMAGES: "tf_frontend_images",
};

export function clearFrontendStore(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((k) => {
    try {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    } catch {}
  });
}

// ─── TRADES SERVICE ─────────────────────────────────────────────────────────

export async function getFrontendTrades(
  userId: string,
  filters: Partial<CloudTradeFilters> = {},
  page = 1,
  pageSize = 25,
  sortBy: keyof CloudTrade = "close_time",
  sortAsc = false
): Promise<ServiceResult<PaginatedResult<CloudTradeWithRelations>>> {
  let trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);

  // Filter by user_id if present
  trades = trades.filter((t) => !t.user_id || t.user_id === userId);

  if (filters.side && filters.side !== "ALL") {
    trades = trades.filter((t) => t.side === filters.side);
  }
  if (filters.outcome && filters.outcome !== "ALL") {
    trades = trades.filter((t) => t.outcome === filters.outcome);
  }
  if (filters.accountId && filters.accountId !== "ALL") {
    trades = trades.filter((t) => t.account_id === filters.accountId);
  }
  if (filters.source && filters.source !== "ALL") {
    trades = trades.filter((t) => t.source === filters.source);
  }
  if (filters.symbol && filters.symbol !== "") {
    const symLower = filters.symbol.toLowerCase();
    trades = trades.filter((t) => (t.symbol || "").toLowerCase().includes(symLower));
  }
  if (filters.search && filters.search !== "") {
    const q = filters.search.toLowerCase();
    trades = trades.filter(
      (t) =>
        (t.symbol || "").toLowerCase().includes(q) ||
        (t.ticket || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        (t.strategy || "").toLowerCase().includes(q)
    );
  }

  // Sort
  trades.sort((a: Record<string, any>, b: Record<string, any>) => {
    const valA = a[sortBy] ?? "";
    const valB = b[sortBy] ?? "";
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const total = trades.length;
  const from = (page - 1) * pageSize;
  const paginated = trades.slice(from, from + pageSize);

  return {
    data: {
      data: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
    error: null,
  };
}

export async function getFrontendTradeById(
  id: string,
  userId: string
): Promise<ServiceResult<CloudTradeWithRelations>> {
  const trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const trade = trades.find((t) => t.id === id && (!t.user_id || t.user_id === userId));
  return { data: trade ?? null, error: trade ? null : "Trade not found" };
}

export async function getFrontendTradeStats(
  userId: string
): Promise<ServiceResult<{
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  totalNetProfit: number;
  winRate: number;
}>> {
  const trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []).filter(
    (t) => !t.user_id || t.user_id === userId
  );

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.outcome === "WIN").length;
  const losingTrades = trades.filter((t) => t.outcome === "LOSS").length;
  const breakevenTrades = trades.filter((t) => t.outcome === "BREAKEVEN").length;
  const totalNetProfit = trades.reduce(
    (sum, t) => sum + (t.net_profit ?? (t.profit + t.commission + t.swap)),
    0
  );
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  return {
    data: {
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      totalNetProfit,
      winRate,
    },
    error: null,
  };
}

export async function deduplicateFrontendTrades(
  userId: string,
  candidates: NewCloudTrade[]
): Promise<{ uniqueTrades: NewCloudTrade[]; skippedDuplicates: number }> {
  if (!candidates || candidates.length === 0) {
    return { uniqueTrades: [], skippedDuplicates: 0 };
  }

  const existing = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []).filter(
    (t) => !t.user_id || t.user_id === userId
  );

  const isDuplicate = (cand: Record<string, any>, target: Record<string, any>) => {
    // Priority 1: external_trade_id
    if (cand.external_trade_id && target.external_trade_id) {
      if (cand.external_trade_id === target.external_trade_id) return true;
    }

    // Priority 2: ticket + account_id
    if (cand.ticket && target.ticket) {
      const sameTicket = String(cand.ticket).trim() === String(target.ticket).trim();
      const sameAcc = (cand.account_id || null) === (target.account_id || null);
      if (sameTicket && sameAcc) return true;
    }

    // Priority 3: symbol + open_time + close_time + side + volume
    const sameSymbol = String(cand.symbol || "").toUpperCase() === String(target.symbol || "").toUpperCase();
    const sameSide = String(cand.side || "").toUpperCase() === String(target.side || "").toUpperCase();
    const sameVol = Math.abs(Number(cand.volume || 0) - Number(target.volume || 0)) < 0.0001;

    const candOpen = cand.open_time ? new Date(cand.open_time).getTime() : null;
    const targetOpen = target.open_time ? new Date(target.open_time).getTime() : null;
    const sameOpen = candOpen !== null && targetOpen !== null && Math.abs(candOpen - targetOpen) < 2000;

    const candClose = cand.close_time ? new Date(cand.close_time).getTime() : null;
    const targetClose = target.close_time ? new Date(target.close_time).getTime() : null;
    const sameClose = candClose !== null && targetClose !== null && Math.abs(candClose - targetClose) < 2000;

    return sameSymbol && sameSide && sameVol && sameOpen && sameClose;
  };

  const uniqueTrades: NewCloudTrade[] = [];
  let skippedDuplicates = 0;

  for (const cand of candidates) {
    const existsInDb = existing.some((t) => isDuplicate(cand, t));
    if (existsInDb) {
      skippedDuplicates++;
      continue;
    }

    const existsInBatch = uniqueTrades.some((accepted) => isDuplicate(cand, accepted));
    if (existsInBatch) {
      skippedDuplicates++;
      continue;
    }

    uniqueTrades.push(cand);
  }

  return { uniqueTrades, skippedDuplicates };
}

export async function createFrontendTrade(
  userId: string,
  payload: NewCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const { uniqueTrades } = await deduplicateFrontendTrades(userId, [payload]);
  if (uniqueTrades.length === 0) {
    return { data: null, error: "Duplicate trade detected. Skip creation." };
  }

  const trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const now = new Date().toISOString();

  const netProfit =
    (payload.profit ?? 0) + (payload.commission ?? 0) + (payload.swap ?? 0);

  const newTrade: CloudTradeWithRelations = {
    id: generateUUID(),
    user_id: userId,
    account_id: payload.account_id ?? null,
    ticket: payload.ticket ?? null,
    symbol: payload.symbol,
    side: payload.side,
    volume: payload.volume,
    open_price: payload.open_price ?? null,
    close_price: payload.close_price ?? null,
    stop_loss: payload.stop_loss ?? null,
    take_profit: payload.take_profit ?? null,
    open_time: payload.open_time ?? null,
    close_time: payload.close_time ?? null,
    duration_seconds: payload.duration_seconds ?? null,
    profit: payload.profit ?? 0,
    commission: payload.commission ?? 0,
    swap: payload.swap ?? 0,
    net_profit: netProfit,
    risk_amount: payload.risk_amount ?? null,
    rr_ratio: payload.rr_ratio ?? null,
    outcome: payload.outcome ?? "BREAKEVEN",
    source: payload.source ?? "manual",
    session: payload.session ?? null,
    strategy: payload.strategy ?? null,
    notes: payload.notes ?? null,
    emotions: payload.emotions ?? null,
    lessons: payload.lessons ?? null,
    mistakes: payload.mistakes ?? null,
    magic_number: payload.magic_number ?? null,
    import_id: payload.import_id ?? null,
    created_at: now,
    updated_at: now,
    tags: [],
    images: [],
  };

  trades.unshift(newTrade);
  saveSessionData(KEYS.TRADES, trades);

  emitAppEvent("tradefourge:trade-created", { tradeId: newTrade.id });
  return { data: newTrade, error: null };
}

export async function bulkInsertFrontendTrades(
  userId: string,
  tradesToInsert: NewCloudTrade[]
): Promise<{ inserted: number; skippedDuplicates: number; errors: string[] }> {
  const { uniqueTrades, skippedDuplicates } = await deduplicateFrontendTrades(userId, tradesToInsert);

  if (uniqueTrades.length === 0) {
    return { inserted: 0, skippedDuplicates, errors: [] };
  }

  const existingTrades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const now = new Date().toISOString();

  const formattedNewTrades: CloudTradeWithRelations[] = uniqueTrades.map((t) => {
    const netProfit = (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
    return {
      id: generateUUID(),
      user_id: userId,
      account_id: t.account_id ?? null,
      ticket: t.ticket ?? null,
      symbol: t.symbol,
      side: t.side,
      volume: t.volume,
      open_price: t.open_price ?? null,
      close_price: t.close_price ?? null,
      stop_loss: t.stop_loss ?? null,
      take_profit: t.take_profit ?? null,
      open_time: t.open_time ?? null,
      close_time: t.close_time ?? null,
      duration_seconds: t.duration_seconds ?? null,
      profit: t.profit ?? 0,
      commission: t.commission ?? 0,
      swap: t.swap ?? 0,
      net_profit: netProfit,
      risk_amount: t.risk_amount ?? null,
      rr_ratio: t.rr_ratio ?? null,
      outcome: t.outcome ?? "BREAKEVEN",
      source: t.source ?? "csv_import",
      session: t.session ?? null,
      strategy: t.strategy ?? null,
      notes: t.notes ?? null,
      emotions: t.emotions ?? null,
      lessons: t.lessons ?? null,
      mistakes: t.mistakes ?? null,
      magic_number: t.magic_number ?? null,
      import_id: t.import_id ?? null,
      created_at: now,
      updated_at: now,
      tags: [],
      images: [],
    };
  });

  const updatedTradesList = [...formattedNewTrades, ...existingTrades];
  saveSessionData(KEYS.TRADES, updatedTradesList);

  emitAppEvent("tradefourge:trade-created", { count: formattedNewTrades.length });

  return {
    inserted: formattedNewTrades.length,
    skippedDuplicates,
    errors: [],
  };
}

export async function updateFrontendTrade(
  id: string,
  userId: string,
  updates: UpdateCloudTrade
): Promise<ServiceResult<CloudTrade>> {
  const trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const index = trades.findIndex((t) => t.id === id && (!t.user_id || t.user_id === userId));

  if (index === -1) {
    return { data: null, error: "Trade not found" };
  }

  const existing = trades[index];
  const updatedProfit = updates.profit ?? existing.profit;
  const updatedComm = updates.commission ?? existing.commission;
  const updatedSwap = updates.swap ?? existing.swap;
  const netProfit = updatedProfit + updatedComm + updatedSwap;

  const updatedTrade: CloudTradeWithRelations = {
    ...existing,
    ...updates,
    net_profit: netProfit,
    updated_at: new Date().toISOString(),
  };

  trades[index] = updatedTrade;
  saveSessionData(KEYS.TRADES, trades);

  emitAppEvent("tradefourge:trade-updated", { tradeId: id });
  return { data: updatedTrade, error: null };
}

export async function deleteFrontendTrade(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  let trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const initialCount = trades.length;

  trades = trades.filter((t) => t.id !== id);
  saveSessionData(KEYS.TRADES, trades);

  if (trades.length < initialCount) {
    emitAppEvent("tradefourge:trade-deleted", { tradeId: id });
    emitAppEvent("tradefourge:data-changed", { tradeId: id, action: "delete" });
    return { data: true, error: null };
  }

  return { data: false, error: "Trade not found" };
}

export async function deleteAllFrontendTrades(
  userId: string
): Promise<ServiceResult<number>> {
  const trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const count = trades.length;

  if (typeof window !== "undefined") {
    sessionStorage.removeItem(KEYS.TRADES);
    localStorage.removeItem(KEYS.TRADES);
  }

  emitAppEvent("tradefourge:trade-deleted", { count, all: true });
  emitAppEvent("tradefourge:data-changed", { all: true, action: "deleteAllTrades" });

  return { data: count, error: null };
}

export async function deleteFrontendTradesByImportId(
  importId: string,
  userId: string
): Promise<ServiceResult<number>> {
  let trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  const initialCount = trades.length;

  trades = trades.filter((t) => t.import_id !== importId);
  saveSessionData(KEYS.TRADES, trades);

  const deletedCount = initialCount - trades.length;

  emitAppEvent("tradefourge:trade-deleted", { count: deletedCount, importId });
  emitAppEvent("tradefourge:data-changed", { importId, action: "deleteTradesByImportId" });

  return { data: deletedCount, error: null };
}

// ─── CSV IMPORTS SERVICE ───────────────────────────────────────────────────

export async function getFrontendImportHistory(
  userId: string
): Promise<ServiceResult<CsvImport[]>> {
  const imports = loadSessionData<CsvImport[]>(KEYS.IMPORTS, []).filter(
    (i) => !i.user_id || i.user_id === userId
  );
  const accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);

  const enriched = imports.map((imp) => {
    const acc = accounts.find((a) => a.id === imp.account_id);
    return {
      ...imp,
      account: acc ? { id: acc.id, account_name: acc.account_name, broker: acc.broker, currency: acc.currency } : null,
    };
  });

  return { data: enriched as CsvImport[], error: null };
}

export async function getFrontendLatestImport(
  userId: string
): Promise<ServiceResult<CsvImport | null>> {
  const res = await getFrontendImportHistory(userId);
  return { data: res.data ? res.data[0] ?? null : null, error: null };
}

export async function createFrontendImportRecord(
  userId: string,
  filename: string,
  totalRows: number,
  storagePath?: string,
  accountId?: string | null
): Promise<ServiceResult<CsvImport>> {
  const imports = loadSessionData<CsvImport[]>(KEYS.IMPORTS, []);
  const accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);
  const selectedAcc = accounts.find((a) => a.id === accountId);
  const now = new Date().toISOString();

  const newImport: CsvImport = {
    id: generateUUID(),
    user_id: userId,
    account_id: accountId ?? null,
    filename,
    broker: selectedAcc?.broker ?? null,
    platform: selectedAcc?.platform ?? null,
    total_rows: totalRows,
    imported_rows: 0,
    failed_rows: 0,
    skipped_rows: 0,
    duplicate_rows: 0,
    import_status: "processing",
    error_log: null,
    notes: null,
    uploaded_at: now,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  imports.unshift(newImport);
  saveSessionData(KEYS.IMPORTS, imports);

  emitAppEvent("tradefourge:import-created", { importId: newImport.id });
  return { data: newImport, error: null };
}

export async function updateFrontendImportRecord(
  id: string,
  userId: string,
  updates: Partial<CsvImport>
): Promise<ServiceResult<CsvImport>> {
  const imports = loadSessionData<CsvImport[]>(KEYS.IMPORTS, []);
  const index = imports.findIndex((i) => i.id === id && (!i.user_id || i.user_id === userId));

  if (index === -1) {
    return { data: null, error: "Import record not found" };
  }

  const updatedRecord = { ...imports[index], ...updates };
  imports[index] = updatedRecord;
  saveSessionData(KEYS.IMPORTS, imports);

  return { data: updatedRecord, error: null };
}

export async function deleteFrontendImportRecord(
  id: string,
  userId: string,
  deleteTrades = true
): Promise<DeleteImportResult> {
  let imports = loadSessionData<CsvImport[]>(KEYS.IMPORTS, []);
  const target = imports.find((i) => i.id === id);

  if (!target) {
    return {
      success: true,
      status: "NOT_FOUND",
      message: "Nothing to delete.",
      error: null,
    };
  }

  imports = imports.filter((i) => i.id !== id);
  saveSessionData(KEYS.IMPORTS, imports);

  if (deleteTrades) {
    await deleteFrontendTradesByImportId(id, userId);
  }

  emitAppEvent("tradefourge:import-deleted", { importId: id });
  emitAppEvent("tradefourge:data-changed", { importId: id, action: "deleteImportRecord" });

  return {
    success: true,
    status: "DELETED_SUCCESS",
    message: "Import deleted.",
    error: null,
  };
}

export async function deleteAllFrontendImports(
  userId: string
): Promise<DeleteImportResult> {
  clearFrontendStore();

  emitAppEvent("tradefourge:import-deleted", { all: true });
  emitAppEvent("tradefourge:data-changed", { all: true, action: "deleteAllImports" });

  return {
    success: true,
    status: "DELETED_SUCCESS",
    message: "All imports and trades deleted.",
    error: null,
  };
}

// ─── TRADING ACCOUNTS SERVICE ──────────────────────────────────────────────

export async function getFrontendTradingAccounts(
  userId: string
): Promise<ServiceResult<TradingAccount[]>> {
  const accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []).filter(
    (a) => !a.user_id || a.user_id === userId
  );
  return { data: accounts, error: null };
}

export async function getFrontendTradingAccountById(
  id: string,
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  const accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);
  const acc = accounts.find((a) => a.id === id && (!a.user_id || a.user_id === userId));
  return { data: acc ?? null, error: acc ? null : "Account not found" };
}

export async function getFrontendDefaultAccount(
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  const accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []).filter(
    (a) => !a.user_id || a.user_id === userId
  );
  const def = accounts.find((a) => a.is_default && a.is_active) || accounts[0] || null;
  return { data: def, error: null };
}

export async function createFrontendTradingAccount(
  userId: string,
  payload: NewTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  let accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);
  const now = new Date().toISOString();

  if (payload.is_default) {
    accounts = accounts.map((a) => ({ ...a, is_default: false }));
  }

  const newAcc: TradingAccount = {
    id: generateUUID(),
    user_id: userId,
    account_name: payload.account_name,
    broker: payload.broker,
    platform: payload.platform ?? "Other",
    account_number: payload.account_number ?? null,
    account_type: payload.account_type ?? "Live",
    currency: payload.currency ?? "USD",
    leverage: payload.leverage ? String(payload.leverage) : "1:100",
    starting_balance: payload.starting_balance ?? 10000,
    current_balance: payload.current_balance ?? payload.starting_balance ?? 10000,
    is_default: payload.is_default ?? (accounts.length === 0),
    is_active: true,
    notes: payload.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  accounts.unshift(newAcc);
  saveSessionData(KEYS.ACCOUNTS, accounts);

  return { data: newAcc, error: null };
}

export async function updateFrontendTradingAccount(
  id: string,
  userId: string,
  updates: UpdateTradingAccount
): Promise<ServiceResult<TradingAccount>> {
  let accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);
  const index = accounts.findIndex((a) => a.id === id);

  if (index === -1) {
    return { data: null, error: "Account not found" };
  }

  if (updates.is_default) {
    accounts = accounts.map((a) => ({ ...a, is_default: false }));
  }

  const updatedAcc = {
    ...accounts[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  accounts[index] = updatedAcc;
  saveSessionData(KEYS.ACCOUNTS, accounts);

  return { data: updatedAcc, error: null };
}

export async function setFrontendDefaultAccount(
  id: string,
  userId: string
): Promise<ServiceResult<TradingAccount>> {
  return updateFrontendTradingAccount(id, userId, { is_default: true });
}

export async function deleteFrontendTradingAccount(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  let accounts = loadSessionData<TradingAccount[]>(KEYS.ACCOUNTS, []);
  accounts = accounts.filter((a) => a.id !== id);
  saveSessionData(KEYS.ACCOUNTS, accounts);

  let trades = loadSessionData<CloudTradeWithRelations[]>(KEYS.TRADES, []);
  trades = trades.filter((t) => t.account_id !== id);
  saveSessionData(KEYS.TRADES, trades);

  let imports = loadSessionData<CsvImport[]>(KEYS.IMPORTS, []);
  imports = imports.filter((i) => i.account_id !== id);
  saveSessionData(KEYS.IMPORTS, imports);

  emitAppEvent("tradefourge:data-changed", { accountId: id, action: "deleteAccount" });
  return { data: true, error: null };
}

// ─── TAGS SERVICE ──────────────────────────────────────────────────────────

export async function getFrontendTradeTags(
  userId: string
): Promise<ServiceResult<TradeTag[]>> {
  const tags = loadSessionData<TradeTag[]>(KEYS.TAGS, []);
  return { data: tags, error: null };
}

export async function createFrontendTag(
  userId: string,
  payload: NewTradeTag
): Promise<ServiceResult<TradeTag>> {
  const tags = loadSessionData<TradeTag[]>(KEYS.TAGS, []);
  const newTag: TradeTag = {
    id: generateUUID(),
    user_id: userId,
    name: payload.name,
    color: payload.color ?? "#7C3AED",
    created_at: new Date().toISOString(),
  };
  tags.push(newTag);
  saveSessionData(KEYS.TAGS, tags);
  return { data: newTag, error: null };
}

export async function deleteFrontendTag(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  let tags = loadSessionData<TradeTag[]>(KEYS.TAGS, []);
  tags = tags.filter((t) => t.id !== id);
  saveSessionData(KEYS.TAGS, tags);
  return { data: true, error: null };
}

// ─── CHECKLISTS & IMAGES SERVICE ───────────────────────────────────────────

export async function getFrontendChecklists(
  userId: string
): Promise<ServiceResult<TradeChecklist[]>> {
  return { data: [], error: null };
}

export async function getFrontendTradeImages(
  tradeId: string
): Promise<ServiceResult<TradeImage[]>> {
  const images = loadSessionData<TradeImage[]>(KEYS.IMAGES, []).filter(
    (img) => img.trade_id === tradeId
  );
  return { data: images, error: null };
}

export async function uploadFrontendTradeImage(
  tradeId: string,
  userId: string,
  file: File,
  imageType: TradeImageType = "screenshot",
  caption?: string
): Promise<ServiceResult<TradeImage>> {
  const images = loadSessionData<TradeImage[]>(KEYS.IMAGES, []);
  const previewUrl = URL.createObjectURL(file);

  const newImg: TradeImage = {
    id: generateUUID(),
    user_id: userId,
    trade_id: tradeId,
    image_type: imageType,
    storage_path: `mock/${file.name}`,
    public_url: previewUrl,
    caption: caption ?? null,
    created_at: new Date().toISOString(),
  };

  images.push(newImg);
  saveSessionData(KEYS.IMAGES, images);

  return { data: newImg, error: null };
}

export async function deleteFrontendTradeImage(
  id: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  let images = loadSessionData<TradeImage[]>(KEYS.IMAGES, []);
  images = images.filter((img) => img.id !== id);
  saveSessionData(KEYS.IMAGES, images);
  return { data: true, error: null };
}
