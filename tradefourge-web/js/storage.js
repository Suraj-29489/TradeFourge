/**
 * TradeFourge - Local Storage & Account-Isolated Cache Persistence Manager.
 * Persists trade datasets, notes, rules, settings, and MT5 sessions in browser localStorage,
 * supporting both anonymous local mode and per-Google-account isolated cloud caches.
 */

const StorageManager = {
  KEYS: {
    TRADES: 'tradefourge_trades',
    LAST_IMPORT: 'tradefourge_last_import',
    NOTES: 'tradefourge_notes',
    RULES: 'tradefourge_rules',
    USER_SETTINGS: 'tradefourge_settings',
    CURRENCY: 'tradefourge_currency',
    STARTING_CAPITAL: 'tradefourge_starting_capital',
    MT5_SESSION: 'tradefourge_mt5_session',
    DELETED_UIDS: 'tradefourge_deleted_uids',
    ACCOUNTS: 'tradefourge_accounts',
    SELECTED_ACCOUNT: 'tradefourge_selected_account'
  },

  OFFLINE_MIRROR_META_KEY: 'tradefourge_offline_mirror_meta',

  ACCOUNT_DEFINITIONS: {
    exness_standard: {
      id: 'exness_standard',
      name: 'Exness Account',
      broker: 'exness',
      type: 'standard'
    },
    exness_cents: {
      id: 'exness_cents',
      name: 'Cents Account',
      broker: 'exness',
      type: 'cents'
    }
  },

  // Standard non-cent instruments whose base symbol naturally ends with uppercase 'C'
  KNOWN_STANDARD_C_SYMBOLS: new Set([
    'USTEC', 'USDC', 'MATIC', 'LTC', 'ETC', 'XEC', 'BTTC'
  ]),

  DEFAULT_RULES: [
    { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
    { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
    { id: 3, text: 'Always set a stop loss before entering position', checked: true },
    { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
    { id: 5, text: 'Accept take-profit targets without greed', checked: true }
  ],

  activeNamespace: 'anonymous',
  _listeners: [],

  state: {
    trades: [],
    lastImport: null,
    notes: '',
    rules: null,
    currency: 'USD',
    startingCapital: null,
    mt5Session: null,
    deletedUids: [],
    accounts: [],
    selectedAccount: 'all'
  },

  /**
   * Helper to retrieve localStorage reference safely across different environments
   */
  _getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    } catch (e) {
      // Storage access may throw in restricted iframe/browser contexts
    }
    return null;
  },

  /**
   * Deterministic compact hash for building safe namespace key prefixes from Google `sub`
   */
  _hashNamespace(ns) {
    const str = String(ns || 'anonymous');
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 ^= ch;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= ch + i;
      h2 = Math.imul(h2, 0x85ebca6b);
    }
    const clean = str.replace(/[^a-zA-Z0-9_-]/g, '').slice(-8);
    return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${clean ? '_' + clean : ''}`;
  },

  /**
   * Resolve the storage key name for the current or explicit namespace.
   * Anonymous namespace preserves exact legacy `tradefourge_*` keys untouched.
   */
  _getKeyForNamespace(baseKey, namespace = this.activeNamespace) {
    if (!namespace || namespace === 'anonymous') {
      return baseKey;
    }
    const prefix = `tradefourge_acct_${this._hashNamespace(namespace)}_`;
    return prefix + baseKey.replace(/^tradefourge_/, '');
  },

  _getLegacyKeyForNamespace(baseKey, namespace = this.activeNamespace) {
    const legacyBase = String(baseKey || '').replace(/^tradefourge_/, 'tradeforge_');
    if (!namespace || namespace === 'anonymous') {
      return legacyBase;
    }
    const prefix = `tradeforge_acct_${this._hashNamespace(namespace)}_`;
    return prefix + legacyBase.replace(/^tradeforge_/, '');
  },

  _getItemWithLegacyFallback(storage, baseKey, namespace = this.activeNamespace) {
    if (!storage) return null;
    const primary = storage.getItem(this._getKeyForNamespace(baseKey, namespace));
    if (primary !== null && primary !== undefined) return primary;
    const legacyKey = this._getLegacyKeyForNamespace(baseKey, namespace);
    return legacyKey ? storage.getItem(legacyKey) : null;
  },

  /**
   * Mirror active signed-in workspace mutations into standard offline browser localStorage
   * (`tradefourge_*`) so local/offline mode always retains the latest CSV & journal state.
   * When writing directly in anonymous/offline mode, clears mirror ownership metadata so
   * offline-only edits are cleanly detected on next cloud login.
   */
  _syncKeyToOfflineLocal(storage, baseKey, value, { remove = false } = {}) {
    if (!storage || !baseKey) return;
    try {
      if (!this.activeNamespace || this.activeNamespace === 'anonymous') {
        storage.removeItem(this.OFFLINE_MIRROR_META_KEY);
        return;
      }
      if (remove) {
        storage.removeItem(baseKey);
      } else {
        storage.setItem(baseKey, value);
      }
      storage.setItem(
        this.OFFLINE_MIRROR_META_KEY,
        JSON.stringify({
          ownerSub: this.activeNamespace,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not mirror state to offline localStorage:', e);
      }
    }
  },

  getOfflineMirrorOwner() {
    const storage = this._getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(this.OFFLINE_MIRROR_META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && parsed.ownerSub) ? String(parsed.ownerSub) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Subscribe to storage domain mutations: 'trades' | 'settings' | 'accounts' | 'all' | 'namespace'
   */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== listener);
    };
  },

  _emit(domain, meta = {}) {
    if (!this._listeners || this._listeners.length === 0) return;
    const event = {
      domain,
      namespace: this.activeNamespace,
      silentSync: Boolean(meta.silentSync),
      reason: meta.reason || 'update',
      timestamp: new Date().toISOString()
    };
    this._listeners.slice().forEach(fn => {
      try {
        fn(event);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('StorageManager listener error:', e);
        }
      }
    });
  },

  /**
   * Switch active storage namespace ('anonymous' or Google `sub`) and reload cached state
   */
  setActiveNamespace(namespace = 'anonymous', options = {}) {
    const target = namespace ? String(namespace).trim() : 'anonymous';
    this.activeNamespace = target || 'anonymous';
    this.loadFromStorage();
    if (!options.silent) {
      this._emit('namespace', { silentSync: true, reason: 'switch_namespace' });
    }
    return this.activeNamespace;
  },

  getActiveNamespace() {
    return this.activeNamespace;
  },

  /**
   * Initialize StorageManager and hydrate state from browser localStorage
   */
  init() {
    this.loadFromStorage();
  },

  _readBundleFromNamespace(namespace) {
    const storage = this._getStorage();
    const empty = {
      trades: [],
      lastImport: null,
      notes: '',
      rules: null,
      currency: 'USD',
      startingCapital: null,
      mt5Session: null,
      deletedUids: [],
      accounts: [],
      selectedAccount: 'all'
    };
    if (!storage) return empty;

    const kGet = (baseKey) => this._getItemWithLegacyFallback(storage, baseKey, namespace);

    try {
      const rawTrades = kGet(this.KEYS.TRADES);
      if (rawTrades) {
        const parsed = JSON.parse(rawTrades);
        if (Array.isArray(parsed)) {
          empty.trades = parsed.filter(
            t => t && typeof t === 'object' && (t.ticket !== undefined || t.id !== undefined || t.symbol !== undefined)
          );
        }
      }

      const rawAccounts = kGet(this.KEYS.ACCOUNTS);
      if (rawAccounts) {
        try {
          const parsedAccounts = JSON.parse(rawAccounts);
          if (Array.isArray(parsedAccounts)) {
            empty.accounts = parsedAccounts.filter((a) => a && typeof a === 'object' && a.id);
          }
        } catch (e) {
          empty.accounts = [];
        }
      }

      const rawSelectedAccount = kGet(this.KEYS.SELECTED_ACCOUNT);
      if (rawSelectedAccount === 'all' || rawSelectedAccount === 'exness_standard' || rawSelectedAccount === 'exness_cents') {
        empty.selectedAccount = rawSelectedAccount;
      }

      const rawImport = kGet(this.KEYS.LAST_IMPORT);
      if (rawImport) {
        try {
          empty.lastImport = JSON.parse(rawImport);
        } catch (e) {
          empty.lastImport = null;
        }
      }

      const rawNotes = kGet(this.KEYS.NOTES);
      if (rawNotes !== null) {
        empty.notes = rawNotes;
      }

      const rawRules = kGet(this.KEYS.RULES);
      if (rawRules) {
        try {
          const parsedRules = JSON.parse(rawRules);
          empty.rules = Array.isArray(parsedRules) ? parsedRules : null;
        } catch (e) {
          empty.rules = null;
        }
      }

      const rawCurrency = kGet(this.KEYS.CURRENCY);
      if (rawCurrency === 'INR' || rawCurrency === 'USD') {
        empty.currency = rawCurrency;
      }

      const rawCapital = kGet(this.KEYS.STARTING_CAPITAL);
      if (rawCapital !== null && rawCapital !== '' && !isNaN(Number(rawCapital)) && Number(rawCapital) > 0) {
        empty.startingCapital = Number(rawCapital);
      }

      const rawMt5 = kGet(this.KEYS.MT5_SESSION);
      if (rawMt5) {
        try {
          empty.mt5Session = JSON.parse(rawMt5);
        } catch (e) {
          empty.mt5Session = null;
        }
      }

      const rawDeleted = kGet(this.KEYS.DELETED_UIDS);
      if (rawDeleted) {
        try {
          const parsedDel = JSON.parse(rawDeleted);
          empty.deletedUids = Array.isArray(parsedDel) ? parsedDel : [];
        } catch (e) {
          empty.deletedUids = [];
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not load data from localStorage:', e);
      }
    }

    return empty;
  },

  /**
   * Automatically identify trading account for a trade record.
   * Priority:
   *   1. Primary: Symbol naming convention (ends with 'c' => Cents Account, else => Exness Account;
   *      standard symbols ending in uppercase 'C' like USTEC remain Exness Account).
   *   2. Secondary: Ticket digit length (7 digits => Exness Account, 8 digits => Cents Account)
   *      for corroboration or fallback when symbol is missing.
   */
  identifyTradeAccount(trade) {
    if (typeof TradeParser !== 'undefined' && typeof TradeParser.identifyTradeAccount === 'function') {
      return TradeParser.identifyTradeAccount(trade);
    }

    const rawSym = String((trade && trade.symbol) || '').trim();
    const upperSym = rawSym.toUpperCase();
    const rawTicket = String((trade && (trade.ticket || trade.position)) || '').trim();

    let symbolAccountId = null;
    if (rawSym) {
      let isCentsSymbol = false;
      if (rawSym.endsWith('c') && rawSym.length >= 4 && !this.KNOWN_STANDARD_C_SYMBOLS.has(upperSym)) {
        isCentsSymbol = true;
      } else if (
        rawSym === upperSym &&
        upperSym.endsWith('C') &&
        upperSym.length >= 6 &&
        !this.KNOWN_STANDARD_C_SYMBOLS.has(upperSym)
      ) {
        isCentsSymbol = true;
      }
      symbolAccountId = isCentsSymbol ? 'exness_cents' : 'exness_standard';
    }

    let ticketAccountId = null;
    if (/^\d+$/.test(rawTicket)) {
      if (rawTicket.length === 7) ticketAccountId = 'exness_standard';
      else if (rawTicket.length === 8) ticketAccountId = 'exness_cents';
    }

    let accountId = 'exness_standard';
    let detectionSource = 'default_fallback';
    let needsReview = false;
    let reviewReason = '';

    if (symbolAccountId) {
      accountId = symbolAccountId;
      if (ticketAccountId && ticketAccountId !== symbolAccountId) {
        detectionSource = 'symbol_conflict';
        needsReview = true;
        const symName = this.ACCOUNT_DEFINITIONS[symbolAccountId].name;
        const tkName = this.ACCOUNT_DEFINITIONS[ticketAccountId].name;
        reviewReason = `Symbol "${rawSym}" indicates ${symName}, while ${rawTicket.length}-digit ticket "${rawTicket}" suggests ${tkName}.`;
      } else if (ticketAccountId && ticketAccountId === symbolAccountId) {
        detectionSource = 'symbol+ticket';
      } else {
        detectionSource = 'symbol';
      }
    } else if (ticketAccountId) {
      accountId = ticketAccountId;
      detectionSource = 'ticket_fallback';
    } else {
      needsReview = true;
      reviewReason = 'Missing symbol and recognizable 7/8-digit Exness ticket ID.';
    }

    const def = this.ACCOUNT_DEFINITIONS[accountId] || this.ACCOUNT_DEFINITIONS.exness_standard;
    return {
      accountId: def.id,
      accountName: def.name,
      detectionSource,
      needsReview,
      reviewReason
    };
  },

  /**
   * Reconcile stable, deduplicated trading accounts list from stored trades & existing registry.
   * Only creates an account entry once trades belonging to it exist (reusing stable IDs).
   */
  _reconcileAccountsList(trades = [], existingAccounts = []) {
    const existingById = new Map();
    if (Array.isArray(existingAccounts)) {
      existingAccounts.forEach((a) => {
        if (a && a.id && this.ACCOUNT_DEFINITIONS[a.id]) {
          existingById.set(a.id, a);
        }
      });
    }

    const counts = { exness_standard: 0, exness_cents: 0 };
    const reviewCounts = { exness_standard: 0, exness_cents: 0 };

    if (Array.isArray(trades)) {
      trades.forEach((t) => {
        if (!t || typeof t !== 'object') return;
        const id = (t.accountId && this.ACCOUNT_DEFINITIONS[t.accountId])
          ? t.accountId
          : this.identifyTradeAccount(t).accountId;
        counts[id] = (counts[id] || 0) + 1;
        if (t.accountNeedsReview) {
          reviewCounts[id] = (reviewCounts[id] || 0) + 1;
        }
      });
    }

    const nowIso = new Date().toISOString();
    const orderedIds = ['exness_standard', 'exness_cents'];
    const result = [];
    orderedIds.forEach((id) => {
      if (counts[id] > 0) {
        const def = this.ACCOUNT_DEFINITIONS[id];
        const prev = existingById.get(id);
        result.push({
          id: def.id,
          name: def.name,
          broker: def.broker,
          type: def.type,
          tradeCount: counts[id],
          reviewCount: reviewCounts[id] || 0,
          createdAt: (prev && prev.createdAt) || nowIso,
          updatedAt: nowIso
        });
      }
    });
    return result;
  },

  _persistAccounts() {
    const storage = this._getStorage();
    if (!storage) return;
    const key = this._getKeyForNamespace(this.KEYS.ACCOUNTS);
    try {
      const json = JSON.stringify(this.state.accounts || []);
      storage.setItem(key, json);
      this._syncKeyToOfflineLocal(storage, this.KEYS.ACCOUNTS, json);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not persist accounts to localStorage:', e);
      }
    }
  },

  getAccounts() {
    this.state.accounts = this._reconcileAccountsList(this.state.trades, this.state.accounts);
    return this.state.accounts.map((a) => ({ ...a }));
  },

  getAccountSummaryCounts(trades = null) {
    const list = Array.isArray(trades) ? trades : (this.state.trades || []);
    const counts = { all: list.length, exness_standard: 0, exness_cents: 0 };
    list.forEach((t) => {
      if (!t) return;
      const id = (t.accountId && this.ACCOUNT_DEFINITIONS[t.accountId])
        ? t.accountId
        : this.identifyTradeAccount(t).accountId;
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  },

  getSelectedAccount() {
    const cur = this.state.selectedAccount;
    if (cur === 'exness_standard' || cur === 'exness_cents' || cur === 'all') {
      return cur;
    }
    return 'all';
  },

  setSelectedAccount(accountId, options = {}) {
    const normalized = (accountId === 'exness_standard' || accountId === 'exness_cents') ? accountId : 'all';
    this.state.selectedAccount = normalized;
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.setItem(this._getKeyForNamespace(this.KEYS.SELECTED_ACCOUNT), normalized);
        this._syncKeyToOfflineLocal(storage, this.KEYS.SELECTED_ACCOUNT, normalized);
      } catch (e) {}
    }
    if (!options.suppressEvent) {
      this._emit('account_filter', { silentSync: true, reason: 'select_account', accountId: normalized });
    }
    return normalized;
  },

  loadFromStorage() {
    const bundle = this._readBundleFromNamespace(this.activeNamespace);
    let migratedLegacyAccounts = false;
    const migratedTrades = (bundle.trades || []).map((t) => {
      if (!t || typeof t !== 'object') return t;
      if (!t.accountId || !this.ACCOUNT_DEFINITIONS[t.accountId]) {
        migratedLegacyAccounts = true;
        const info = this.identifyTradeAccount(t);
        const migrated = {
          ...t,
          accountId: info.accountId,
          accountName: info.accountName,
          accountDetectionSource: info.detectionSource,
          accountNeedsReview: Boolean(info.needsReview)
        };
        if (info.reviewReason) migrated.accountReviewReason = info.reviewReason;
        return migrated;
      }
      return t;
    });

    this.state.trades = migratedTrades;
    this.state.lastImport = bundle.lastImport;
    this.state.notes = bundle.notes;
    this.state.rules = bundle.rules;
    this.state.currency = bundle.currency;
    this.state.startingCapital = bundle.startingCapital;
    this.state.mt5Session = bundle.mt5Session;
    this.state.deletedUids = bundle.deletedUids;
    this.state.accounts = this._reconcileAccountsList(migratedTrades, bundle.accounts);
    this.state.selectedAccount = bundle.selectedAccount || 'all';

    if (migratedLegacyAccounts && migratedTrades.length > 0) {
      this._persistTrades();
    }
  },

  /**
   * Read anonymous baseline without touching or polluting the current active namespace
   */
  getAnonymousSnapshot() {
    return this._readBundleFromNamespace('anonymous');
  },

  /**
   * Inspect whether anonymous local storage has any user-created data worth migrating.
   * When `targetSub` is provided and anonymous keys are simply an unmodified offline mirror
   * written by a signed-in Google session, `hasAnyData` stays false so users are never
   * prompted to re-migrate their own mirrored offline cache (or another account's mirror).
   */
  getAnonymousBaselineInfo(targetSub = null) {
    const anon = this.getAnonymousSnapshot();
    const mirrorOwner = this.getOfflineMirrorOwner();
    const isMirroredFromAccount = Boolean(targetSub && mirrorOwner);
    const hasCustomNotes = Boolean(anon.notes && anon.notes.trim().length > 0);
    const hasCustomCapital = Boolean(anon.startingCapital && anon.startingCapital > 0);
    const hasCustomMt5 = Boolean(anon.mt5Session && anon.mt5Session.isConnected);
    const hasNonDefaultRules = Array.isArray(anon.rules) &&
      JSON.stringify(anon.rules) !== JSON.stringify(this.DEFAULT_RULES);
    const rawHasData = anon.trades.length > 0 || hasCustomNotes || hasCustomCapital || hasCustomMt5 || hasNonDefaultRules;
    return {
      tradeCount: anon.trades.length,
      hasTrades: anon.trades.length > 0,
      hasCustomNotes,
      hasCustomCapital,
      hasCustomMt5,
      hasNonDefaultRules,
      mirrorOwner,
      isMirroredFromAccount,
      hasAnyData: isMirroredFromAccount ? false : rawHasData,
      snapshot: anon
    };
  },

  hasTrades() {
    return Array.isArray(this.state.trades) && this.state.trades.length > 0;
  },

  getTrades() {
    return Array.isArray(this.state.trades) ? [...this.state.trades] : [];
  },

  /**
   * Produce a deterministic fingerprint for any stored trade
   * MT5: MT5|<position>|<closeTime>|<lots>|<profit>
   * Exness: EXNESS_<ticket>_<closeTime/openTime>_<lots>_<profit>
   * Zuperior: ZUPERIOR|<symbol>|<type>|<openTime>|<closeTime>|<lots>|<openPrice>|<closePrice>|<profit>
   */
  getTradeFingerprint(t) {
    if (!t) return '';
    if (t.broker === 'mt5' || t.broker === 'mt5_html' || t.broker === 'mt5_xlsx' || String(t.id || '').startsWith('MT5_') || (t.position && !t.broker)) {
      if (typeof TradeParser !== 'undefined' && TradeParser.getMT5Fingerprint) {
        return TradeParser.getMT5Fingerprint(t);
      }
      const pos = String(t.position || t.ticket || '').trim();
      const closeTime = String(t.closeTime || t.openTime || '').trim();
      const lots = Number(t.lots || 0).toFixed(4);
      const profit = Number(t.profit || 0).toFixed(2);
      return ['MT5', pos, closeTime, lots, profit].join('|');
    }
    if (t.broker === 'zuperior' || t.ticket === 'Not provided' || !t.ticket) {
      if (typeof TradeParser !== 'undefined' && TradeParser.getZuperiorFingerprint) {
        return TradeParser.getZuperiorFingerprint(t);
      }
      const sym = String(t.symbol || '').toUpperCase().trim();
      const type = String(t.type || '').toLowerCase().trim();
      const openTime = String(t.openTime || '').trim();
      const closeTime = String(t.closeTime || '').trim();
      const lots = Number(t.lots || 0).toFixed(4);
      const openPrice = Number(t.openPrice || 0).toFixed(5);
      const closePrice = Number(t.closePrice || 0).toFixed(5);
      const profit = Number(t.profit || 0).toFixed(2);
      return ['ZUPERIOR', sym, type, openTime, closeTime, lots, openPrice, closePrice, profit].join('|');
    }
    return `EXNESS_${t.ticket}_${t.closeTime || t.openTime || ''}_${t.lots}_${t.profit}`;
  },

  /**
   * Canonical key for cloud sync & edit tracking (stays stable across edits)
   */
  getTradeSyncKey(t) {
    if (!t) return '';
    if (t.syncId && typeof t.syncId === 'string') return t.syncId;
    return this.getTradeFingerprint(t);
  },

  _normalizeTradeRecord(trade, fallbackSyncId = null) {
    if (!trade || typeof trade !== 'object') return trade;
    const fp = this.getTradeFingerprint(trade);
    const syncId = trade.syncId || fallbackSyncId || fp;
    const hasValidAccount = Boolean(trade.accountId && this.ACCOUNT_DEFINITIONS[trade.accountId]);
    const acctInfo = hasValidAccount
      ? {
          accountId: trade.accountId,
          accountName: trade.accountName || this.ACCOUNT_DEFINITIONS[trade.accountId].name,
          detectionSource: trade.accountDetectionSource || 'stored',
          needsReview: Boolean(trade.accountNeedsReview),
          reviewReason: trade.accountReviewReason || ''
        }
      : this.identifyTradeAccount(trade);

    const normalized = {
      ...trade,
      syncId,
      accountId: acctInfo.accountId,
      accountName: acctInfo.accountName,
      accountDetectionSource: acctInfo.detectionSource,
      accountNeedsReview: Boolean(acctInfo.needsReview),
      updatedAt: trade.updatedAt || new Date().toISOString()
    };
    if (acctInfo.reviewReason) {
      normalized.accountReviewReason = acctInfo.reviewReason;
    } else {
      delete normalized.accountReviewReason;
    }
    return normalized;
  },

  saveTrades(trades, importFileName = 'Trade Log CSV', options = {}) {
    const normalized = Array.isArray(trades)
      ? trades.map(t => this._normalizeTradeRecord(t))
      : [];

    this.state.trades = normalized;
    this.state.lastImport = options.lastImport !== undefined
      ? options.lastImport
      : {
          timestamp: new Date().toISOString(),
          fileName: importFileName,
          count: this.state.trades.length
        };

    // Revive deleted tombstones for explicitly saved trades if present
    if (normalized.length > 0 && Array.isArray(this.state.deletedUids) && this.state.deletedUids.length > 0) {
      const activeKeys = new Set(normalized.map(t => this.getTradeSyncKey(t)));
      this.state.deletedUids = this.state.deletedUids.filter(d => !activeKeys.has(d.key || d));
      this._persistDeletedUids();
    }

    this._persistTrades();
    if (!options.suppressEvent) {
      this._emit('trades', { silentSync: Boolean(options.silentSync), reason: options.reason || 'save_trades' });
    }
    return true;
  },

  _persistTrades() {
    this.state.accounts = this._reconcileAccountsList(this.state.trades, this.state.accounts);

    const storage = this._getStorage();
    if (!storage) return;

    const tradesKey = this._getKeyForNamespace(this.KEYS.TRADES);
    const importKey = this._getKeyForNamespace(this.KEYS.LAST_IMPORT);

    try {
      const tradesJson = JSON.stringify(this.state.trades);
      storage.setItem(tradesKey, tradesJson);
      this._syncKeyToOfflineLocal(storage, this.KEYS.TRADES, tradesJson);
      if (this.state.lastImport) {
        const importJson = JSON.stringify(this.state.lastImport);
        storage.setItem(importKey, importJson);
        this._syncKeyToOfflineLocal(storage, this.KEYS.LAST_IMPORT, importJson);
      } else {
        storage.removeItem(importKey);
        this._syncKeyToOfflineLocal(storage, this.KEYS.LAST_IMPORT, '', { remove: true });
      }
      this._persistAccounts();
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not persist trades to localStorage:', e);
      }
    }
  },

  _persistDeletedUids() {
    const storage = this._getStorage();
    if (!storage) return;
    const delKey = this._getKeyForNamespace(this.KEYS.DELETED_UIDS);
    try {
      if (Array.isArray(this.state.deletedUids) && this.state.deletedUids.length > 0) {
        const delJson = JSON.stringify(this.state.deletedUids.slice(-2000));
        storage.setItem(delKey, delJson);
        this._syncKeyToOfflineLocal(storage, this.KEYS.DELETED_UIDS, delJson);
      } else {
        storage.removeItem(delKey);
        this._syncKeyToOfflineLocal(storage, this.KEYS.DELETED_UIDS, '', { remove: true });
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not persist deleted tombstones:', e);
      }
    }
  },

  mergeTrades(newTrades, importFileName = 'Trade Log CSV', options = {}) {
    if (!Array.isArray(newTrades) || newTrades.length === 0) {
      return { trades: this.getTrades(), addedCount: 0, total: this.state.trades.length };
    }

    const seenKeys = new Set();
    this.state.trades.forEach(t => {
      seenKeys.add(this.getTradeFingerprint(t));
      seenKeys.add(this.getTradeSyncKey(t));
    });

    let addedCount = 0;
    const addedKeys = new Set();

    newTrades.forEach(raw => {
      const fp = this.getTradeFingerprint(raw);
      const syncKey = raw.syncId || fp;
      if (!seenKeys.has(fp) && !seenKeys.has(syncKey)) {
        seenKeys.add(fp);
        seenKeys.add(syncKey);
        addedKeys.add(syncKey);
        addedKeys.add(fp);
        this.state.trades.push(this._normalizeTradeRecord(raw, syncKey));
        addedCount++;
      }
    });

    if (addedKeys.size > 0 && Array.isArray(this.state.deletedUids) && this.state.deletedUids.length > 0) {
      this.state.deletedUids = this.state.deletedUids.filter(d => {
        const key = typeof d === 'string' ? d : (d.key || d.fingerprint);
        return !addedKeys.has(key);
      });
      this._persistDeletedUids();
    }

    const fileLabel = this.state.lastImport && this.state.lastImport.fileName && this.state.lastImport.fileName !== importFileName
      ? `${this.state.lastImport.fileName} + ${importFileName}`
      : importFileName;

    this.state.lastImport = {
      timestamp: new Date().toISOString(),
      fileName: fileLabel,
      count: this.state.trades.length
    };

    this._persistTrades();
    if (addedCount > 0 && !options.suppressEvent) {
      this._emit('trades', { silentSync: Boolean(options.silentSync), reason: 'merge_trades', addedCount });
    }

    return { trades: this.getTrades(), addedCount, total: this.state.trades.length };
  },

  addTrade(trade, options = {}) {
    const normalized = this._normalizeTradeRecord(trade);
    const key = this.getTradeSyncKey(normalized);

    if (Array.isArray(this.state.deletedUids) && this.state.deletedUids.length > 0) {
      this.state.deletedUids = this.state.deletedUids.filter(d => (d.key || d) !== key);
      this._persistDeletedUids();
    }

    this.state.trades.unshift(normalized);
    this.saveTrades(this.state.trades, 'Manual Trade', {
      silentSync: options.silentSync,
      suppressEvent: options.suppressEvent,
      reason: 'add_trade'
    });
    return this.getTrades();
  },

  /**
   * Locate index of a trade matching an object, syncId, fingerprint, id, or ticket
   */
  findTradeIndex(identifier) {
    if (identifier === null || identifier === undefined) return -1;

    if (typeof identifier === 'object') {
      const directIdx = this.state.trades.indexOf(identifier);
      if (directIdx !== -1) return directIdx;

      const targetSyncKey = this.getTradeSyncKey(identifier);
      const targetFp = this.getTradeFingerprint(identifier);
      return this.state.trades.findIndex(t => {
        if (targetSyncKey && this.getTradeSyncKey(t) === targetSyncKey) return true;
        if (targetFp && this.getTradeFingerprint(t) === targetFp) return true;
        if (identifier.id && t.id && String(t.id) === String(identifier.id)) return true;
        if (identifier.ticket && identifier.ticket !== 'Not provided' && String(t.ticket) === String(identifier.ticket)) return true;
        return false;
      });
    }

    const idStr = String(identifier);
    // Exact syncId / fingerprint / id match first so non-unique tickets (e.g. "Not provided") stay safe
    let idx = this.state.trades.findIndex(t =>
      (t.syncId && String(t.syncId) === idStr) ||
      this.getTradeFingerprint(t) === idStr ||
      (t.id && String(t.id) === idStr)
    );
    if (idx !== -1) return idx;

    if (idStr !== 'Not provided' && idStr !== '') {
      idx = this.state.trades.findIndex(t => String(t.ticket) === idStr);
    }
    return idx;
  },

  /**
   * Edit/update an existing trade cleanly while preserving its immutable syncId for multi-device sync
   */
  updateTrade(identifier, patch = {}, options = {}) {
    const idx = this.findTradeIndex(identifier);
    if (idx === -1) return this.getTrades();

    const existing = this.state.trades[idx];
    const stableSyncId = existing.syncId || this.getTradeFingerprint(existing);
    const updatedProfit = patch.profit !== undefined ? Number(patch.profit) : Number(existing.profit);
    const updatedLots = patch.lots !== undefined ? Number(patch.lots) : Number(existing.lots);
    const updatedType = patch.type !== undefined
      ? (String(patch.type).toLowerCase().includes('sell') ? 'sell' : 'buy')
      : existing.type;

    const merged = {
      ...existing,
      ...patch,
      symbol: patch.symbol !== undefined ? String(patch.symbol).toUpperCase().trim() : existing.symbol,
      type: updatedType,
      lots: Number.isFinite(updatedLots) ? updatedLots : existing.lots,
      profit: Number.isFinite(updatedProfit) ? updatedProfit : existing.profit,
      isWin: Number.isFinite(updatedProfit) ? updatedProfit > 0 : existing.isWin,
      isLoss: Number.isFinite(updatedProfit) ? updatedProfit < 0 : existing.isLoss,
      isBreakEven: Number.isFinite(updatedProfit) ? updatedProfit === 0 : existing.isBreakEven,
      syncId: stableSyncId,
      updatedAt: new Date().toISOString()
    };

    this.state.trades[idx] = merged;
    this.saveTrades(
      this.state.trades,
      this.state.lastImport && this.state.lastImport.fileName ? this.state.lastImport.fileName : 'Trade Log CSV',
      {
        lastImport: this.state.lastImport,
        silentSync: options.silentSync,
        suppressEvent: options.suppressEvent,
        reason: 'update_trade'
      }
    );
    return this.getTrades();
  },

  deleteTrade(identifier, options = {}) {
    const idx = this.findTradeIndex(identifier);
    const nowIso = new Date().toISOString();
    let removedTrades = [];

    if (idx !== -1 && typeof identifier === 'object') {
      removedTrades = [this.state.trades[idx]];
      this.state.trades = this.state.trades.filter((_, i) => i !== idx);
    } else if (identifier !== null && identifier !== undefined) {
      const idStr = String(identifier);
      const isSpecificKey = this.state.trades.some(t =>
        (t.syncId && String(t.syncId) === idStr) ||
        this.getTradeFingerprint(t) === idStr ||
        (t.id && String(t.id) === idStr)
      );

      this.state.trades = this.state.trades.filter(t => {
        const match = isSpecificKey
          ? ((t.syncId && String(t.syncId) === idStr) ||
             this.getTradeFingerprint(t) === idStr ||
             (t.id && String(t.id) === idStr))
          : (String(t.ticket) === idStr || (t.id && String(t.id) === idStr));
        if (match) {
          removedTrades.push(t);
          return false;
        }
        return true;
      });
    }

    if (removedTrades.length > 0) {
      const existingDelMap = new Map();
      (this.state.deletedUids || []).forEach(d => {
        const k = typeof d === 'string' ? d : (d.key || d.fingerprint);
        if (k) existingDelMap.set(k, typeof d === 'string' ? { key: k, fingerprint: k, deletedAt: nowIso } : d);
      });

      removedTrades.forEach(t => {
        const key = this.getTradeSyncKey(t);
        const fp = this.getTradeFingerprint(t);
        if (key) {
          existingDelMap.set(key, { key, fingerprint: fp || key, deletedAt: nowIso });
        }
      });

      this.state.deletedUids = Array.from(existingDelMap.values()).slice(-2000);
      this._persistDeletedUids();
    }

    this.saveTrades(
      this.state.trades,
      this.state.lastImport && this.state.lastImport.fileName ? this.state.lastImport.fileName : 'Trade Log CSV',
      {
        silentSync: options.silentSync,
        suppressEvent: options.suppressEvent,
        reason: 'delete_trade'
      }
    );
    return this.getTrades();
  },

  clearAll(options = {}) {
    const nowIso = new Date().toISOString();
    if (options.recordTombstones !== false && Array.isArray(this.state.trades) && this.state.trades.length > 0) {
      const delMap = new Map();
      (this.state.deletedUids || []).forEach(d => {
        const k = typeof d === 'string' ? d : (d.key || d.fingerprint);
        if (k) delMap.set(k, typeof d === 'string' ? { key: k, fingerprint: k, deletedAt: nowIso } : d);
      });
      this.state.trades.forEach(t => {
        const key = this.getTradeSyncKey(t);
        const fp = this.getTradeFingerprint(t);
        if (key) delMap.set(key, { key, fingerprint: fp || key, deletedAt: nowIso });
      });
      this.state.deletedUids = Array.from(delMap.values()).slice(-2000);
      this._persistDeletedUids();
    }

    this.state.trades = [];
    this.state.lastImport = null;
    this.state.accounts = [];
    this.state.selectedAccount = 'all';
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.removeItem(this._getKeyForNamespace(this.KEYS.TRADES));
        storage.removeItem(this._getKeyForNamespace(this.KEYS.LAST_IMPORT));
        storage.removeItem(this._getKeyForNamespace(this.KEYS.ACCOUNTS));
        storage.setItem(this._getKeyForNamespace(this.KEYS.SELECTED_ACCOUNT), 'all');
        this._syncKeyToOfflineLocal(storage, this.KEYS.TRADES, '', { remove: true });
        this._syncKeyToOfflineLocal(storage, this.KEYS.LAST_IMPORT, '', { remove: true });
        this._syncKeyToOfflineLocal(storage, this.KEYS.ACCOUNTS, '', { remove: true });
        this._syncKeyToOfflineLocal(storage, this.KEYS.SELECTED_ACCOUNT, 'all');
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not remove trades from localStorage:', e);
        }
      }
    }

    if (!options.suppressEvent) {
      this._emit('trades', { silentSync: Boolean(options.silentSync), reason: 'clear_all' });
    }
  },

  getDeletedUids() {
    return Array.isArray(this.state.deletedUids) ? [...this.state.deletedUids] : [];
  },

  setDeletedUids(list, options = {}) {
    this.state.deletedUids = Array.isArray(list) ? [...list].slice(-2000) : [];
    this._persistDeletedUids();
    if (!options.suppressEvent && !options.silentSync) {
      this._emit('trades', { silentSync: false, reason: 'set_deleted_uids' });
    }
  },

  getLastImportInfo() {
    return this.state.lastImport;
  },

  setLastImportInfo(info, options = {}) {
    this.state.lastImport = info;
    const storage = this._getStorage();
    if (storage) {
      const importKey = this._getKeyForNamespace(this.KEYS.LAST_IMPORT);
      try {
        if (info) {
          const json = JSON.stringify(info);
          storage.setItem(importKey, json);
          this._syncKeyToOfflineLocal(storage, this.KEYS.LAST_IMPORT, json);
        } else {
          storage.removeItem(importKey);
          this._syncKeyToOfflineLocal(storage, this.KEYS.LAST_IMPORT, '', { remove: true });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist last import info:', e);
        }
      }
    }
    if (!options.suppressEvent && !options.silentSync) {
      this._emit('trades', { silentSync: false, reason: 'set_last_import' });
    }
  },

  getNotes() {
    return this.state.notes || '';
  },

  saveNotes(notes, options = {}) {
    this.state.notes = notes || '';
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.setItem(this._getKeyForNamespace(this.KEYS.NOTES), this.state.notes);
        this._syncKeyToOfflineLocal(storage, this.KEYS.NOTES, this.state.notes);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist notes to localStorage:', e);
        }
      }
    }
    if (!options.suppressEvent) {
      this._emit('settings', { silentSync: Boolean(options.silentSync), reason: 'save_notes' });
    }
  },

  getDefaultRules() {
    return this.DEFAULT_RULES.map(r => ({ ...r }));
  },

  getRules() {
    return Array.isArray(this.state.rules) ? this.state.rules.map(r => ({ ...r })) : this.getDefaultRules();
  },

  saveRules(rules, options = {}) {
    this.state.rules = Array.isArray(rules) ? rules : null;
    const storage = this._getStorage();
    if (storage) {
      const rulesKey = this._getKeyForNamespace(this.KEYS.RULES);
      try {
        if (this.state.rules) {
          const rulesJson = JSON.stringify(this.state.rules);
          storage.setItem(rulesKey, rulesJson);
          this._syncKeyToOfflineLocal(storage, this.KEYS.RULES, rulesJson);
        } else {
          storage.removeItem(rulesKey);
          this._syncKeyToOfflineLocal(storage, this.KEYS.RULES, '', { remove: true });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist rules to localStorage:', e);
        }
      }
    }
    if (!options.suppressEvent) {
      this._emit('settings', { silentSync: Boolean(options.silentSync), reason: 'save_rules' });
    }
  },

  getCurrency() {
    return this.state.currency === 'INR' ? 'INR' : 'USD';
  },

  saveCurrency(curr, options = {}) {
    this.state.currency = curr === 'INR' ? 'INR' : 'USD';
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.setItem(this._getKeyForNamespace(this.KEYS.CURRENCY), this.state.currency);
        this._syncKeyToOfflineLocal(storage, this.KEYS.CURRENCY, this.state.currency);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist currency to localStorage:', e);
        }
      }
    }
    if (!options.suppressEvent) {
      this._emit('settings', { silentSync: Boolean(options.silentSync), reason: 'save_currency' });
    }
    return this.state.currency;
  },

  getStartingCapital() {
    if (this.state.startingCapital !== null && this.state.startingCapital !== undefined && !isNaN(Number(this.state.startingCapital)) && Number(this.state.startingCapital) > 0) {
      return Number(this.state.startingCapital);
    }
    if (typeof TradeAnalytics !== 'undefined' && TradeAnalytics.getStartingCapital && this.activeNamespace === 'anonymous') {
      return TradeAnalytics.getStartingCapital();
    }
    return null;
  },

  saveStartingCapital(val, options = {}) {
    const cleaned = (val === null || val === undefined || val === '' || isNaN(Number(val)) || Number(val) <= 0)
      ? null
      : Math.round(Number(val) * 100) / 100;

    this.state.startingCapital = cleaned;
    const storage = this._getStorage();
    if (storage) {
      const capKey = this._getKeyForNamespace(this.KEYS.STARTING_CAPITAL);
      try {
        if (cleaned !== null) {
          storage.setItem(capKey, String(cleaned));
          this._syncKeyToOfflineLocal(storage, this.KEYS.STARTING_CAPITAL, String(cleaned));
        } else {
          storage.removeItem(capKey);
          this._syncKeyToOfflineLocal(storage, this.KEYS.STARTING_CAPITAL, '', { remove: true });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist starting capital to localStorage:', e);
        }
      }
    }

    if (!options.suppressEvent) {
      this._emit('settings', { silentSync: Boolean(options.silentSync), reason: 'save_starting_capital' });
    }
    return cleaned;
  },

  getMt5Session() {
    return this.state.mt5Session || null;
  },

  saveMt5Session(sessionObj, options = {}) {
    this.state.mt5Session = sessionObj && typeof sessionObj === 'object' ? sessionObj : null;
    const storage = this._getStorage();
    if (storage) {
      const mt5Key = this._getKeyForNamespace(this.KEYS.MT5_SESSION);
      try {
        if (this.state.mt5Session) {
          const mt5Json = JSON.stringify(this.state.mt5Session);
          storage.setItem(mt5Key, mt5Json);
          this._syncKeyToOfflineLocal(storage, this.KEYS.MT5_SESSION, mt5Json);
        } else {
          storage.removeItem(mt5Key);
          this._syncKeyToOfflineLocal(storage, this.KEYS.MT5_SESSION, '', { remove: true });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist MT5 session to localStorage:', e);
        }
      }
    }
    if (!options.suppressEvent) {
      this._emit('accounts', { silentSync: Boolean(options.silentSync), reason: 'save_mt5_session' });
    }
    return this.state.mt5Session;
  },

  /**
   * Export complete normalized snapshot of the currently active namespace
   */
  exportActiveSnapshot() {
    return {
      trades: this.getTrades(),
      lastImport: this.state.lastImport ? { ...this.state.lastImport } : null,
      deletedUids: this.getDeletedUids(),
      notes: this.getNotes(),
      rules: this.getRules(),
      currency: this.getCurrency(),
      startingCapital: this.getStartingCapital(),
      mt5Session: this.getMt5Session(),
      accounts: this.getAccounts()
    };
  },

  /**
   * Atomically hydrate the current active namespace from a snapshot (used by cloud restore/sync)
   */
  applySnapshot(snapshot = {}, options = { silentSync: true }) {
    const silentSync = options.silentSync !== undefined ? Boolean(options.silentSync) : true;
    const trades = Array.isArray(snapshot.trades) ? snapshot.trades : [];
    const deletedUids = Array.isArray(snapshot.deletedUids) ? snapshot.deletedUids : [];

    this.state.deletedUids = deletedUids.slice(-2000);
    this._persistDeletedUids();

    if (Array.isArray(snapshot.accounts)) {
      this.state.accounts = snapshot.accounts;
    }

    this.saveTrades(trades, snapshot.lastImport?.fileName || 'Google Drive Sync', {
      lastImport: snapshot.lastImport || (trades.length > 0 ? { timestamp: new Date().toISOString(), fileName: 'Google Drive Sync', count: trades.length } : null),
      silentSync,
      suppressEvent: true
    });

    if (snapshot.notes !== undefined) {
      this.saveNotes(snapshot.notes, { silentSync, suppressEvent: true });
    }
    if (snapshot.rules !== undefined) {
      this.saveRules(snapshot.rules, { silentSync, suppressEvent: true });
    }
    if (snapshot.currency !== undefined) {
      this.saveCurrency(snapshot.currency, { silentSync, suppressEvent: true });
    }
    if (snapshot.startingCapital !== undefined) {
      this.saveStartingCapital(snapshot.startingCapital, { silentSync, suppressEvent: true });
    }
    if (snapshot.mt5Session !== undefined) {
      this.saveMt5Session(snapshot.mt5Session, { silentSync, suppressEvent: true });
    }

    if (!options.suppressEvent) {
      this._emit('all', { silentSync, reason: options.reason || 'apply_snapshot' });
    }
    return this.exportActiveSnapshot();
  }
};

// Initialize from storage on script evaluation
StorageManager.init();

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.StorageManager = StorageManager;
}
