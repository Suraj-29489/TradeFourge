/**
 * TradeForge - Storage Manager
 * Handles browser-side persistent storage (localStorage) for trade data, settings & notebook.
 */

const StorageManager = {
  KEYS: {
    TRADES: 'tradeforge_trades',
    LAST_IMPORT: 'tradeforge_last_import',
    NOTES: 'tradeforge_notes',
    RULES: 'tradeforge_rules',
    USER_SETTINGS: 'tradeforge_settings'
  },

  /**
   * Check if trades are already stored in localStorage
   */
  hasTrades() {
    try {
      const data = localStorage.getItem(this.KEYS.TRADES);
      return Boolean(data && JSON.parse(data).length > 0);
    } catch (e) {
      return false;
    }
  },

  /**
   * Retrieve all trades from localStorage
   */
  getTrades() {
    try {
      const data = localStorage.getItem(this.KEYS.TRADES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading trades from localStorage:', e);
      return [];
    }
  },

  /**
   * Save trades list to localStorage
   */
  saveTrades(trades, importFileName = 'Trade Log CSV') {
    try {
      localStorage.setItem(this.KEYS.TRADES, JSON.stringify(trades));
      this.setLastImportInfo({
        timestamp: new Date().toISOString(),
        fileName: importFileName,
        count: trades.length
      });
      return true;
    } catch (e) {
      console.error('Error saving trades to localStorage:', e);
      return false;
    }
  },

  /**
   * Append a single manual trade
   */
  addTrade(trade) {
    const trades = this.getTrades();
    trades.unshift(trade);
    this.saveTrades(trades, 'Manual Trade');
    return trades;
  },

  /**
   * Delete trade by ticket / id
   */
  deleteTrade(ticket) {
    const trades = this.getTrades().filter(t => String(t.ticket) !== String(ticket));
    this.saveTrades(trades);
    return trades;
  },

  /**
   * Clear all trade data
   */
  clearAll() {
    localStorage.removeItem(this.KEYS.TRADES);
    localStorage.removeItem(this.KEYS.LAST_IMPORT);
  },

  /**
   * Get Last Import metadata
   */
  getLastImportInfo() {
    try {
      const info = localStorage.getItem(this.KEYS.LAST_IMPORT);
      return info ? JSON.parse(info) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Set Last Import metadata
   */
  setLastImportInfo(info) {
    try {
      localStorage.setItem(this.KEYS.LAST_IMPORT, JSON.stringify(info));
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * Get trading notes
   */
  getNotes() {
    return localStorage.getItem(this.KEYS.NOTES) || '';
  },

  /**
   * Save trading notes
   */
  saveNotes(notes) {
    localStorage.setItem(this.KEYS.NOTES, notes);
  },

  /**
   * Get trading rules checklist
   */
  getRules() {
    try {
      const rules = localStorage.getItem(this.KEYS.RULES);
      return rules ? JSON.parse(rules) : [
        { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
        { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
        { id: 3, text: 'Always set a stop loss before entering position', checked: true },
        { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
        { id: 5, text: 'Accept take-profit targets without greed', checked: true }
      ];
    } catch (e) {
      return [];
    }
  },

  /**
   * Save trading rules checklist
   */
  saveRules(rules) {
    localStorage.setItem(this.KEYS.RULES, JSON.stringify(rules));
  }
};

