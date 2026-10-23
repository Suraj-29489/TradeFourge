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
  },

  /**
   * Produce a deterministic fingerprint for an MT5 trade
   */
  getMT5Fingerprint(trade) {
    if (!trade) return '';
    const pos = String(trade.position || trade.ticket || '').trim();
    const closeTime = String(trade.closeTime || trade.openTime || '').trim();
    const lots = Number(trade.lots || 0).toFixed(4);
    const profit = Number(trade.profit || 0).toFixed(2);
    return ['MT5', pos, closeTime, lots, profit].join('|');
  },

  /**
   * Sniff or determine report file type based on extension and content
   * @param {string} fileName
   * @param {ArrayBuffer|Uint8Array|string} [fileData]
   * @returns {'mt5_html' | 'mt5_xlsx' | 'exness' | 'zuperior' | 'csv' | 'unknown'}
   */
  detectFileType(fileName, fileData) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    if (ext === 'xlsx') return 'mt5_xlsx';
    if (ext === 'html' || ext === 'htm') return 'mt5_html';
    if (ext === 'csv') {
      if (typeof fileData === 'string') {
        return this.detectBroker(fileData);
      }
      return 'csv';
    }

    // Sniff binary content if available
    if (fileData) {
      if (fileData instanceof ArrayBuffer || fileData instanceof Uint8Array) {
        const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
        // Check for ZIP magic bytes (PK\x03\x04) -> XLSX
        if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
          return 'mt5_xlsx';
        }
        // Check for HTML text
        const decoded = this.decodeTextBuffer(bytes.subarray(0, Math.min(bytes.length, 1000)));
        if (/<(?:!doctype\s+html|html|body|table)/i.test(decoded)) {
          return 'mt5_html';
        }
      } else if (typeof fileData === 'string') {
        if (/<(?:!doctype\s+html|html|body|table)/i.test(fileData)) {
          return 'mt5_html';
        }
        return this.detectBroker(fileData);
      }
    }

    return 'unknown';
  },

  /**
   * Decode binary buffer into text handling UTF-16 LE, UTF-16 BE, UTF-8 BOM, and UTF-8
   */
  decodeTextBuffer(buffer) {
    if (!buffer) return '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length === 0) return '';

    // Check BOMs
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return this._decodeUTF16LE(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return this._decodeUTF16BE(bytes.subarray(2));
    }
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return this._decodeUTF8(bytes.subarray(3));
    }

    // Heuristic: check if null bytes alternate in the first 200 bytes
    const sampleLen = Math.min(bytes.length, 200);
    let evenNulls = 0;
    let oddNulls = 0;
    for (let i = 0; i < sampleLen; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 0) evenNulls++;
        else oddNulls++;
      }
    }
    if (oddNulls > 10 && evenNulls === 0) {
      return this._decodeUTF16LE(bytes);
    }
    if (evenNulls > 10 && oddNulls === 0) {
      return this._decodeUTF16BE(bytes);
    }

    return this._decodeUTF8(bytes);
  },

  _decodeUTF16LE(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-16le').decode(bytes); } catch (e) {}
    }
    let str = '';
    for (let i = 0; i < bytes.length - 1; i += 2) {
      str += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return str;
  },

  _decodeUTF16BE(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-16be').decode(bytes); } catch (e) {}
    }
    let str = '';
    for (let i = 0; i < bytes.length - 1; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return str;
  },

  _decodeUTF8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) {}
    }
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  },

  /**
   * Parse MT5 HTML History Report
   * @param {string} htmlString
   * @returns {{ format: string, broker: string, metadata: Object, trades: Array, summary: Object }}
   */
  parseMT5HTML(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') {
      throw new Error('Invalid or empty HTML report data.');
    }

    const metadata = {
      title: 'Trade History Report',
      name: '',
      account: '',
      accountId: '',
      currency: 'USD',
      accountType: '',
      company: '',
      reportDate: ''
    };

    // Metadata extraction
    const nameMatch = htmlString.match(/Name:<\/th>\s*<th[^>]*><b>(.*?)<\/b>/i) ||
                      htmlString.match(/Name:\s*<\/t[hd]>\s*<t[hd][^>]*><b>(.*?)<\/b>/i);
    if (nameMatch) metadata.name = nameMatch[1].trim();

    const accMatch = htmlString.match(/Account:<\/th>\s*<th[^>]*><b>(.*?)<\/b>/i) ||
                     htmlString.match(/Account:\s*<\/t[hd]>\s*<t[hd][^>]*><b>(.*?)<\/b>/i);
    if (accMatch) {
      metadata.account = accMatch[1].replace(/&nbsp;/g, ' ').trim();
      const idMatch = metadata.account.match(/^(\d+)/);
      if (idMatch) metadata.accountId = idMatch[1];
      const curMatch = metadata.account.match(/\b([A-Z]{3})\b/);
      if (curMatch) metadata.currency = curMatch[1];
    }

    const compMatch = htmlString.match(/Company:<\/th>\s*<th[^>]*><b>(.*?)<\/b>/i) ||
                      htmlString.match(/Company:\s*<\/t[hd]>\s*<t[hd][^>]*><b>(.*?)<\/b>/i);
    if (compMatch) metadata.company = compMatch[1].replace(/&nbsp;/g, ' ').trim();

    const dateMatch = htmlString.match(/Date:<\/th>\s*<th[^>]*><b>(.*?)<\/b>/i) ||
                      htmlString.match(/Date:\s*<\/t[hd]>\s*<t[hd][^>]*><b>(.*?)<\/b>/i);
    if (dateMatch) metadata.reportDate = dateMatch[1].trim();

    // Check if HTML contains Positions
    const posIdx = htmlString.indexOf('Positions');
    if (posIdx === -1) {
      throw new Error('This HTML file does not appear to be an MT5 Trade History Report (missing Positions section).');
    }

    // Isolate Positions section
    let endIdx = htmlString.indexOf('Orders', posIdx);
    if (endIdx === -1) endIdx = htmlString.indexOf('Deals', posIdx);
    if (endIdx === -1) endIdx = htmlString.indexOf('Results', posIdx);
    if (endIdx === -1) endIdx = htmlString.indexOf('Summary', posIdx);
    const sectionHtml = endIdx !== -1 ? htmlString.substring(posIdx, endIdx) : htmlString.substring(posIdx);

    const rowMatches = sectionHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    if (!rowMatches.length) {
      throw new Error('No table rows found in MT5 Positions section.');
    }

    // Detect column indexes from header row if available
    let colOpenTime = 0;
    let colPosition = 1;
    let colSymbol = 2;
    let colType = 3;
    let colVolume = 4;
    let colOpenPrice = 5;
    let colSL = 6;
    let colTP = 7;
    let colCloseTime = 8;
    let colClosePrice = 9;
    let colCommission = 10;
    let colSwap = 11;
    let colProfit = 12;

    for (let i = 0; i < Math.min(rowMatches.length, 5); i++) {
      const rHtml = rowMatches[i];
      if (rHtml.includes('Volume') && (rHtml.includes('Commission') || rHtml.includes('Profit'))) {
        const cleanHdr = rHtml.replace(/<td[^>]*class=["'][^"']*hidden[^"']*["'][^>]*>[\s\S]*?<\/td>/gi, '');
        const thCells = (cleanHdr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [])
          .map(c => c.replace(/<[^>]+>/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

        let timeCount = 0;
        let priceCount = 0;
        thCells.forEach((c, idx) => {
          if (c === 'time') {
            if (timeCount === 0) colOpenTime = idx;
            else colCloseTime = idx;
            timeCount++;
          } else if (c === 'price') {
            if (priceCount === 0) colOpenPrice = idx;
            else colClosePrice = idx;
            priceCount++;
          } else if (c === 'position') colPosition = idx;
          else if (c === 'symbol') colSymbol = idx;
          else if (c === 'type') colType = idx;
          else if (c === 'volume' || c === 'vol' || c === 'lots') colVolume = idx;
          else if (c === 'sl' || c === 'stoploss') colSL = idx;
          else if (c === 'tp' || c === 'takeprofit') colTP = idx;
          else if (c === 'commission' || c === 'comm') colCommission = idx;
          else if (c === 'swap') colSwap = idx;
          else if (c === 'profit') colProfit = idx;
        });
        break;
      }
    }

    const trades = [];
    const seenRecords = new Set();
    let totalGross = 0;
    let totalComm = 0;
    let totalSwap = 0;

    for (let r = 0; r < rowMatches.length; r++) {
      const rowHtml = rowMatches[r];

      // Skip header rows
      if (rowHtml.includes('Volume') && (rowHtml.includes('Commission') || rowHtml.includes('Profit'))) {
        continue;
      }

      // Remove hidden cells
      const cleanRowHtml = rowHtml.replace(/<td[^>]*class=["'][^"']*hidden[^"']*["'][^>]*>[\s\S]*?<\/td>/gi, '')
                                  .replace(/<td[^>]*style=["'][^"']*display\s*:\s*none[^"']*["'][^>]*>[\s\S]*?<\/td>/gi, '');

      const cellMatches = cleanRowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const cells = cellMatches.map(c => c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());

      if (cells.length < 13 || !/^\d+$/.test(cells[colPosition])) {
        continue;
      }

      const rawOpenTime = cells[colOpenTime];
      const position = cells[colPosition];
      const symbol = cells[colSymbol];
      const rawType = (cells[colType] || '').toLowerCase();
      const volume = this.parseNumber(cells[colVolume]);
      const openPrice = this.parseNumber(cells[colOpenPrice]);
      const sl = this.parseNumber(cells[colSL]);
      const tp = this.parseNumber(cells[colTP]);
      const rawCloseTime = cells[colCloseTime];
      const closePrice = this.parseNumber(cells[colClosePrice]);
      const comm = this.parseNumber(cells[colCommission]) || 0;
      const swap = this.parseNumber(cells[colSwap]) || 0;
      const grossProfit = this.parseNumber(cells[colProfit]);

      if (!position || !symbol || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(grossProfit)) {
        continue;
      }

      const type = rawType.includes('sell') || rawType.includes('short') ? 'sell' : 'buy';
      const openTime = rawOpenTime ? rawOpenTime.replace(/\./g, '-') : new Date().toISOString();
      const closeTime = rawCloseTime ? rawCloseTime.replace(/\./g, '-') : openTime;

      // Net Profit reconciles gross profit, commissions, and overnight financing swaps
      const netProfit = Math.round((grossProfit + comm + swap) * 100) / 100;

      const recordKey = `MT5|${position}|${closeTime}|${volume.toFixed(4)}|${netProfit.toFixed(2)}`;
      if (seenRecords.has(recordKey)) continue;
      seenRecords.add(recordKey);

      totalGross += grossProfit;
      totalComm += comm;
      totalSwap += swap;

      trades.push({
        ticket: position,
        position: position,
        broker: 'mt5',
        openTime,
        closeTime,
        type,
        lots: volume,
        originalPositionSize: volume,
        symbol,
        openPrice: Number.isFinite(openPrice) ? openPrice : 0,
        closePrice: Number.isFinite(closePrice) ? closePrice : 0,
        stopLoss: Number.isFinite(sl) ? sl : null,
        takeProfit: Number.isFinite(tp) ? tp : null,
        commission: comm,
        swap: swap,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: netProfit,
        profit: netProfit,
        closeReason: 'mt5_report',
        isWin: netProfit > 0,
        isLoss: netProfit < 0,
        isBreakEven: netProfit === 0,
        closeType: 'full',
        isPartialClose: false,
        id: `MT5_${position}_${closeTime}_${volume}_${netProfit}`
      });
    }

    if (!trades.length) {
      throw new Error('No valid position trade records found in this MT5 HTML report.');
    }

    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));

    return {
      format: 'mt5_html',
      broker: 'mt5',
      metadata,
      trades,
      summary: {
        totalPositions: trades.length,
        grossProfit: Math.round(totalGross * 100) / 100,
        commission: Math.round(totalComm * 100) / 100,
        swap: Math.round(totalSwap * 100) / 100,
        netProfit: Math.round((totalGross + totalComm + totalSwap) * 100) / 100
      }
    };
  },

  /**
   * Helper to parse MT5 XLSX files that have internal UTF-16 XML files inside the ZIP
   */
  readMT5Workbook(data) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library (XLSX) is required to parse Excel files.');
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let cfb;
    try {
      cfb = XLSX.CFB.read(bytes, { type: 'array' });
    } catch (e) {
      return XLSX.read(bytes, { type: 'array' });
    }

    // Inspect files inside zip archive; if UTF-16 LE/BE XML, convert to UTF-8
    if (cfb && cfb.FileIndex) {
      for (let i = 0; i < cfb.FileIndex.length; i++) {
        const file = cfb.FileIndex[i];
        if (file && file.content && file.content.length >= 2) {
          const b0 = file.content[0];
          const b1 = file.content[1];
          if ((b0 === 0xff && b1 === 0xfe) || (b0 === 0xfe && b1 === 0xff)) {
            const enc = (b0 === 0xff && b1 === 0xfe) ? 'utf-16le' : 'utf-16be';
            let decoded = '';
            if (typeof TextDecoder !== 'undefined') {
              try { decoded = new TextDecoder(enc).decode(file.content.subarray(2)); } catch (e) {}
            }
            if (!decoded) {
              const isLE = enc === 'utf-16le';
              for (let j = 2; j < file.content.length; j += 2) {
                const code = isLE
                  ? file.content[j] | (file.content[j + 1] << 8)
                  : (file.content[j] << 8) | file.content[j + 1];
                decoded += String.fromCharCode(code);
              }
            }
            let encoded = null;
            if (typeof TextEncoder !== 'undefined') {
              try { encoded = new TextEncoder().encode(decoded); } catch (e) {}
            }
            if (!encoded) {
              const utf8 = [];
              for (let k = 0; k < decoded.length; k++) {
                const c = decoded.charCodeAt(k);
                if (c < 128) utf8.push(c);
                else if (c < 2048) { utf8.push((c >> 6) | 192); utf8.push((c & 63) | 128); }
                else { utf8.push((c >> 12) | 224); utf8.push(((c >> 6) & 63) | 128); utf8.push((c & 63) | 128); }
              }
              encoded = new Uint8Array(utf8);
            }
            file.content = encoded;
            file.size = encoded.length;
          }
        }
      }
      return XLSX.parse_zip(cfb);
    }
    return XLSX.read(bytes, { type: 'array' });
  },

  /**
   * Parse MT5 XLSX History Report
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {{ format: string, broker: string, metadata: Object, trades: Array, summary: Object }}
   */
  parseMT5XLSX(buffer) {
    const wb = this.readMT5Workbook(buffer);
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) {
      throw new Error('Invalid Excel file: no sheets found.');
    }

    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rows || rows.length < 2) {
      throw new Error('Excel sheet is empty or contains no data rows.');
    }

    const metadata = {
      title: 'Trade History Report',
      name: '',
      account: '',
      accountId: '',
      currency: 'USD',
      accountType: '',
      company: '',
      reportDate: ''
    };

    let headerIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r];
      const c0 = String(row[0] || '').trim();
      const val = (row[3] || row[1] || row[2] || '').trim();

      if (c0.toLowerCase().startsWith('name:')) metadata.name = val;
      if (c0.toLowerCase().startsWith('account:')) {
        metadata.account = val;
        const idMatch = val.match(/^(\d+)/);
        if (idMatch) metadata.accountId = idMatch[1];
        const curMatch = val.match(/\b([A-Z]{3})\b/);
        if (curMatch) metadata.currency = curMatch[1];
      }
      if (c0.toLowerCase().startsWith('company:')) metadata.company = val;
      if (c0.toLowerCase().startsWith('date:')) metadata.reportDate = val;

      const cleanRow = row.map(c => String(c || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (cleanRow.includes('position') && cleanRow.includes('symbol') && cleanRow.includes('profit')) {
        headerIdx = r;
        break;
      }
    }

    if (headerIdx === -1) {
      throw new Error('Could not find MT5 Positions table header in this Excel file.');
    }

    const headerMap = {};
    const headerRow = rows[headerIdx];
    let timeSeen = 0;
    let priceSeen = 0;

    headerRow.forEach((col, idx) => {
      const text = String(col || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (text === 'time') {
        if (timeSeen === 0) headerMap.openTime = idx;
        else headerMap.closeTime = idx;
        timeSeen++;
      } else if (text === 'price') {
        if (priceSeen === 0) headerMap.openPrice = idx;
        else headerMap.closePrice = idx;
        priceSeen++;
      } else if (text === 'position') {
        headerMap.position = idx;
      } else if (text === 'symbol') {
        headerMap.symbol = idx;
      } else if (text === 'type') {
        headerMap.type = idx;
      } else if (text === 'volume' || text === 'vol' || text === 'lots') {
        headerMap.volume = idx;
      } else if (text === 'sl' || text === 'stoploss') {
        headerMap.sl = idx;
      } else if (text === 'tp' || text === 'takeprofit') {
        headerMap.tp = idx;
      } else if (text === 'commission' || text === 'comm') {
        headerMap.commission = idx;
      } else if (text === 'swap') {
        headerMap.swap = idx;
      } else if (text === 'profit') {
        headerMap.profit = idx;
      }
    });

    const trades = [];
    const seenRecords = new Set();
    let totalGross = 0;
    let totalComm = 0;
    let totalSwap = 0;

    const endSectionNames = ['orders', 'deals', 'working orders', 'open positions', 'summary', 'results'];

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const firstCell = String(row[0] || '').trim().toLowerCase();

      // Stop condition: empty row or next section heading
      if (!firstCell) {
        if (row.every(c => String(c || '').trim() === '')) break;
      }
      if (endSectionNames.includes(firstCell)) break;

      const getVal = (colIdx) => colIdx !== undefined ? row[colIdx] : '';

      const position = String(getVal(headerMap.position) || '').trim();
      const symbol = String(getVal(headerMap.symbol) || '').trim();
      const rawType = String(getVal(headerMap.type) || '').toLowerCase().trim();
      const volume = this.parseNumber(getVal(headerMap.volume));
      const rawOpenTime = String(getVal(headerMap.openTime) || '').trim();
      const rawCloseTime = String(getVal(headerMap.closeTime) || '').trim();
      const openPrice = this.parseNumber(getVal(headerMap.openPrice));
      const closePrice = this.parseNumber(getVal(headerMap.closePrice));
      const sl = this.parseNumber(getVal(headerMap.sl));
      const tp = this.parseNumber(getVal(headerMap.tp));
      const comm = this.parseNumber(getVal(headerMap.commission)) || 0;
      const swap = this.parseNumber(getVal(headerMap.swap)) || 0;
      const grossProfit = this.parseNumber(getVal(headerMap.profit));

      if (!position || !symbol || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(grossProfit)) {
        continue;
      }

      const type = rawType.includes('sell') || rawType.includes('short') ? 'sell' : 'buy';
      const openTime = rawOpenTime ? rawOpenTime.replace(/\./g, '-') : new Date().toISOString();
      const closeTime = rawCloseTime ? rawCloseTime.replace(/\./g, '-') : openTime;

      const netProfit = Math.round((grossProfit + comm + swap) * 100) / 100;
      const recordKey = `MT5|${position}|${closeTime}|${volume.toFixed(4)}|${netProfit.toFixed(2)}`;
      if (seenRecords.has(recordKey)) continue;
      seenRecords.add(recordKey);

      totalGross += grossProfit;
      totalComm += comm;
      totalSwap += swap;

      trades.push({
        ticket: position,
        position: position,
        broker: 'mt5',
        openTime,
        closeTime,
        type,
        lots: volume,
        originalPositionSize: volume,
        symbol,
        openPrice: Number.isFinite(openPrice) ? openPrice : 0,
        closePrice: Number.isFinite(closePrice) ? closePrice : 0,
        stopLoss: Number.isFinite(sl) ? sl : null,
        takeProfit: Number.isFinite(tp) ? tp : null,
        commission: comm,
        swap: swap,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: netProfit,
        profit: netProfit,
        closeReason: 'mt5_report',
        isWin: netProfit > 0,
        isLoss: netProfit < 0,
        isBreakEven: netProfit === 0,
        closeType: 'full',
        isPartialClose: false,
        id: `MT5_${position}_${closeTime}_${volume}_${netProfit}`
      });
    }

    if (!trades.length) {
      throw new Error('No valid trade positions found in this MT5 Excel report.');
    }

    trades.sort((a, b) => new Date(a.closeTime || a.openTime) - new Date(b.closeTime || b.openTime));

    return {
      format: 'mt5_xlsx',
      broker: 'mt5',
      metadata,
      trades,
      summary: {
        totalPositions: trades.length,
        grossProfit: Math.round(totalGross * 100) / 100,
        commission: Math.round(totalComm * 100) / 100,
        swap: Math.round(totalSwap * 100) / 100,
        netProfit: Math.round((totalGross + totalComm + totalSwap) * 100) / 100
      }
    };
  },

  /**
   * Unified report parser for MT5 (HTML, XLSX) and CSV (Exness, Zuperior)
   */
  parseReport(fileData, fileName, brokerPreference = null) {
    const fileType = this.detectFileType(fileName, fileData);

    if (fileType === 'mt5_xlsx') {
      return this.parseMT5XLSX(fileData);
    }

    if (fileType === 'mt5_html') {
      const htmlText = typeof fileData === 'string' ? fileData : this.decodeTextBuffer(fileData);
      return this.parseMT5HTML(htmlText);
    }

    // CSV format
    const csvText = typeof fileData === 'string' ? fileData : this.decodeTextBuffer(fileData);
    const trades = this.parseCSV(csvText, brokerPreference);
    const broker = brokerPreference || this.detectBroker(csvText);

    return {
      format: broker === 'zuperior' ? 'zuperior_csv' : 'exness_csv',
      broker,
      metadata: {
        title: 'Trade Log CSV',
        name: '',
        account: '',
        company: broker === 'zuperior' ? 'Zuperior' : 'Exness',
        currency: 'USD',
        reportDate: ''
      },
      trades,
      summary: {
        totalPositions: trades.length,
        grossProfit: trades.reduce((sum, t) => sum + (t.grossProfit !== undefined ? t.grossProfit : (t.profit || 0)), 0),
        commission: trades.reduce((sum, t) => sum + (t.commission || 0), 0),
        swap: trades.reduce((sum, t) => sum + (t.swap || 0), 0),
        netProfit: Math.round(trades.reduce((sum, t) => sum + (t.profit || 0), 0) * 100) / 100
      }
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
