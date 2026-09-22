/**
 * TradeForge CSV parser.
 * One unique ticket is treated as one trade.
 * Supports Exness and Zuperior broker CSV formats.
 */

const TradeParser = {
  /**
   * Inspect CSV headers to detect broker format
   * @param {string} csvText
   * @returns {'exness' | 'zuperior' | 'unknown'}
   */
  detectBroker(csvText) {
    if (!csvText || typeof csvText !== 'string') return 'unknown';
    const rows = this.parseCSVRecords(csvText);
    if (!rows || rows.length < 1) return 'unknown';

    const cleanHeaders = rows[0].map(h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Check for Exness signature: contains ticket identifier
    const hasTicket = cleanHeaders.some(h => ['ticket', 'ticketnumber', 'ticketid', 'orderid', 'positionid', 'tradeid'].includes(h));

    // Check for Zuperior characteristic headers:
    // Symbol, Type, Open Time, Close Time, Volume, Open Price, Close Price, Profit
    const hasZupSymbol = cleanHeaders.includes('symbol');
    const hasZupType = cleanHeaders.includes('type');
    const hasZupOpenTime = cleanHeaders.some(h => ['opentime', 'openingtime', 'timeopen', 'opened', 'entrytime'].includes(h));
    const hasZupCloseTime = cleanHeaders.some(h => ['closetime', 'closingtime', 'timeclose', 'closed', 'exittime'].includes(h));
    const hasZupVolume = cleanHeaders.some(h => ['volume', 'vol', 'lots', 'lotsize', 'quantity', 'qty'].includes(h));
    const hasZupProfit = cleanHeaders.some(h => ['profit', 'pnl', 'netprofit', 'realizedpnl', 'gainloss', 'pandl'].includes(h));

    if (!hasTicket && hasZupSymbol && hasZupType && hasZupOpenTime && hasZupCloseTime && hasZupVolume && hasZupProfit) {
      return 'zuperior';
    }

    if (hasTicket) {
      return 'exness';
    }

    return 'unknown';
  },

  /**
   * Main CSV parse entrypoint
   * @param {string} csvText 
   * @param {'exness' | 'zuperior' | null} brokerPreference 
   * @returns {Array<Object>}
   */
  parseCSV(csvText, brokerPreference = null) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Invalid CSV data provided.');
    }

    const detected = brokerPreference || this.detectBroker(csvText);

    if (detected === 'zuperior') {
      return this.parseZuperior(csvText);
    } else if (detected === 'exness') {
      return this.parseExness(csvText);
    } else {
      // Ambiguous/unknown: try Exness first, fallback to Zuperior if Exness fails
      try {
        return this.parseExness(csvText);
      } catch (e) {
        return this.parseZuperior(csvText);
      }
    }
  },

  /**
   * Dedicated Exness CSV Parser
   */
  parseExness(csvText) {
    const rows = this.parseCSVRecords(csvText);
    if (rows.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    const headerMap = this.mapHeaders(rows[0]);
    const requiredFields = ['ticket', 'type', 'lots', 'symbol', 'profit'];
    const missingFields = requiredFields.filter(field => headerMap[field] === undefined);
    if (missingFields.length) {
      throw new Error(`Exness CSV needs these columns: ${missingFields.join(', ')}.`);
    }

    const seenRecords = new Set();
    const trades = [];

    rows.slice(1).forEach((values, index) => {
      const trade = this.normalizeTradeRow(values, headerMap, index + 1);
      if (!trade) return;

      trade.broker = 'exness';

      // Full execution signature for true duplicate detection
      const recordKey = [
        'EXNESS',
        trade.ticket,
        trade.openTime,
        trade.closeTime,
        trade.type,
        trade.lots,
        trade.symbol,
        trade.openPrice,
        trade.closePrice,
        trade.profit,
        trade.closeReason
      ].join('|');

      if (seenRecords.has(recordKey)) return;
      seenRecords.add(recordKey);

      // Unique internal record identifier
      trade.id = `${trade.ticket}_${trade.closeTime || trade.openTime}_${index + 1}`;

      trades.push(trade);
    });

    if (!trades.length) {
      throw new Error('No valid unique trades could be parsed from this Exness CSV.');
    }

    // Recognize partial-close patterns
    const ticketCounts = {};
    trades.forEach(t => {
      ticketCounts[t.ticket] = (ticketCounts[t.ticket] || 0) + 1;
    });

    trades.forEach(t => {
      if (ticketCounts[t.ticket] > 1) {
        t.closeType = 'partial';
        t.isPartialClose = true;
      } else {
        t.closeType = 'full';
        t.isPartialClose = false;
      }
    });

    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));
    return trades;
  },

  /**
   * Dedicated Zuperior CSV Parser
   */
  parseZuperior(csvText) {
    const rows = this.parseCSVRecords(csvText);
    if (rows.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    const headerMap = this.mapZuperiorHeaders(rows[0]);
    const requiredFields = ['symbol', 'type', 'openTime', 'closeTime', 'volume', 'profit'];
    const missingFields = requiredFields.filter(field => headerMap[field] === undefined);
    if (missingFields.length) {
      throw new Error(`Zuperior CSV needs these columns: ${missingFields.join(', ')}.`);
    }

    const seenFingerprints = new Set();
    const trades = [];

    rows.slice(1).forEach((values, index) => {
      const trade = this.normalizeZuperiorRow(values, headerMap, index + 1);
      if (!trade) return;

      const fingerprint = this.getZuperiorFingerprint(trade);
      if (seenFingerprints.has(fingerprint)) return;
      seenFingerprints.add(fingerprint);

      trade.broker = 'zuperior';
      trade.id = `ZUP_${index + 1}_${trade.closeTime || trade.openTime}_${Math.abs(Math.round(trade.profit * 100))}`;

      trades.push(trade);
    });

    if (!trades.length) {
      throw new Error('No valid unique trades could be parsed from this Zuperior CSV.');
    }

    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));
    return trades;
  },

  /**
   * Generate a deterministic fingerprint for a Zuperior trade
   */
  getZuperiorFingerprint(trade) {
    if (!trade) return '';
    const sym = String(trade.symbol || '').toUpperCase().trim();
    const type = String(trade.type || '').toLowerCase().trim();
    const openTime = String(trade.openTime || '').trim();
    const closeTime = String(trade.closeTime || '').trim();
    const lots = Number(trade.lots || 0).toFixed(4);
    const openPrice = Number(trade.openPrice || 0).toFixed(5);
    const closePrice = Number(trade.closePrice || 0).toFixed(5);
    const profit = Number(trade.profit || 0).toFixed(2);

    return ['ZUPERIOR', sym, type, openTime, closeTime, lots, openPrice, closePrice, profit].join('|');
  },

  mapZuperiorHeaders(headers) {
    const map = {};
    const cleanHeaders = headers.map(header => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    const aliases = {
      symbol: ['symbol', 'pair', 'instrument', 'ticker', 'market', 'asset'],
      type: ['type', 'side', 'action', 'direction', 'buysell'],
      openTime: ['opentime', 'openingtime', 'timeopen', 'opened', 'entrytime'],
      closeTime: ['closetime', 'closingtime', 'timeclose', 'closed', 'exittime'],
      volume: ['volume', 'vol', 'lots', 'lotsize', 'quantity', 'qty'],
      openPrice: ['openprice', 'openingprice', 'entryprice', 'priceopen'],
      closePrice: ['closeprice', 'closingprice', 'exitprice', 'priceclose'],
      profit: ['profit', 'pnl', 'netprofit', 'realizedpnl', 'gainloss', 'pandl']
    };

    Object.entries(aliases).forEach(([field, names]) => {
      const index = cleanHeaders.findIndex(header => names.includes(header));
      if (index !== -1) map[field] = index;
    });
    return map;
  },

  normalizeZuperiorRow(values, headerMap, rowIndex) {
    const get = field => {
      const index = headerMap[field];
      return index === undefined ? '' : (values[index] ?? '').trim();
    };

    const rawSymbol = get('symbol');
    const rawType = get('type').toLowerCase();
    const rawOpenTime = get('openTime');
    const rawCloseTime = get('closeTime');
    const volume = this.parseNumber(get('volume'));
    const profit = this.parseNumber(get('profit'));

    if (!rawSymbol || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(profit)) {
      return null;
    }

    const type = rawType.includes('sell') || rawType.includes('short')
      ? 'sell'
      : (rawType.includes('buy') || rawType.includes('long') ? 'buy' : null);
    if (!type) return null;

    const parseTime = (str) => {
      if (!str) return new Date().toISOString();
      const d = new Date(str);
      return !isNaN(d.getTime()) ? d.toISOString() : str;
    };

    const openTime = parseTime(rawOpenTime);
    const closeTime = rawCloseTime ? parseTime(rawCloseTime) : openTime;

    const openPrice = this.parseNumber(get('openPrice'));
    const closePrice = this.parseNumber(get('closePrice'));

    return {
      ticket: 'Not provided',
      broker: 'zuperior',
      openTime,
      closeTime,
      type,
      lots: volume,
      originalPositionSize: volume,
      symbol: rawSymbol, // Preserve exact casing e.g. XAUUSDm
      openPrice: Number.isFinite(openPrice) ? openPrice : 0,
      closePrice: Number.isFinite(closePrice) ? closePrice : 0,
      stopLoss: null,
      takeProfit: null,
      commission: 0,
      swap: 0,
      profit: Math.round(profit * 100) / 100,
      closeReason: 'user',
      isWin: profit > 0,
      isLoss: profit < 0,
      isBreakEven: profit === 0,
      closeType: 'full',
      isPartialClose: false
    };
  },

  parseCSVRecords(csvText) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const next = csvText[i + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          value += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        row.push(value.trim());
        value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(value.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    return rows;
  },

  parseCSVLine(line) {
    return this.parseCSVRecords(line)[0] || [];
  },

  mapHeaders(headers) {
    const map = {};
    const cleanHeaders = headers.map(header => String(header).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const aliases = {
      ticket: ['ticket', 'ticketnumber', 'ticketid', 'orderid', 'positionid', 'tradeid'],
      openTime: ['openingtimeutc', 'openingtime', 'opentime', 'entrytime', 'timeopen', 'opened'],
      closeTime: ['closingtimeutc', 'closingtime', 'closetime', 'exittime', 'timeclose', 'closed'],
      type: ['type', 'side', 'action', 'direction', 'buysell'],
      lots: ['lots', 'lot', 'lotsize', 'volume', 'quantity', 'qty', 'contracts'],
      symbol: ['symbol', 'instrument', 'pair', 'ticker', 'asset', 'market'],
      openPrice: ['openingprice', 'openprice', 'entryprice', 'priceopen'],
      closePrice: ['closingprice', 'closeprice', 'exitprice', 'priceclose'],
      stopLoss: ['stoploss', 'sl'],
      takeProfit: ['takeprofit', 'tp'],
      commission: ['commission', 'comm', 'fee', 'fees'],
      swap: ['swap', 'rollover', 'financing'],
      profit: ['profit', 'pnl', 'pandl', 'netprofit', 'grossprofit', 'realizedpnl', 'gainloss'],
      closeReason: ['closereason', 'reason', 'comment', 'closingcomment', 'notes'],
      originalPositionSize: ['originalpositionsize', 'origpositionsize', 'initiallots', 'origlots', 'origsize', 'possize']
    };

    Object.entries(aliases).forEach(([field, names]) => {
      const index = cleanHeaders.findIndex(header => names.includes(header));
      if (index !== -1) map[field] = index;
    });
    return map;
  },

  parseNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return NaN;
    const negative = /^\(.*\)$/.test(text);
    const cleaned = text.replace(/[,$\s₹]/g, '').replace(/[^0-9.-]/g, '');
    const number = Number(cleaned);
    return Number.isFinite(number) ? (negative ? -Math.abs(number) : number) : NaN;
  },

  normalizeTradeRow(values, headerMap) {
    const get = field => {
      const index = headerMap[field];
      return index === undefined ? '' : (values[index] ?? '').trim();
    };

    const ticket = get('ticket');
    const rawType = get('type').toLowerCase();
    const lots = this.parseNumber(get('lots'));
    const symbol = get('symbol').toUpperCase();
    const profit = this.parseNumber(get('profit'));

    if (!ticket || !symbol || !Number.isFinite(lots) || lots <= 0 || !Number.isFinite(profit)) {
      return null;
    }

    const type = rawType.includes('sell') || rawType.includes('short')
      ? 'sell'
      : (rawType.includes('buy') || rawType.includes('long') ? 'buy' : null);
    if (!type) return null;

    const openTime = get('openTime') || get('closeTime') || new Date().toISOString();
    const closeTime = get('closeTime') || openTime;
    const numberOrNull = field => {
      const number = this.parseNumber(get(field));
      return Number.isFinite(number) ? number : null;
    };

    const rawCloseReason = get('closeReason');
    const closeReason = rawCloseReason ? rawCloseReason.toLowerCase().trim() : '';
    const originalPositionSize = numberOrNull('originalPositionSize');

    return {
      ticket,
      openTime,
      closeTime,
      type,
      lots,
      originalPositionSize: originalPositionSize !== null ? originalPositionSize : lots,
      symbol,
      openPrice: numberOrNull('openPrice') || 0,
      closePrice: numberOrNull('closePrice') || 0,
      stopLoss: numberOrNull('stopLoss'),
      takeProfit: numberOrNull('takeProfit'),
      commission: numberOrNull('commission') || 0,
      swap: numberOrNull('swap') || 0,
      profit: Math.round(profit * 100) / 100,
      closeReason,
      isWin: profit > 0,
      isLoss: profit < 0,
      isBreakEven: profit === 0
    };
  }
};

if (typeof window !== 'undefined') {
  window.TradeParser = TradeParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradeParser;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TradeParser = TradeParser;
}
