/**
 * TradeForge - Local Storage & Data Persistence Manager.
 * Persists trade datasets, notes, and rules in browser localStorage.
 */

const StorageManager = {
  KEYS: {
    TRADES: 'tradeforge_trades',
    LAST_IMPORT: 'tradeforge_last_import',
    NOTES: 'tradeforge_notes',
    RULES: 'tradeforge_rules',
    USER_SETTINGS: 'tradeforge_settings'
  },

  state: {
    trades: [],
    lastImport: null,
    notes: '',
    rules: null
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
   * Initialize StorageManager and hydrate state from browser localStorage
   */
  init() {
    this.loadFromStorage();
  },

  loadFromStorage() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      const rawTrades = storage.getItem(this.KEYS.TRADES);
      if (rawTrades) {
        const parsed = JSON.parse(rawTrades);
        if (Array.isArray(parsed)) {
          // Validate trade items: ensure each is a non-null object
          this.state.trades = parsed.filter(t => t && typeof t === 'object' && (t.ticket !== undefined || t.id !== undefined || t.symbol !== undefined));
        } else {
          this.state.trades = [];
        }
      } else {
        this.state.trades = [];
      }

      const rawImport = storage.getItem(this.KEYS.LAST_IMPORT);
      if (rawImport) {
        try {
          this.state.lastImport = JSON.parse(rawImport);
        } catch (e) {
          this.state.lastImport = null;
        }
      } else {
        this.state.lastImport = null;
      }

      const rawNotes = storage.getItem(this.KEYS.NOTES);
      if (rawNotes !== null) {
        this.state.notes = rawNotes;
      }

      const rawRules = storage.getItem(this.KEYS.RULES);
      if (rawRules) {
        try {
          this.state.rules = JSON.parse(rawRules);
        } catch (e) {
          this.state.rules = null;
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('Could not load data from localStorage:', e);
      this.state.trades = [];
      this.state.lastImport = null;
    }
  },

  hasTrades() {
    return Array.isArray(this.state.trades) && this.state.trades.length > 0;
  },

  getTrades() {
    return Array.isArray(this.state.trades) ? [...this.state.trades] : [];
  },

  /**
   * Produce a deterministic fingerprint for any stored trade
   * Exness: EXNESS_<ticket>_<closeTime/openTime>_<lots>_<profit>
   * Zuperior: ZUPERIOR|<symbol>|<type>|<openTime>|<closeTime>|<lots>|<openPrice>|<closePrice>|<profit>
   */
  getTradeFingerprint(t) {
    if (!t) return '';
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

  saveTrades(trades, importFileName = 'Trade Log CSV') {
    this.state.trades = Array.isArray(trades) ? [...trades] : [];
    this.state.lastImport = {
      timestamp: new Date().toISOString(),
      fileName: importFileName,
      count: this.state.trades.length
    };
    this._persistTrades();
    return true;
  },

  _persistTrades() {
    const storage = this._getStorage();
    if (!storage) return;

    try {
      storage.setItem(this.KEYS.TRADES, JSON.stringify(this.state.trades));
      if (this.state.lastImport) {
        storage.setItem(this.KEYS.LAST_IMPORT, JSON.stringify(this.state.lastImport));
      } else {
        storage.removeItem(this.KEYS.LAST_IMPORT);
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('Could not persist trades to localStorage:', e);
    }
  },

  mergeTrades(newTrades, importFileName = 'Trade Log CSV') {
    if (!Array.isArray(newTrades) || newTrades.length === 0) {
      return { trades: this.getTrades(), addedCount: 0, total: this.state.trades.length };
    }

    const seen = new Set(this.state.trades.map(t => this.getTradeFingerprint(t)));
    let addedCount = 0;

    newTrades.forEach(t => {
      const key = this.getTradeFingerprint(t);
      if (!seen.has(key)) {
        seen.add(key);
        this.state.trades.push(t);
        addedCount++;
      }
    });

    const fileLabel = this.state.lastImport && this.state.lastImport.fileName && this.state.lastImport.fileName !== importFileName
      ? `${this.state.lastImport.fileName} + ${importFileName}`
      : importFileName;

    this.state.lastImport = {
      timestamp: new Date().toISOString(),
      fileName: fileLabel,
      count: this.state.trades.length
    };

    this._persistTrades();

    return { trades: this.getTrades(), addedCount, total: this.state.trades.length };
  },

  addTrade(trade) {
    this.state.trades.unshift(trade);
    this.saveTrades(this.state.trades, 'Manual Trade');
    return this.getTrades();
  },

  deleteTrade(identifier) {
    this.state.trades = this.state.trades.filter(t => {
      if (String(t.ticket) === String(identifier)) return false;
      if (t.id && String(t.id) === String(identifier)) return false;
      return true;
    });
    this.saveTrades(this.state.trades, this.state.lastImport && this.state.lastImport.fileName ? this.state.lastImport.fileName : 'Trade Log CSV');
    return this.getTrades();
  },

  clearAll() {
    this.state.trades = [];
    this.state.lastImport = null;
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.removeItem(this.KEYS.TRADES);
        storage.removeItem(this.KEYS.LAST_IMPORT);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Could not remove trades from localStorage:', e);
      }
    }
  },

  getLastImportInfo() {
    return this.state.lastImport;
  },

  setLastImportInfo(info) {
    this.state.lastImport = info;
    const storage = this._getStorage();
    if (storage) {
      try {
        if (info) {
          storage.setItem(this.KEYS.LAST_IMPORT, JSON.stringify(info));
        } else {
          storage.removeItem(this.KEYS.LAST_IMPORT);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Could not persist last import info:', e);
      }
    }
  },

  getNotes() {
    return this.state.notes;
  },

  saveNotes(notes) {
    this.state.notes = notes || '';
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.setItem(this.KEYS.NOTES, this.state.notes);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Could not persist notes to localStorage:', e);
      }
    }
  },

  getRules() {
    return this.state.rules || [
      { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
      { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
      { id: 3, text: 'Always set a stop loss before entering position', checked: true },
      { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
      { id: 5, text: 'Accept take-profit targets without greed', checked: true }
    ];
  },

  saveRules(rules) {
    this.state.rules = Array.isArray(rules) ? rules : null;
    const storage = this._getStorage();
    if (storage) {
      try {
        if (this.state.rules) {
          storage.setItem(this.KEYS.RULES, JSON.stringify(this.state.rules));
        } else {
          storage.removeItem(this.KEYS.RULES);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Could not persist rules to localStorage:', e);
      }
    }
  },

  getStartingCapital() {
    return (typeof TradeAnalytics !== 'undefined' && TradeAnalytics.getStartingCapital) 
      ? TradeAnalytics.getStartingCapital() 
      : null;
  },

  saveStartingCapital(val) {
    return (typeof TradeAnalytics !== 'undefined' && TradeAnalytics.setStartingCapital) 
      ? TradeAnalytics.setStartingCapital(val) 
      : null;
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
