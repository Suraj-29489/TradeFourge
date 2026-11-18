/**
 * TradeFourge Backend - Cloud Data Normalization, Checksums & Backup Payloads
 *
 * Keeps server-side `My Drive / TradeFourge / User Data/` schemas & checksums
 * 100% consistent with frontend `CloudSyncUtils`.
 */

const SCHEMA_VERSION = '1.0.0';

const DEFAULT_RULES = [
  { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
  { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
  { id: 3, text: 'Always set a stop loss before entering position', checked: true },
  { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
  { id: 5, text: 'Accept take-profit targets without greed', checked: true }
];

function _stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(_stableSortObject);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      if (value[k] !== undefined) {
        sorted[k] = _stableSortObject(value[k]);
      }
    }
    return sorted;
  }
  return value;
}

function _stableStringify(value) {
  return JSON.stringify(_stableSortObject(value));
}

function computeChecksum(value) {
  const str = _stableStringify(value || {});
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (c + i) & 0xffff;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `tf1_${p1}${p2}_${str.length}`;
}

function getTradeFingerprint(t) {
  if (!t || typeof t !== 'object') return '';
  if (t.broker === 'mt5' || t.broker === 'mt5_html' || t.broker === 'mt5_xlsx' || String(t.id || '').startsWith('MT5_') || (t.position && !t.broker)) {
    const pos = String(t.position || t.ticket || '').trim();
    const closeTime = String(t.closeTime || t.openTime || '').trim();
    const lots = Number(t.lots || 0).toFixed(4);
    const profit = Number(t.profit || 0).toFixed(2);
    return ['MT5', pos, closeTime, lots, profit].join('|');
  }
  if (t.broker === 'zuperior' || t.ticket === 'Not provided' || !t.ticket) {
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
}

function getTradeSyncKey(t) {
  if (!t || typeof t !== 'object') return '';
  if (t.syncId && typeof t.syncId === 'string') return t.syncId;
  return getTradeFingerprint(t);
}

function parseUtcIso(str) {
  if (!str) return 0;
  if (typeof str === 'number') return Number.isFinite(str) ? str : 0;
  let s = String(str).trim();
  if (!s) return 0;
  if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z';
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

function formatJsNumStr(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '0';
  return String(Number(num));
}

function getAllIdentifiersForTrade(t) {
  const out = new Set();
  if (!t || typeof t !== 'object') return out;

  if (t.syncId && typeof t.syncId === 'string' && t.syncId.trim()) {
    out.add(t.syncId.trim());
  }
  if (t.id && typeof t.id === 'string' && t.id.trim() && !t.id.startsWith('ZUP_')) {
    out.add(t.id.trim());
  }

  const fp = getTradeFingerprint(t);
  if (fp) out.add(fp);
  const sk = getTradeSyncKey(t);
  if (sk) out.add(sk);

  const sym = String(t.symbol || '').trim().toUpperCase();
  const dir = String(t.type || t.direction || 'buy').toLowerCase().trim();

  const entryMs = parseUtcIso(t.openTime || t.entryTime);
  const exitMs = parseUtcIso(t.closeTime || t.exitTime) || entryMs;
  const openSec = Math.floor(entryMs / 1000);
  const closeSec = Math.floor(exitMs / 1000);
  const durationSec = closeSec - openSec;

  const lotsNum = Number(t.lots || t.quantity || 0);
  const lots4 = lotsNum.toFixed(4);
  const openPrice5 = Number(t.openPrice || t.entryPrice || 0).toFixed(5);
  const closePrice5 = Number(t.closePrice || t.exitPrice || 0).toFixed(5);
  const roundedPnl = Math.round(Number(t.profit !== undefined ? t.profit : (t.netPnL || 0)) * 100) / 100;
  let pnl2 = roundedPnl.toFixed(2);
  if (pnl2 === '-0.00') pnl2 = '0.00';

  const rawCleanTicket = String(t.ticket || t.position || t.ticketId || '').trim().replace(/^[#']+/, '');
  const isRealTicket = rawCleanTicket &&
    !rawCleanTicket.toLowerCase().startsWith('zup_') &&
    rawCleanTicket.toLowerCase() !== 'not provided';

  const candidateTickets = [];
  if (isRealTicket) candidateTickets.push(rawCleanTicket);

  const lotsJs = formatJsNumStr(lotsNum);
  const pnlJs = formatJsNumStr(roundedPnl);

  const epochShifts = [0, 19800, -19800];

  if (candidateTickets.length > 0) {
    candidateTickets.forEach((tk) => {
      epochShifts.forEach((shift) => {
        const oSec = openSec + shift;
        const cSec = closeSec + shift;
        out.add(`TEX|${tk}|${sym}|${dir}|${oSec}|${cSec}|${lots4}|${pnl2}`);
        out.add(`TEX_PX|${tk}|${sym}|${dir}|${oSec}|${cSec}|${lots4}|${openPrice5}|${closePrice5}`);
        out.add(`TEX_CT|${tk}|${sym}|${dir}|${cSec}|${lots4}|${closePrice5}|${pnl2}`);

        const closeIsoZ = new Date(cSec * 1000).toISOString();
        const closeIsoNoZ = closeIsoZ.replace(/Z$/, '');
        out.add(`MT5|${tk}|${closeIsoZ}|${lots4}|${pnl2}`);
        out.add(`MT5|${tk}|${closeIsoNoZ}|${lots4}|${pnl2}`);
        out.add(`MT5|${tk}|${closeIsoNoZ.replace('T', ' ')}|${lots4}|${pnl2}`);

        if (shift === 0) {
          out.add(`EXNESS_${tk}_${closeIsoZ}_${lotsJs}_${pnlJs}`);
          out.add(`EXNESS_${tk}_${closeIsoNoZ}_${lotsJs}_${pnlJs}`);
          const closeIso000 = closeIsoNoZ.includes('.') ? closeIsoZ : `${closeIsoNoZ}.000Z`;
          out.add(`EXNESS_${tk}_${closeIso000}_${lotsJs}_${pnlJs}`);
          if (t.closeTime) {
            const rawCt = String(t.closeTime).trim();
            out.add(`EXNESS_${tk}_${rawCt}_${lotsJs}_${pnlJs}`);
            out.add(`EXNESS_${tk}_${rawCt}Z_${lotsJs}_${pnlJs}`);
          }
        }
      });
      out.add(`TEX_DUR|${tk}|${sym}|${dir}|${durationSec}|${lots4}|${openPrice5}|${closePrice5}|${pnl2}`);
    });
  }

  // Zuperior / ticketless trades without a ticket ID
  if (candidateTickets.length === 0 || t.broker === 'zuperior') {
    epochShifts.forEach((shift) => {
      const oSec = openSec + shift;
      const cSec = closeSec + shift;
      out.add(`ZUP_EX|${sym}|${dir}|${oSec}|${cSec}|${lots4}|${openPrice5}|${closePrice5}|${pnl2}`);
      const oIsoZ = new Date(oSec * 1000).toISOString();
      const cIsoZ = new Date(cSec * 1000).toISOString();
      out.add(`ZUPERIOR|${sym}|${dir}|${oIsoZ}|${cIsoZ}|${lots4}|${openPrice5}|${closePrice5}|${pnl2}`);
      const oIso000Z = oIsoZ.replace(/Z$/, '').includes('.') ? oIsoZ : `${oIsoZ.replace(/Z$/, '')}.000Z`;
      const cIso000Z = cIsoZ.replace(/Z$/, '').includes('.') ? cIsoZ : `${cIsoZ.replace(/Z$/, '')}.000Z`;
      out.add(`ZUPERIOR|${sym}|${dir}|${oIso000Z}|${cIso000Z}|${lots4}|${openPrice5}|${closePrice5}|${pnl2}`);
      if (Number(t.openPrice || 0) === 0 || Number(t.closePrice || 0) === 0) {
        out.add(`ZUP_EX_NP|${sym}|${dir}|${oSec}|${cSec}|${lots4}|${pnl2}`);
      }
    });
  }

  return out;
}

function tradeRichnessScore(t) {
  if (!t || typeof t !== 'object') return 0;
  let score = 0;
  if (t.extraFieldsJson) score += 40;
  if (t.syncId && !String(t.syncId).startsWith('ZUP_')) score += 20;
  if (t.broker) score += 10;
  if (t.ticket && !String(t.ticket).startsWith('ZUP_')) score += 10;
  if (t.notes && t.notes !== 'Imported trade' && String(t.notes).trim()) score += 15;
  if (t.strategy && t.strategy !== 'Manual' && String(t.strategy).trim()) score += 12;
  if (t.stopLoss && Number(t.stopLoss) > 0) score += 6;
  if (t.takeProfit && Number(t.takeProfit) > 0) score += 6;
  if (t.screenshotUri) score += 8;
  if (t.openPrice && Number(t.openPrice) > 0) score += 3;
  if (t.closePrice && Number(t.closePrice) > 0) score += 3;
  if (Number(t.commission || 0) !== 0 || Number(t.swap || 0) !== 0) score += 2;
  if (Array.isArray(t.tags)) score += Math.min(t.tags.length, 5);
  return score;
}

function chooseRicherTrade(a, b) {
  const aScore = tradeRichnessScore(a);
  const bScore = tradeRichnessScore(b);
  const aTime = Date.parse(a.updatedAt || a.closeTime || a.openTime || 0) || 0;
  const bTime = Date.parse(b.updatedAt || b.closeTime || b.openTime || 0) || 0;
  const primaryFirst = aScore !== bScore ? aScore > bScore : aTime >= bTime;
  const winner = primaryFirst ? a : b;
  const loser = primaryFirst ? b : a;

  const merged = Object.assign({}, loser, winner);

  if ((!winner.notes || winner.notes === 'Imported trade') && loser.notes) {
    merged.notes = loser.notes;
  }
  if ((!winner.strategy || winner.strategy === 'Manual') && loser.strategy) {
    merged.strategy = loser.strategy;
  }
  const tagsA = Array.isArray(a.tags) ? a.tags : [];
  const tagsB = Array.isArray(b.tags) ? b.tags : [];
  if (tagsA.length > 0 || tagsB.length > 0) {
    merged.tags = Array.from(new Set([...tagsA, ...tagsB].map((tg) => String(tg).trim()).filter(Boolean)));
  }

  if (!merged.accountId && (a.accountId || b.accountId)) {
    merged.accountId = a.accountId || b.accountId;
    merged.accountName = a.accountName || b.accountName;
  }
  return merged;
}

function deduplicateTrades(trades) {
  if (!Array.isArray(trades) || trades.length <= 1) return trades ? trades.slice() : [];
  const entities = new Map();
  const idToCanonicalKey = new Map();
  const keyToIds = new Map();

  trades.forEach((t) => {
    if (!t || typeof t !== 'object') return;
    const ids = getAllIdentifiersForTrade(t);
    const matchedKeys = new Set();
    ids.forEach((id) => {
      const canonical = idToCanonicalKey.get(id);
      if (canonical) matchedKeys.add(canonical);
    });

    const primaryKey = matchedKeys.size > 0
      ? Array.from(matchedKeys)[0]
      : (t.syncId || Array.from(ids)[0] || `trade_${entities.size}`);

    let merged = entities.has(primaryKey) ? chooseRicherTrade(entities.get(primaryKey), t) : t;
    if (matchedKeys.size > 1) {
      matchedKeys.forEach((otherKey) => {
        if (otherKey === primaryKey) return;
        const otherTrade = entities.get(otherKey);
        entities.delete(otherKey);
        if (otherTrade) {
          merged = chooseRicherTrade(merged, otherTrade);
        }
        const otherIds = keyToIds.get(otherKey);
        keyToIds.delete(otherKey);
        if (otherIds) {
          if (!keyToIds.has(primaryKey)) keyToIds.set(primaryKey, new Set());
          const pSet = keyToIds.get(primaryKey);
          otherIds.forEach((oid) => {
            idToCanonicalKey.set(oid, primaryKey);
            pSet.add(oid);
          });
        }
      });
    }

    entities.set(primaryKey, merged);
    if (!keyToIds.has(primaryKey)) keyToIds.set(primaryKey, new Set());
    const boundIds = keyToIds.get(primaryKey);
    ids.forEach((id) => {
      idToCanonicalKey.set(id, primaryKey);
      boundIds.add(id);
    });
  });

  return Array.from(entities.values());
}

function normalizeTheme(theme) {
  const cleaned = typeof theme === 'string' ? theme.trim().toLowerCase() : '';
  return ['classic', 'midnight', 'light'].includes(cleaned) ? cleaned : 'classic';
}

function buildTradesPayload(snapshot = {}, nowIso = new Date().toISOString()) {
  const rawList = Array.isArray(snapshot.trades)
    ? snapshot.trades.filter((t) => t && typeof t === 'object')
    : [];
  const deduped = deduplicateTrades(rawList);
  const trades = deduped.map((t) => ({
    ...t,
    syncId: getTradeSyncKey(t),
    updatedAt: t.updatedAt || nowIso
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso,
    lastImport: snapshot.lastImport || null,
    trades,
    deletedUids: Array.isArray(snapshot.deletedUids) ? snapshot.deletedUids.slice(-2000) : []
  };
}

function buildJournalPayload(snapshot = {}, nowIso = new Date().toISOString()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso,
    notes: String(snapshot.notes || ''),
    rules: Array.isArray(snapshot.rules) ? snapshot.rules : DEFAULT_RULES.map((r) => ({ ...r }))
  };
}

function buildSettingsPayload(snapshot = {}, owner = null, nowIso = new Date().toISOString()) {
  const cap = snapshot.startingCapital;
  const parsedCap = cap !== undefined && cap !== null && cap !== '' && Number.isFinite(Number(cap)) && Number(cap) > 0
    ? Math.round(Number(cap) * 100) / 100
    : null;

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso,
    ownerSub: owner && owner.sub ? String(owner.sub) : '',
    currency: snapshot.currency === 'INR' ? 'INR' : 'USD',
    startingCapital: parsedCap,
    mt5Session: snapshot.mt5Session && typeof snapshot.mt5Session === 'object' ? snapshot.mt5Session : null,
    theme: snapshot.theme ? normalizeTheme(snapshot.theme) : undefined
  };
  if (Array.isArray(snapshot.accounts) && snapshot.accounts.length > 0) {
    payload.tradingAccounts = snapshot.accounts;
  }
  return payload;
}

function buildMetadataPayload({
  owner,
  folderIds,
  revisions,
  checksums,
  counts,
  migratedLocalHash = '',
  nowIso = new Date().toISOString()
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    appName: 'TradeFourge',
    owner: owner
      ? {
          sub: String(owner.sub || ''),
          email: String(owner.email || ''),
          name: String(owner.name || '')
        }
      : null,
    folderIds: folderIds ? { ...folderIds } : null,
    revisions: Object.assign({ trades: 1, journal: 1, settings: 1 }, revisions || {}),
    checksums: Object.assign({ trades: '', journal: '', settings: '' }, checksums || {}),
    counts: Object.assign({ trades: 0 }, counts || {}),
    migratedLocalHash: migratedLocalHash || '',
    lastSyncedAt: nowIso,
    updatedAt: nowIso
  };
}

function computeDomainChecksums({ tradesPayload, journalPayload, settingsPayload }) {
  return {
    trades: computeChecksum({
      trades: tradesPayload.trades,
      deletedUids: tradesPayload.deletedUids
    }),
    journal: computeChecksum({
      notes: journalPayload.notes,
      rules: journalPayload.rules
    }),
    settings: computeChecksum({
      currency: settingsPayload.currency,
      startingCapital: settingsPayload.startingCapital,
      mt5Session: settingsPayload.mt5Session,
      theme: settingsPayload.theme,
      tradingAccounts: settingsPayload.tradingAccounts
    })
  };
}

function extractSnapshotFromRemoteDb(remoteDb = {}) {
  const tradesObj = remoteDb.trades || {};
  const journalObj = remoteDb.journal || {};
  const settingsObj = remoteDb.settings || {};
  const accountsObj = remoteDb.accounts || {};

  const notes = typeof journalObj.notes === 'string'
    ? journalObj.notes
    : (typeof settingsObj.notes === 'string' ? settingsObj.notes : '');

  const rules = Array.isArray(journalObj.rules)
    ? journalObj.rules
    : (Array.isArray(settingsObj.rules) ? settingsObj.rules : DEFAULT_RULES.map((r) => ({ ...r })));

  const mt5Session = settingsObj.mt5Session !== undefined
    ? settingsObj.mt5Session
    : (accountsObj.mt5Session !== undefined ? accountsObj.mt5Session : null);

  const rawTrades = Array.isArray(tradesObj.trades) ? tradesObj.trades : [];
  const extracted = {
    trades: deduplicateTrades(rawTrades),
    lastImport: tradesObj.lastImport || null,
    deletedUids: Array.isArray(tradesObj.deletedUids) ? tradesObj.deletedUids : [],
    notes,
    rules,
    currency: settingsObj.currency === 'INR' ? 'INR' : 'USD',
    startingCapital: settingsObj.startingCapital !== undefined ? settingsObj.startingCapital : null,
    mt5Session,
    theme: settingsObj.theme ? normalizeTheme(settingsObj.theme) : undefined
  };
  if (Array.isArray(settingsObj.tradingAccounts)) {
    extracted.accounts = settingsObj.tradingAccounts;
  }
  return extracted;
}

function buildBackupBundle({ snapshot, owner, reason = 'manual', nowIso = new Date().toISOString() }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    backupReason: reason,
    createdAt: nowIso,
    owner: owner ? { sub: owner.sub, email: owner.email, name: owner.name } : null,
    trades: buildTradesPayload(snapshot, nowIso),
    journal: buildJournalPayload(snapshot, nowIso),
    settings: buildSettingsPayload(snapshot, owner, nowIso)
  };
}

function normalizeRemoteRevisions(metadata = null) {
  const rev = (metadata && metadata.revisions) || {};
  return {
    trades: Number(rev.trades) || 0,
    journal: Number(rev.journal !== undefined ? rev.journal : rev.settings) || 0,
    settings: Number(rev.settings !== undefined ? rev.settings : rev.accounts) || 0
  };
}

module.exports = {
  SCHEMA_VERSION,
  DEFAULT_RULES,
  computeChecksum,
  getTradeFingerprint,
  getTradeSyncKey,
  getAllIdentifiersForTrade,
  deduplicateTrades,
  normalizeTheme,
  buildTradesPayload,
  buildJournalPayload,
  buildSettingsPayload,
  buildMetadataPayload,
  computeDomainChecksums,
  extractSnapshotFromRemoteDb,
  buildBackupBundle,
  normalizeRemoteRevisions
};
