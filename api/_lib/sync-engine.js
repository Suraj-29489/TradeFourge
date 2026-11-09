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

function normalizeTheme(theme) {
  const cleaned = typeof theme === 'string' ? theme.trim().toLowerCase() : '';
  return ['classic', 'midnight', 'light'].includes(cleaned) ? cleaned : 'classic';
}

function buildTradesPayload(snapshot = {}, nowIso = new Date().toISOString()) {
  const trades = Array.isArray(snapshot.trades)
    ? snapshot.trades
        .filter((t) => t && typeof t === 'object')
        .map((t) => ({
          ...t,
          syncId: getTradeSyncKey(t),
          updatedAt: t.updatedAt || nowIso
        }))
    : [];

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

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso,
    ownerSub: owner && owner.sub ? String(owner.sub) : '',
    currency: snapshot.currency === 'INR' ? 'INR' : 'USD',
    startingCapital: parsedCap,
    mt5Session: snapshot.mt5Session && typeof snapshot.mt5Session === 'object' ? snapshot.mt5Session : null,
    theme: snapshot.theme ? normalizeTheme(snapshot.theme) : undefined
  };
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
      theme: settingsPayload.theme
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

  return {
    trades: Array.isArray(tradesObj.trades) ? tradesObj.trades : [],
    lastImport: tradesObj.lastImport || null,
    deletedUids: Array.isArray(tradesObj.deletedUids) ? tradesObj.deletedUids : [],
    notes,
    rules,
    currency: settingsObj.currency === 'INR' ? 'INR' : 'USD',
    startingCapital: settingsObj.startingCapital !== undefined ? settingsObj.startingCapital : null,
    mt5Session,
    theme: settingsObj.theme ? normalizeTheme(settingsObj.theme) : undefined
  };
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
