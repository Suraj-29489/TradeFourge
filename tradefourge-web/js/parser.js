/**
 * TradeForge CSV parser.
 * One unique ticket is treated as one trade.
 */

const TradeParser = {
  parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      throw new Error('Invalid CSV data provided.');
    }

    const rows = this.parseCSVRecords(csvText);
    if (rows.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    const headerMap = this.mapHeaders(rows[0]);
    const requiredFields = ['ticket', 'type', 'lots', 'symbol', 'profit'];
    const missingFields = requiredFields.filter(field => headerMap[field] === undefined);
    if (missingFields.length) {
      throw new Error(`CSV needs these columns: ${missingFields.join(', ')}.`);
    }

    const tickets = new Set();
    const trades = [];

    rows.slice(1).forEach((values, index) => {
      const trade = this.normalizeTradeRow(values, headerMap, index + 1);
      if (!trade || tickets.has(trade.ticket)) return;
      tickets.add(trade.ticket);
      trades.push(trade);
    });

    if (!trades.length) {
      throw new Error('No valid unique trades could be parsed from this CSV.');
    }

    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));
    return trades;
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
      closeReason: ['closereason', 'reason', 'comment', 'closingcomment', 'notes']
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
    const cleaned = text.replace(/[,$\s]/g, '').replace(/[^0-9.-]/g, '');
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

    return {
      ticket,
      openTime,
      closeTime,
      type,
      lots,
      symbol,
      openPrice: numberOrNull('openPrice') || 0,
      closePrice: numberOrNull('closePrice') || 0,
      stopLoss: numberOrNull('stopLoss'),
      takeProfit: numberOrNull('takeProfit'),
      commission: numberOrNull('commission') || 0,
      swap: numberOrNull('swap') || 0,
      profit: Math.round(profit * 100) / 100,
      closeReason: get('closeReason') || (profit >= 0 ? 'tp' : 'user'),
      isWin: profit > 0,
      isLoss: profit < 0,
      isBreakEven: profit === 0
    };
  }
};
