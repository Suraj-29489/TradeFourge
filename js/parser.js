/**
 * TradeForge - CSV & Data Parser
 * Parses trading data with intelligent multi-broker column mapping & validation.
 */

const TradeParser = {
  /**
   * Parse CSV text string into normalized trade objects
   */
  parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Invalid CSV data provided.');
    }

    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    // Parse header row
    const rawHeaders = this.parseCSVLine(lines[0]);
    const headerMap = this.mapHeaders(rawHeaders);

    const trades = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const trade = this.normalizeTradeRow(values, headerMap, i);
      if (trade) {
        trades.push(trade);
      }
    }

    if (trades.length === 0) {
      throw new Error('No valid trade records could be parsed from the CSV.');
    }

    // Sort trades chronologically (oldest to newest by close time or open time)
    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));

    return trades;
  },

  /**
   * Split a single CSV line honoring quotes
   */
  parseCSVLine(line) {
    const values = [];
    let curVal = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(curVal.trim().replace(/^["']|["']$/g, ''));
        curVal = '';
      } else {
        curVal += char;
      }
    }
    values.push(curVal.trim().replace(/^["']|["']$/g, ''));
    return values;
  },

  /**
   * Match raw CSV column names to standardized fields
   */
  mapHeaders(headers) {
    const map = {};
    const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const dictionary = {
      ticket: ['ticket', 'order', 'position', 'id', 'tradeid', 'ticketid'],
      openTime: ['openingtimeutc', 'opentime', 'openingtime', 'entrytime', 'timeopen', 'date', 'datetime', 'opened'],
      closeTime: ['closingtimeutc', 'closetime', 'closingtime', 'exittime', 'timeclose', 'closed'],
      type: ['type', 'side', 'action', 'direction', 'buysell'],
      lots: ['lots', 'size', 'volume', 'qty', 'quantity', 'contracts', 'position'],
      symbol: ['symbol', 'instrument', 'item', 'pair', 'ticker', 'asset', 'market'],
      openPrice: ['openingprice', 'openprice', 'entryprice', 'priceopen', 'price'],
      closePrice: ['closingprice', 'closeprice', 'exitprice', 'priceclose'],
      stopLoss: ['stoploss', 'sl', 'stop'],
      takeProfit: ['takeprofit', 'tp', 'target', 'limit'],
      commission: ['commission', 'comm', 'fee', 'fees'],
      swap: ['swap', 'rollover', 'financing'],
      profit: ['profit', 'pnl', 'pandl', 'netprofit', 'grossprofit', 'realizedpnl', 'amount', 'gainloss'],
      closeReason: ['closereason', 'reason', 'comment', 'closingcomment', 'notes']
    };

    for (const [standardKey, patterns] of Object.entries(dictionary)) {
      for (let i = 0; i < cleanHeaders.length; i++) {
        const h = cleanHeaders[i];
        if (patterns.includes(h) || patterns.some(p => h.includes(p))) {
          map[standardKey] = i;
          break;
        }
      }
    }

    return map;
  },

  /**
   * Build clean, normalized trade object
   */
  normalizeTradeRow(values, headerMap, rowIndex) {
    const getVal = (key) => {
      const idx = headerMap[key];
      return (idx !== undefined && values[idx] !== undefined) ? values[idx] : '';
    };

    const rawProfit = getVal('profit');
    let profit = parseFloat(rawProfit);
    if (isNaN(profit)) {
      profit = 0.0;
    }

    const rawOpenTime = getVal('openTime');
    const rawCloseTime = getVal('closeTime') || rawOpenTime;
    
    // Parse dates
    let openTime = rawOpenTime;
    let closeTime = rawCloseTime;
    if (!openTime && !closeTime) {
      openTime = new Date().toISOString();
      closeTime = openTime;
    }

    const rawLots = getVal('lots');
    const lots = parseFloat(rawLots) || 0.01;

    let type = (getVal('type') || 'buy').toLowerCase();
    if (type.includes('sell') || type.includes('short')) {
      type = 'sell';
    } else {
      type = 'buy';
    }

    const symbol = (getVal('symbol') || 'UNKNOWN').toUpperCase().trim();
    const openPrice = parseFloat(getVal('openPrice')) || 0;
    const closePrice = parseFloat(getVal('closePrice')) || 0;
    const stopLoss = parseFloat(getVal('stopLoss')) || null;
    const takeProfit = parseFloat(getVal('takeProfit')) || null;
    const commission = parseFloat(getVal('commission')) || 0;
    const swap = parseFloat(getVal('swap')) || 0;
    const ticket = getVal('ticket') || `T-${rowIndex}-${Date.now().toString().slice(-4)}`;
    const closeReason = getVal('closeReason') || (profit >= 0 ? 'tp' : 'user');

    return {
      ticket: String(ticket),
      openTime,
      closeTime,
      type,
      lots,
      symbol,
      openPrice,
      closePrice,
      stopLoss,
      takeProfit,
      commission,
      swap,
      profit: Math.round(profit * 100) / 100, // 2 decimal precision
      closeReason,
      isWin: profit > 0,
      isLoss: profit < 0,
      isBreakEven: profit === 0
    };
  }
};
