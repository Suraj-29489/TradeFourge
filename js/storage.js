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
    DELETED_UIDS: 'tradefourge_deleted_uids'
  },

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
    deletedUids: []
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
      deletedUids: []
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

  loadFromStorage() {
    const bundle = this._readBundleFromNamespace(this.activeNamespace);
    this.state.trades = bundle.trades;
    this.state.lastImport = bundle.lastImport;
    this.state.notes = bundle.notes;
    this.state.rules = bundle.rules;
    this.state.currency = bundle.currency;
    this.state.startingCapital = bundle.startingCapital;
    this.state.mt5Session = bundle.mt5Session;
    this.state.deletedUids = bundle.deletedUids;
  },

  /**
   * Read anonymous baseline without touching or polluting the current active namespace
   */
  getAnonymousSnapshot() {
    return this._readBundleFromNamespace('anonymous');
  },

  /**
   * Inspect whether anonymous local storage has any user-created data worth migrating
   */
  getAnonymousBaselineInfo() {
    const anon = this.getAnonymousSnapshot();
    const hasCustomNotes = Boolean(anon.notes && anon.notes.trim().length > 0);
    const hasCustomCapital = Boolean(anon.startingCapital && anon.startingCapital > 0);
    const hasCustomMt5 = Boolean(anon.mt5Session && anon.mt5Session.isConnected);
    const hasNonDefaultRules = Array.isArray(anon.rules) &&
      JSON.stringify(anon.rules) !== JSON.stringify(this.DEFAULT_RULES);
    return {
      tradeCount: anon.trades.length,
      hasTrades: anon.trades.length > 0,
      hasCustomNotes,
      hasCustomCapital,
      hasCustomMt5,
      hasNonDefaultRules,
      hasAnyData: anon.trades.length > 0 || hasCustomNotes || hasCustomCapital || hasCustomMt5 || hasNonDefaultRules,
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
    return {
      ...trade,
      syncId,
      updatedAt: trade.updatedAt || new Date().toISOString()
    };
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
    const storage = this._getStorage();
    if (!storage) return;

    const tradesKey = this._getKeyForNamespace(this.KEYS.TRADES);
    const importKey = this._getKeyForNamespace(this.KEYS.LAST_IMPORT);

    try {
      storage.setItem(tradesKey, JSON.stringify(this.state.trades));
      if (this.state.lastImport) {
        storage.setItem(importKey, JSON.stringify(this.state.lastImport));
      } else {
        storage.removeItem(importKey);
      }
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
        storage.setItem(delKey, JSON.stringify(this.state.deletedUids.slice(-2000)));
      } else {
        storage.removeItem(delKey);
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
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.removeItem(this._getKeyForNamespace(this.KEYS.TRADES));
        storage.removeItem(this._getKeyForNamespace(this.KEYS.LAST_IMPORT));
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
          storage.setItem(importKey, JSON.stringify(info));
        } else {
          storage.removeItem(importKey);
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
          storage.setItem(rulesKey, JSON.stringify(this.state.rules));
        } else {
          storage.removeItem(rulesKey);
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
        } else {
          storage.removeItem(capKey);
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
          storage.setItem(mt5Key, JSON.stringify(this.state.mt5Session));
        } else {
          storage.removeItem(mt5Key);
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
      mt5Session: this.getMt5Session()
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
