/**
 * TradeForge - in-memory data manager.
 * Imported data lives only in the current page session and is discarded on reload.
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

  resetForNewSession() {
    this.state = { trades: [], lastImport: null, notes: '', rules: null };
    try {
      Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Could not clear legacy browser data:', e);
    }
  },

  hasTrades() {
    return this.state.trades.length > 0;
  },

  getTrades() {
    return [...this.state.trades];
  },

  saveTrades(trades, importFileName = 'Trade Log CSV') {
    this.state.trades = Array.isArray(trades) ? [...trades] : [];
    this.state.lastImport = {
      timestamp: new Date().toISOString(),
      fileName: importFileName,
      count: this.state.trades.length
    };
    return true;
  },

  addTrade(trade) {
    this.state.trades.unshift(trade);
    this.saveTrades(this.state.trades, 'Manual Trade');
    return this.getTrades();
  },

  deleteTrade(ticket) {
    this.state.trades = this.state.trades.filter(t => String(t.ticket) !== String(ticket));
    return this.getTrades();
  },

  clearAll() {
    this.state.trades = [];
    this.state.lastImport = null;
  },

  getLastImportInfo() {
    return this.state.lastImport;
  },

  setLastImportInfo(info) {
    this.state.lastImport = info;
  },

  getNotes() {
    return this.state.notes;
  },

  saveNotes(notes) {
    this.state.notes = notes || '';
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
  }
};
