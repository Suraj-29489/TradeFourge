/**
 * TradeFourge - Cloud Synchronization Engine & Conflict Resolver
 *
 * Bridges StorageManager (account-isolated localStorage cache) with server-backed GoogleDriveStorage
 * (`My Drive / TradeFourge / { User Data/, Backups/, Exports/ }`), providing:
 * - Automatic offline-first persistence & queued retry backoff
 * - Safe first-login migration (never deletes anonymous localStorage automatically)
 * - Post-write verification readback
 * - Revision-checked multi-device 3-way merge with tombstone support
 * - Automatic pre-overwrite backup snapshots in Backups/
 * - Strict multi-account data isolation by Google `sub`
 */

(function (global) {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';
  const META_PREFIX = 'tradefourge_cloud_meta_';
  const BASE_PREFIX = 'tradefourge_cloud_base_';
  const DEBOUNCE_MS = 1200;
  const RETRY_DELAYS_MS = [2000, 5000, 15000];

  function _getStorage() {
    try {
      if (typeof global.localStorage !== 'undefined') return global.localStorage;
    } catch (e) {
      // Ignore storage access restrictions
    }
    return null;
  }

  function _stableSortObject(value) {
    if (Array.isArray(value)) {
      return value.map(_stableSortObject);
    }
    if (value && typeof value === 'object') {
      const sorted = {};
      Object.keys(value).sort().forEach((k) => {
        if (value[k] !== undefined) {
          sorted[k] = _stableSortObject(value[k]);
        }
      });
      return sorted;
    }
    return value;
  }

  function _stableStringify(value) {
    return JSON.stringify(_stableSortObject(value));
  }

  function _computeChecksum(value) {
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

  function _hashNamespace(ns) {
    if (typeof StorageManager !== 'undefined' && StorageManager._hashNamespace) {
      return StorageManager._hashNamespace(ns);
    }
    const str = String(ns || 'default');
    let h1 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    return (h1 >>> 0).toString(36);
  }

  function _defaultRules() {
    if (typeof StorageManager !== 'undefined' && StorageManager.getDefaultRules) {
      return StorageManager.getDefaultRules();
    }
    return [
      { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
      { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
      { id: 3, text: 'Always set a stop loss before entering position', checked: true },
      { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
      { id: 5, text: 'Accept take-profit targets without greed', checked: true }
    ];
  }

  function _getTradeFingerprint(t) {
    if (!t) return '';
    if (typeof StorageManager !== 'undefined' && StorageManager.getTradeFingerprint) {
      return StorageManager.getTradeFingerprint(t);
    }
    if (t.broker === 'mt5' || t.broker === 'mt5_html' || t.broker === 'mt5_xlsx' || String(t.id || '').startsWith('MT5_')) {
      return ['MT5', String(t.position || t.ticket || '').trim(), String(t.closeTime || t.openTime || '').trim(), Number(t.lots || 0).toFixed(4), Number(t.profit || 0).toFixed(2)].join('|');
    }
    if (t.broker === 'zuperior' || t.ticket === 'Not provided' || !t.ticket) {
      return ['ZUPERIOR', String(t.symbol || '').toUpperCase().trim(), String(t.type || '').toLowerCase().trim(), String(t.openTime || '').trim(), String(t.closeTime || '').trim(), Number(t.lots || 0).toFixed(4), Number(t.openPrice || 0).toFixed(5), Number(t.closePrice || 0).toFixed(5), Number(t.profit || 0).toFixed(2)].join('|');
    }
    return `EXNESS_${t.ticket}_${t.closeTime || t.openTime || ''}_${t.lots}_${t.profit}`;
  }

  function _getTradeSyncKey(t) {
    if (!t) return '';
    if (t.syncId && typeof t.syncId === 'string') return t.syncId;
    return _getTradeFingerprint(t);
  }

  function _tradeContentSignature(t) {
    if (!t || typeof t !== 'object') return '';
    const clone = Object.assign({}, t);
    delete clone.updatedAt;
    delete clone.syncId;
    return _computeChecksum(clone);
  }

  function _normalizeDeletedList(list = []) {
    const map = new Map();
    if (!Array.isArray(list)) return map;
    list.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        map.set(item, { key: item, fingerprint: item, deletedAt: '1970-01-01T00:00:00.000Z' });
      } else if (item.key || item.fingerprint) {
        const key = String(item.key || item.fingerprint);
        const fp = String(item.fingerprint || item.key);
        const delAt = String(item.deletedAt || '1970-01-01T00:00:00.000Z');
        const prev = map.get(key);
        if (!prev || delAt > prev.deletedAt) {
          map.set(key, { key, fingerprint: fp, deletedAt: delAt });
        }
      }
    });
    return map;
  }

  function _parseTimestampMs(iso) {
    if (!iso) return 0;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
  }

  function _snapshotHasData(snap = {}) {
    const hasCustomRules = Array.isArray(snap.rules) &&
      _stableStringify(snap.rules) !== _stableStringify(_defaultRules());
    return (
      (Array.isArray(snap.trades) && snap.trades.length > 0) ||
      (Array.isArray(snap.deletedUids) && snap.deletedUids.length > 0) ||
      Boolean(snap.notes && String(snap.notes).trim().length > 0) ||
      Boolean(snap.startingCapital && Number(snap.startingCapital) > 0) ||
      snap.currency === 'INR' ||
      hasCustomRules ||
      Boolean(snap.mt5Session && snap.mt5Session.isConnected)
    );
  }

  const CloudSyncUtils = {
    SCHEMA_VERSION,
    computeChecksum: _computeChecksum,

    computeLocalDataHash(snapshot = {}) {
      const trades = Array.isArray(snapshot.trades) ? snapshot.trades : [];
      const tradeSigs = trades
        .map((t) => `${_getTradeSyncKey(t)}:${_tradeContentSignature(t)}`)
        .sort();
      return _computeChecksum({
        trades: tradeSigs,
        notes: String(snapshot.notes || ''),
        rules: snapshot.rules || null,
        currency: snapshot.currency || 'USD',
        startingCapital: snapshot.startingCapital || null,
        mt5Connected: Boolean(snapshot.mt5Session && snapshot.mt5Session.isConnected),
        mt5Account: snapshot.mt5Session && snapshot.mt5Session.accountData ? snapshot.mt5Session.accountData.login || '' : ''
      });
    },

    buildTradesPayload(snapshot = {}, nowIso = new Date().toISOString()) {
      const trades = Array.isArray(snapshot.trades)
        ? snapshot.trades.map((t) => ({
            ...t,
            syncId: _getTradeSyncKey(t),
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
    },

    buildJournalPayload(snapshot = {}, nowIso = new Date().toISOString()) {
      return {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: nowIso,
        notes: String(snapshot.notes || ''),
        rules: Array.isArray(snapshot.rules) ? snapshot.rules : _defaultRules()
      };
    },

    buildSettingsPayload(snapshot = {}, owner = null, nowIso = new Date().toISOString()) {
      return {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: nowIso,
        ownerSub: owner && owner.sub ? String(owner.sub) : '',
        currency: snapshot.currency === 'INR' ? 'INR' : 'USD',
        startingCapital: snapshot.startingCapital !== undefined && snapshot.startingCapital !== null
          ? Number(snapshot.startingCapital)
          : null,
        mt5Session: snapshot.mt5Session || null,
        theme: snapshot.theme || undefined
      };
    },

    buildAccountsPayload(snapshot = {}, owner = null, nowIso = new Date().toISOString()) {
      return this.buildSettingsPayload(snapshot, owner, nowIso);
    },

    buildMetadataPayload({ owner, folderIds, revisions, checksums, counts, migratedLocalHash, nowIso = new Date().toISOString() }) {
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
    },

    buildBackupBundle({ snapshot, owner, reason = 'manual', nowIso = new Date().toISOString() }) {
      return {
        schemaVersion: SCHEMA_VERSION,
        backupReason: reason,
        createdAt: nowIso,
        owner: owner ? { sub: owner.sub, email: owner.email, name: owner.name } : null,
        trades: this.buildTradesPayload(snapshot, nowIso),
        journal: this.buildJournalPayload(snapshot, nowIso),
        settings: this.buildSettingsPayload(snapshot, owner, nowIso)
      };
    },

    extractSnapshotFromRemoteDb(remoteDb = {}) {
      const tradesObj = remoteDb.trades || {};
      const journalObj = remoteDb.journal || {};
      const accountsObj = remoteDb.accounts || {};
      const settingsObj = remoteDb.settings || {};

      const notes = typeof journalObj.notes === 'string'
        ? journalObj.notes
        : (typeof settingsObj.notes === 'string' ? settingsObj.notes : '');

      const rules = Array.isArray(journalObj.rules)
        ? journalObj.rules
        : (Array.isArray(settingsObj.rules) ? settingsObj.rules : _defaultRules());

      const mt5Session = settingsObj.mt5Session !== undefined
        ? settingsObj.mt5Session
        : (accountsObj.mt5Session !== undefined ? accountsObj.mt5Session : null);

      return {
        trades: Array.isArray(tradesObj.trades) ? tradesObj.trades : [],
        lastImport: tradesObj.lastImport || null,
        deletedUids: Array.isArray(tradesObj.deletedUids) ? tradesObj.deletedUids : [],
        mt5Session,
        currency: settingsObj.currency === 'INR' ? 'INR' : 'USD',
        startingCapital: settingsObj.startingCapital !== undefined ? settingsObj.startingCapital : null,
        theme: settingsObj.theme || undefined,
        notes,
        rules
      };
    },

    mergeTradeCollections({
      baseTrades = [],
      remoteTrades = [],
      localTrades = [],
      remoteDeleted = [],
      localDeleted = []
    }) {
      const remoteDelMap = _normalizeDeletedList(remoteDeleted);
      const localDelMap = _normalizeDeletedList(localDeleted);

      const baseBySync = new Map();
      const baseByFp = new Map();
      (baseTrades || []).forEach((t) => {
        if (!t) return;
        const sk = _getTradeSyncKey(t);
        const fp = _getTradeFingerprint(t);
        if (sk) baseBySync.set(sk, t);
        if (fp && !baseByFp.has(fp)) baseByFp.set(fp, t);
      });

      const entities = new Map();

      const resolveCanonicalKey = (t) => {
        const sk = _getTradeSyncKey(t);
        const fp = _getTradeFingerprint(t);
        if (entities.has(sk)) return sk;
        for (const [k, ent] of entities.entries()) {
          const ref = ent.remote || ent.local || ent.base;
          if (ref && (_getTradeSyncKey(ref) === sk || (fp && _getTradeFingerprint(ref) === fp))) {
            return k;
          }
        }
        return sk || fp;
      };

      (remoteTrades || []).forEach((rt) => {
        if (!rt) return;
        const key = resolveCanonicalKey(rt);
        const sk = _getTradeSyncKey(rt);
        const fp = _getTradeFingerprint(rt);
        if (!entities.has(key)) {
          entities.set(key, { remote: rt, local: null, base: baseBySync.get(sk) || baseByFp.get(fp) || null });
        } else {
          const ent = entities.get(key);
          if (!ent.remote) ent.remote = rt;
        }
      });

      (localTrades || []).forEach((lt) => {
        if (!lt) return;
        const key = resolveCanonicalKey(lt);
        const sk = _getTradeSyncKey(lt);
        const fp = _getTradeFingerprint(lt);
        if (!entities.has(key)) {
          entities.set(key, { remote: null, local: lt, base: baseBySync.get(sk) || baseByFp.get(fp) || null });
        } else {
          const ent = entities.get(key);
          if (!ent.local) ent.local = lt;
        }
      });

      const findTombstone = (delMap, item) => {
        if (!item) return null;
        const sk = _getTradeSyncKey(item);
        const fp = _getTradeFingerprint(item);
        return delMap.get(sk) || (fp ? delMap.get(fp) : null) || null;
      };

      const mergedTrades = [];
      const activeKeySet = new Set();
      const conflicts = [];

      for (const [, ent] of entities.entries()) {
        const r = ent.remote;
        const l = ent.local;
        const b = ent.base;

        if (r && l) {
          const rSig = _tradeContentSignature(r);
          const lSig = _tradeContentSignature(l);
          const rTime = _parseTimestampMs(r.updatedAt);
          const lTime = _parseTimestampMs(l.updatedAt);
          const stableSyncId = r.syncId || l.syncId || _getTradeSyncKey(r);

          if (rSig === lSig) {
            const chosen = lTime > rTime ? { ...l, syncId: stableSyncId } : { ...r, syncId: stableSyncId };
            mergedTrades.push(chosen);
            activeKeySet.add(stableSyncId);
            activeKeySet.add(_getTradeFingerprint(chosen));
            continue;
          }

          if (b) {
            const bSig = _tradeContentSignature(b);
            if (lSig === bSig && rSig !== bSig) {
              mergedTrades.push({ ...r, syncId: stableSyncId });
              activeKeySet.add(stableSyncId);
              activeKeySet.add(_getTradeFingerprint(r));
              continue;
            }
            if (rSig === bSig && lSig !== bSig) {
              mergedTrades.push({ ...l, syncId: stableSyncId });
              activeKeySet.add(stableSyncId);
              activeKeySet.add(_getTradeFingerprint(l));
              continue;
            }
          }

          const winner = lTime >= rTime ? { ...l, syncId: stableSyncId } : { ...r, syncId: stableSyncId };
          conflicts.push({
            domain: 'trades',
            syncId: stableSyncId,
            symbol: winner.symbol,
            resolution: lTime >= rTime ? 'kept_local' : 'kept_remote',
            remoteUpdatedAt: r.updatedAt || null,
            localUpdatedAt: l.updatedAt || null
          });
          mergedTrades.push(winner);
          activeKeySet.add(stableSyncId);
          activeKeySet.add(_getTradeFingerprint(winner));
          continue;
        }

        if (r && !l) {
          const localTomb = findTombstone(localDelMap, r);
          const rTime = _parseTimestampMs(r.updatedAt);
          const delTime = localTomb ? _parseTimestampMs(localTomb.deletedAt) : 0;
          if (localTomb && delTime >= rTime) {
            continue;
          }
          const sk = _getTradeSyncKey(r);
          mergedTrades.push({ ...r, syncId: sk });
          activeKeySet.add(sk);
          activeKeySet.add(_getTradeFingerprint(r));
          continue;
        }

        if (l && !r) {
          const remoteTomb = findTombstone(remoteDelMap, l);
          const lTime = _parseTimestampMs(l.updatedAt);
          const delTime = remoteTomb ? _parseTimestampMs(remoteTomb.deletedAt) : 0;
          if (remoteTomb && delTime >= lTime) {
            continue;
          }
          const sk = _getTradeSyncKey(l);
          mergedTrades.push({ ...l, syncId: sk });
          activeKeySet.add(sk);
          activeKeySet.add(_getTradeFingerprint(l));
        }
      }

      mergedTrades.sort((a, b) => {
        const ta = String(a.closeTime || a.openTime || '');
        const tb = String(b.closeTime || b.openTime || '');
        if (tb !== ta) return tb.localeCompare(ta);
        return _getTradeSyncKey(a).localeCompare(_getTradeSyncKey(b));
      });

      const mergedDelMap = new Map();
      [remoteDelMap, localDelMap].forEach((map) => {
        for (const [k, item] of map.entries()) {
          if (activeKeySet.has(k) || activeKeySet.has(item.fingerprint)) continue;
          const prev = mergedDelMap.get(k);
          if (!prev || item.deletedAt > prev.deletedAt) {
            mergedDelMap.set(k, item);
          }
        }
      });

      return {
        trades: mergedTrades,
        deletedUids: Array.from(mergedDelMap.values()).slice(-2000),
        conflicts
      };
    },

    mergeSettings({ baseSettings = null, remoteSettings = null, localSettings = null }) {
      const r = remoteSettings || {};
      const l = localSettings || {};
      const b = baseSettings || {};
      const rTime = _parseTimestampMs(r.updatedAt);
      const lTime = _parseTimestampMs(l.updatedAt);
      const conflicts = [];

      const pickField = (field, fallbackVal) => {
        const hasR = r[field] !== undefined;
        const hasL = l[field] !== undefined;
        if (!hasR && !hasL) return fallbackVal;
        if (hasR && !hasL) return r[field];
        if (!hasR && hasL) return l[field];

        const rStr = _stableStringify(r[field]);
        const lStr = _stableStringify(l[field]);
        if (rStr === lStr) return r[field];

        if (b && b[field] !== undefined) {
          const bStr = _stableStringify(b[field]);
          if (lStr === bStr && rStr !== bStr) return r[field];
          if (rStr === bStr && lStr !== bStr) return l[field];
        }

        const useLocal = lTime >= rTime;
        conflicts.push({
          domain: 'settings',
          field,
          resolution: useLocal ? 'kept_local' : 'kept_remote'
        });
        return useLocal ? l[field] : r[field];
      };

      const merged = {
        currency: pickField('currency', 'USD') === 'INR' ? 'INR' : 'USD',
        startingCapital: pickField('startingCapital', null),
        notes: String(pickField('notes', '') || ''),
        rules: pickField('rules', _defaultRules()),
        theme: pickField('theme', undefined)
      };

      return { settings: merged, conflicts };
    },

    mergeAccounts({ baseAccounts = null, remoteAccounts = null, localAccounts = null }) {
      const r = remoteAccounts || {};
      const l = localAccounts || {};
      const b = baseAccounts || {};
      const rTime = _parseTimestampMs(r.updatedAt);
      const lTime = _parseTimestampMs(l.updatedAt);
      const conflicts = [];

      const rSess = r.mt5Session !== undefined ? r.mt5Session : null;
      const lSess = l.mt5Session !== undefined ? l.mt5Session : null;
      const bSess = b && b.mt5Session !== undefined ? b.mt5Session : null;

      let mergedSession = null;
      const rStr = _stableStringify(rSess);
      const lStr = _stableStringify(lSess);

      if (rStr === lStr) {
        mergedSession = rSess;
      } else if (b && bSess !== undefined) {
        const bStr = _stableStringify(bSess);
        if (lStr === bStr) mergedSession = rSess;
        else if (rStr === bStr) mergedSession = lSess;
        else {
          mergedSession = lTime >= rTime ? lSess : rSess;
          conflicts.push({ domain: 'settings', field: 'mt5Session', resolution: lTime >= rTime ? 'kept_local' : 'kept_remote' });
        }
      } else if (!rSess && lSess) {
        mergedSession = lSess;
      } else if (rSess && !lSess) {
        mergedSession = rSess;
      } else {
        mergedSession = lTime >= rTime ? lSess : rSess;
        conflicts.push({ domain: 'settings', field: 'mt5Session', resolution: lTime >= rTime ? 'kept_local' : 'kept_remote' });
      }

      return { accounts: { mt5Session: mergedSession }, conflicts };
    },

    evaluateMigration({
      localSnapshot = {},
      remoteDb = {},
      previousMigratedHash = '',
      dismissedLocalHash = ''
    }) {
      const localTrades = Array.isArray(localSnapshot.trades) ? localSnapshot.trades : [];
      const hasCustomNotes = Boolean(localSnapshot.notes && String(localSnapshot.notes).trim().length > 0);
      const hasCustomCapital = Boolean(localSnapshot.startingCapital && Number(localSnapshot.startingCapital) > 0);
      const hasCustomCurrency = localSnapshot.currency === 'INR';
      const hasCustomMt5 = Boolean(localSnapshot.mt5Session && localSnapshot.mt5Session.isConnected);
      const hasNonDefaultRules = Array.isArray(localSnapshot.rules) &&
        _stableStringify(localSnapshot.rules) !== _stableStringify(_defaultRules());

      const localHasData = localTrades.length > 0 ||
        hasCustomNotes ||
        hasCustomCapital ||
        hasCustomCurrency ||
        hasCustomMt5 ||
        hasNonDefaultRules;
      const localHash = this.computeLocalDataHash(localSnapshot);

      const remoteSnap = this.extractSnapshotFromRemoteDb(remoteDb);
      const remoteTrades = remoteSnap.trades || [];
      const remoteHasNonDefaultRules = Array.isArray(remoteSnap.rules) &&
        _stableStringify(remoteSnap.rules) !== _stableStringify(_defaultRules());
      const remoteHasData = remoteTrades.length > 0 ||
        (Array.isArray(remoteSnap.deletedUids) && remoteSnap.deletedUids.length > 0) ||
        Boolean(remoteSnap.notes && remoteSnap.notes.trim().length > 0) ||
        Boolean(remoteSnap.startingCapital && Number(remoteSnap.startingCapital) > 0) ||
        remoteSnap.currency === 'INR' ||
        remoteHasNonDefaultRules ||
        Boolean(remoteSnap.mt5Session && remoteSnap.mt5Session.isConnected);

      const remoteMetaMigratedHash = remoteDb?.metadata?.migratedLocalHash || '';
      const alreadyMigrated = Boolean(
        localHasData && (
          previousMigratedHash === localHash ||
          remoteMetaMigratedHash === localHash ||
          dismissedLocalHash === localHash
        )
      );

      const remoteKeySet = new Set();
      remoteTrades.forEach((rt) => {
        remoteKeySet.add(_getTradeSyncKey(rt));
        remoteKeySet.add(_getTradeFingerprint(rt));
      });
      let duplicateCount = 0;
      let newFromLocalCount = 0;
      localTrades.forEach((lt) => {
        const sk = _getTradeSyncKey(lt);
        const fp = _getTradeFingerprint(lt);
        if (remoteKeySet.has(sk) || remoteKeySet.has(fp)) duplicateCount++;
        else newFromLocalCount++;
      });

      const stats = {
        localTradeCount: localTrades.length,
        remoteTradeCount: remoteTrades.length,
        duplicateCount,
        newFromLocalCount,
        mergedTotalCount: remoteTrades.length + newFromLocalCount,
        localHasNotes: hasCustomNotes,
        localHasCapital: hasCustomCapital,
        localHasMt5: hasCustomMt5
      };

      if (remoteHasData && (!localHasData || alreadyMigrated || (newFromLocalCount === 0 && !hasCustomNotes && !hasCustomCapital && !hasCustomCurrency && !hasCustomMt5 && !hasNonDefaultRules))) {
        return { scenario: 'RESTORE_CLOUD', stats, localHash };
      }

      if (!remoteHasData && localHasData && !alreadyMigrated) {
        return { scenario: 'MIGRATE_LOCAL', stats, localHash };
      }

      if (remoteHasData && localHasData && !alreadyMigrated) {
        return { scenario: 'MERGE_OR_CHOOSE', stats, localHash };
      }

      if (remoteHasData) {
        return { scenario: 'RESTORE_CLOUD', stats, localHash };
      }

      return { scenario: 'INIT_EMPTY', stats, localHash };
    }
  };

  const CloudSyncManager = {
    status: 'local_only', // 'local_only' | 'syncing' | 'synced' | 'offline' | 'sync_failed' | 'auth_expired' | 'migration_pending' | 'conflict'
    lastSyncedAt: null,
    lastError: null,
    folderIds: null,
    pendingMigration: null,
    lastConflicts: [],
    _initialized: false,
    _booting: false,
    _listeners: [],
    _unsubscribeStorage: null,
    _unsubscribeAuth: null,
    _unsubscribeTheme: null,
    _debounceTimer: null,
    _retryTimer: null,
    _retryAttempt: 0,
    _syncPromise: null,
    _signedInFlowPromise: null,
    _signedInSub: null,
    _resyncRequested: false,

    _getMetaKey(sub) {
      return `${META_PREFIX}${_hashNamespace(sub)}`;
    },

    _getLegacyMetaKey(sub) {
      return `tradeforge_cloud_meta_${_hashNamespace(sub)}`;
    },

    _getBaseKey(sub) {
      return `${BASE_PREFIX}${_hashNamespace(sub)}`;
    },

    _getLegacyBaseKey(sub) {
      return `tradeforge_cloud_base_${_hashNamespace(sub)}`;
    },

    _exportActiveWithTheme() {
      const snap = typeof StorageManager !== 'undefined' ? StorageManager.exportActiveSnapshot() : {};
      if (typeof ThemeManager !== 'undefined' && typeof ThemeManager.getTheme === 'function') {
        snap.theme = ThemeManager.getTheme();
      }
      return snap;
    },

    _readMeta(sub) {
      const storage = _getStorage();
      const defaults = {
        folderIds: null,
        fileIds: { metadata: null, trades: null, journal: null, settings: null },
        revisions: { trades: 0, journal: 0, settings: 0 },
        checksums: { trades: '', journal: '', settings: '' },
        dirtyDomains: { trades: false, journal: false, settings: false },
        migratedLocalHash: '',
        dismissedLocalHash: '',
        lastSyncedAt: null
      };
      if (!storage || !sub) return defaults;
      try {
        let raw = storage.getItem(this._getMetaKey(sub));
        let fromLegacyKey = false;
        if (!raw) {
          raw = storage.getItem(this._getLegacyMetaKey(sub));
          fromLegacyKey = Boolean(raw);
        }
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const rev = parsed.revisions || {};
        const sums = parsed.checksums || {};
        const dirty = parsed.dirtyDomains || {};
        return {
          folderIds: fromLegacyKey ? null : (parsed.folderIds || null),
          fileIds: fromLegacyKey
            ? Object.assign({}, defaults.fileIds)
            : Object.assign({}, defaults.fileIds, parsed.fileIds || {}),
          revisions: {
            trades: Number(rev.trades) || 0,
            journal: Number(rev.journal !== undefined ? rev.journal : rev.settings) || 0,
            settings: Number(rev.settings !== undefined ? rev.settings : rev.accounts) || 0
          },
          checksums: {
            trades: sums.trades || '',
            journal: sums.journal || sums.settings || '',
            settings: sums.settings || sums.accounts || ''
          },
          dirtyDomains: {
            trades: Boolean(dirty.trades),
            journal: Boolean(dirty.journal !== undefined ? dirty.journal : dirty.settings),
            settings: Boolean(dirty.settings || dirty.accounts)
          },
          migratedLocalHash: parsed.migratedLocalHash || '',
          dismissedLocalHash: parsed.dismissedLocalHash || '',
          lastSyncedAt: parsed.lastSyncedAt || null
        };
      } catch (e) {
        return defaults;
      }
    },

    _writeMeta(sub, patch) {
      const storage = _getStorage();
      if (!storage || !sub) return;
      const current = this._readMeta(sub);
      const next = {
        ...current,
        ...patch,
        fileIds: patch.fileIds ? Object.assign({}, current.fileIds, patch.fileIds) : current.fileIds,
        revisions: patch.revisions ? Object.assign({}, current.revisions, patch.revisions) : current.revisions,
        checksums: patch.checksums ? Object.assign({}, current.checksums, patch.checksums) : current.checksums,
        dirtyDomains: patch.dirtyDomains ? Object.assign({}, current.dirtyDomains, patch.dirtyDomains) : current.dirtyDomains
      };
      try {
        storage.setItem(this._getMetaKey(sub), JSON.stringify(next));
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist cloud metadata:', e);
        }
      }
      return next;
    },

    _readBaseSnapshot(sub) {
      const storage = _getStorage();
      if (!storage || !sub) return null;
      try {
        let raw = storage.getItem(this._getBaseKey(sub));
        if (!raw) {
          raw = storage.getItem(this._getLegacyBaseKey(sub));
        }
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    _writeBaseSnapshot(sub, snapshot) {
      const storage = _getStorage();
      if (!storage || !sub) return;
      try {
        storage.setItem(this._getBaseKey(sub), JSON.stringify(snapshot));
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist cloud sync baseline:', e);
        }
      }
    },

    _clearTimers() {
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      if (this._retryTimer) {
        clearTimeout(this._retryTimer);
        this._retryTimer = null;
      }
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this._listeners.push(listener);
      return () => {
        this._listeners = this._listeners.filter((fn) => fn !== listener);
      };
    },

    _emit(eventType, detail = {}) {
      const state = this.getState();
      state.eventType = eventType;
      state.detail = detail;
      this._listeners.slice().forEach((fn) => {
        try {
          fn(state);
        } catch (e) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('CloudSyncManager listener error:', e);
          }
        }
      });
    },

    getState() {
      const authState = typeof GoogleAuthManager !== 'undefined'
        ? GoogleAuthManager.getState()
        : {
            status: 'signed_out',
            isConfigured: false,
            isSignedIn: false,
            hasValidToken: false,
            account: null
          };
      const sub = authState.account ? authState.account.sub : null;
      const meta = sub ? this._readMeta(sub) : null;
      const dirtyDomains = meta ? meta.dirtyDomains : { trades: false, journal: false, settings: false };
      const hasDirty = Boolean(dirtyDomains.trades || dirtyDomains.journal || dirtyDomains.settings);

      return {
        status: this.status,
        auth: authState,
        account: authState.account,
        isCloudActive: Boolean(sub),
        hasDirtyChanges: hasDirty,
        dirtyDomains,
        lastSyncedAt: this.lastSyncedAt || (meta ? meta.lastSyncedAt : null),
        folderIds: this.folderIds || (meta ? meta.folderIds : null),
        pendingMigration: this.pendingMigration ? { ...this.pendingMigration } : null,
        lastConflicts: [...this.lastConflicts],
        lastError: this.lastError ? { ...this.lastError } : null
      };
    },

    async init() {
      if (this._initialized) return this.getState();
      this._initialized = true;
      this._booting = true;

      if (this._unsubscribeStorage) this._unsubscribeStorage();
      if (typeof StorageManager !== 'undefined' && StorageManager.subscribe) {
        this._unsubscribeStorage = StorageManager.subscribe((event) => {
          this._onStorageMutation(event);
        });
      }

      if (this._unsubscribeTheme) {
        this._unsubscribeTheme();
        this._unsubscribeTheme = null;
      }

      if (this._unsubscribeAuth) this._unsubscribeAuth();
      if (typeof GoogleAuthManager !== 'undefined' && GoogleAuthManager.subscribe) {
        this._unsubscribeAuth = GoogleAuthManager.subscribe((authEvent) => {
          if (!this._booting) {
            this._onAuthEvent(authEvent);
          }
        });
      }

      if (typeof global.addEventListener === 'function') {
        global.addEventListener('online', () => this._onNetworkOnline());
        global.addEventListener('offline', () => this._onNetworkOffline());
        global.addEventListener('beforeunload', (e) => {
          const st = this.getState();
          if (st.isCloudActive && (st.hasDirtyChanges || st.status === 'syncing')) {
            e.preventDefault();
            e.returnValue = '';
          }
        });
      }

      let authState = typeof GoogleAuthManager !== 'undefined' ? GoogleAuthManager.init() : { isSignedIn: false };

      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        if (typeof GoogleAuthManager !== 'undefined' && typeof GoogleAuthManager.checkSession === 'function') {
          authState = await GoogleAuthManager.checkSession();
        }
      }

      this._booting = false;

      if (authState.isSignedIn && authState.account && authState.account.sub) {
        const sub = authState.account.sub;
        if (typeof StorageManager !== 'undefined' && StorageManager.setActiveNamespace) {
          StorageManager.setActiveNamespace(sub, { silent: true });
        }
        const meta = this._readMeta(sub);
        this.folderIds = meta.folderIds;
        this.lastSyncedAt = meta.lastSyncedAt;

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.status = 'offline';
        } else if (authState.hasValidToken) {
          await this._handleSignedInFlow(authState.account);
        } else {
          this.status = 'auth_expired';
        }
      } else {
        if (typeof StorageManager !== 'undefined' && StorageManager.setActiveNamespace) {
          StorageManager.setActiveNamespace('anonymous', { silent: true });
        }
        this.status = 'local_only';
      }

      this._emit('init');
      return this.getState();
    },

    _onThemeChanged() {
      // Visual theme preferences remain local-only so switching themes never
      // triggers cloud sync, reloads, or remote workspace pulls.
      return;
    },

    _onStorageMutation(event) {
      if (!event || event.silentSync) return;
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account || !GoogleAuthManager.account.sub) {
        return;
      }
      const sub = GoogleAuthManager.account.sub;
      if (event.namespace !== sub) return;

      const meta = this._readMeta(sub);
      const nextDirty = Object.assign({}, meta.dirtyDomains);
      if (event.domain === 'all') {
        nextDirty.trades = true;
        nextDirty.journal = true;
        nextDirty.settings = true;
      } else if (event.domain === 'trades') {
        nextDirty.trades = true;
      } else if (event.domain === 'journal') {
        nextDirty.journal = true;
      } else if (event.domain === 'accounts') {
        nextDirty.settings = true;
      } else if (event.domain === 'settings') {
        if (event.reason === 'save_notes' || event.reason === 'save_rules') {
          nextDirty.journal = true;
        } else if (event.reason === 'save_currency' || event.reason === 'save_starting_capital') {
          nextDirty.settings = true;
        } else {
          nextDirty.journal = true;
          nextDirty.settings = true;
        }
      } else {
        nextDirty.trades = true;
      }

      this._writeMeta(sub, { dirtyDomains: nextDirty });

      if (this.status === 'migration_pending') {
        this._emit('status');
        return;
      }

      this._scheduleAutoSync();
    },

    async _onAuthEvent(authEvent) {
      if (!authEvent) return;
      const ev = authEvent.eventType;

      if (ev === 'signed_in' && authEvent.account) {
        await this._handleSignedInFlow(authEvent.account, authEvent.detail || {});
        return;
      }

      if (ev === 'auth_expired') {
        this._clearTimers();
        if (typeof GoogleAuthManager !== 'undefined' && GoogleAuthManager.account) {
          this.status = 'auth_expired';
          this.lastError = { code: 'AUTH_EXPIRED', message: 'Google session expired. Reconnect to resume syncing.' };
          this._emit('auth_expired');
        }
        return;
      }

      if (ev === 'signed_out') {
        this._clearTimers();
        this.pendingMigration = null;
        this.folderIds = null;
        this.lastSyncedAt = null;
        this.lastConflicts = [];
        this.lastError = null;
        this.status = 'local_only';

        if (typeof StorageManager !== 'undefined' && StorageManager.setActiveNamespace) {
          StorageManager.setActiveNamespace('anonymous');
        }
        this._emit('workspace_reloaded', { reason: 'signed_out' });
        this._emit('signed_out');
      }
    },

    _onNetworkOffline() {
      if (typeof GoogleAuthManager !== 'undefined' && GoogleAuthManager.account) {
        this._clearTimers();
        this.status = 'offline';
        this._emit('status');
      }
    },

    async _onNetworkOnline() {
      if (typeof GoogleAuthManager === 'undefined') return;
      await GoogleAuthManager.checkSession();
      if (!GoogleAuthManager.account) return;
      if (!GoogleAuthManager.hasValidToken()) {
        this.status = 'auth_expired';
        this._emit('status');
        return;
      }
      const sub = GoogleAuthManager.account.sub;
      const meta = this._readMeta(sub);
      const hasDirty = meta.dirtyDomains.trades || meta.dirtyDomains.journal || meta.dirtyDomains.settings;
      if (hasDirty || this.status === 'offline' || this.status === 'sync_failed') {
        try {
          await this.syncNow({ reason: 'network_online' });
        } catch (e) {
          // Handled inside syncNow
        }
      }
    },

    _scheduleAutoSync() {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._emit('status');

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.status = 'offline';
        this._emit('status');
        return;
      }

      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.hasValidToken()) {
        if (GoogleAuthManager && GoogleAuthManager.account) {
          this.status = 'auth_expired';
          this._emit('status');
        }
        return;
      }

      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this.syncNow({ reason: 'auto_debounce' }).catch(() => {});
      }, DEBOUNCE_MS);
    },

    _scheduleRetry(sub) {
      if (this._retryAttempt >= RETRY_DELAYS_MS.length) {
        return;
      }
      const delay = RETRY_DELAYS_MS[this._retryAttempt];
      this._retryAttempt++;
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        if (
          typeof GoogleAuthManager !== 'undefined' &&
          GoogleAuthManager.account &&
          GoogleAuthManager.account.sub === sub &&
          GoogleAuthManager.hasValidToken()
        ) {
          this.syncNow({ reason: 'retry' }).catch(() => {});
        }
      }, delay);
    },

    async _handleSignedInFlow(account, detail = {}) {
      const sub = account && account.sub;
      if (!sub) return this.getState();

      if (this._signedInFlowPromise && this._signedInSub === sub) {
        return this._signedInFlowPromise;
      }

      const prevFlow = this._signedInFlowPromise;
      this._signedInSub = sub;

      const isCurrentAccount = () =>
        typeof GoogleAuthManager === 'undefined' ||
        (GoogleAuthManager.account && GoogleAuthManager.account.sub === sub);

      const run = (async () => {
        if (prevFlow) {
          await prevFlow.catch(() => {});
        }
        if (!isCurrentAccount()) {
          return this.getState();
        }

        this._clearTimers();
        this._retryAttempt = 0;
        this.lastError = null;
        this.pendingMigration = null;

        if (typeof StorageManager !== 'undefined' && StorageManager.setActiveNamespace) {
          StorageManager.setActiveNamespace(sub, { silent: true });
        }
        this._emit('workspace_reloaded', { reason: 'account_switch', account });

        this.status = 'syncing';
        this._emit('status');

        try {
          const meta = this._readMeta(sub);
          const remoteDb = await GoogleDriveStorage.readDatabase({
            ownerSub: sub,
            folderIds: meta.folderIds
          });

          if (!isCurrentAccount()) {
            return this.getState();
          }

          this.folderIds = remoteDb.folderIds;
          this._writeMeta(sub, {
            folderIds: remoteDb.folderIds,
            fileIds: remoteDb.fileIds
          });

          const accountSnap = this._exportActiveWithTheme();
          const accountHasData = _snapshotHasData(accountSnap);
          const hasDirty = meta.dirtyDomains.trades || meta.dirtyDomains.journal || meta.dirtyDomains.settings;

          const anonInfo = StorageManager.getAnonymousBaselineInfo
            ? StorageManager.getAnonymousBaselineInfo()
            : { hasAnyData: false, snapshot: {} };

          // Returning account session on this browser: sync/merge account namespace with Drive cleanly first
          if (accountHasData || hasDirty || meta.lastSyncedAt) {
            await this._reconcileAccountWithRemote(account, remoteDb, {
              allowConflictAutoResolve: true,
              fullCheck: true
            });

            if (!isCurrentAccount()) {
              return this.getState();
            }

            // Also check if anonymous local storage holds separate unmigrated local trades
            if (anonInfo.hasAnyData) {
              const updatedRemote = await GoogleDriveStorage.readDatabase({
                ownerSub: sub,
                folderIds: remoteDb.folderIds
              });
              if (!isCurrentAccount()) {
                return this.getState();
              }
              const refreshedMeta = this._readMeta(sub);
              const migEval = CloudSyncUtils.evaluateMigration({
                localSnapshot: anonInfo.snapshot,
                remoteDb: updatedRemote,
                previousMigratedHash: refreshedMeta.migratedLocalHash,
                dismissedLocalHash: refreshedMeta.dismissedLocalHash
              });

              if (migEval.scenario === 'MERGE_OR_CHOOSE' || migEval.scenario === 'MIGRATE_LOCAL') {
                this.pendingMigration = {
                  ...migEval,
                  account,
                  remoteDb: updatedRemote,
                  localSnapshot: anonInfo.snapshot
                };
                this.status = 'migration_pending';
                this._emit('migration_required', this.pendingMigration);
                return this.getState();
              }
            }

            this.status = 'synced';
            this._emit('synced', { reason: detail.switchedAccount ? 'account_switched' : 'reconnected' });
            return this.getState();
          }

          // First login for this Google account on this browser: inspect anonymous local storage safely
          const evaluation = CloudSyncUtils.evaluateMigration({
            localSnapshot: anonInfo.snapshot,
            remoteDb,
            previousMigratedHash: meta.migratedLocalHash,
            dismissedLocalHash: meta.dismissedLocalHash
          });

          if (evaluation.scenario === 'MIGRATE_LOCAL' || evaluation.scenario === 'MERGE_OR_CHOOSE') {
            this.pendingMigration = {
              ...evaluation,
              account,
              remoteDb,
              localSnapshot: anonInfo.snapshot
            };
            this.status = 'migration_pending';
            this._emit('migration_required', this.pendingMigration);
            return this.getState();
          }

          if (evaluation.scenario === 'RESTORE_CLOUD') {
            await this._applyRemoteDbToAccount(sub, remoteDb);
            this._emit('workspace_reloaded', {
              reason: (remoteDb.legacySource && remoteDb.legacyRootName === 'TradeForge') ? 'legacy_migrated' : 'cloud_loaded'
            });
            if (remoteDb.legacySource && remoteDb.legacyRootName === 'TradeForge') {
              try {
                const pulledSnap = CloudSyncUtils.extractSnapshotFromRemoteDb(remoteDb);
                await this._pushSnapshotToDrive(account, pulledSnap, {
                  forceAllDomains: true,
                  force: true,
                  folderIds: remoteDb.folderIds,
                  fileIds: remoteDb.fileIds
                });
              } catch (adoptErr) {
                if (typeof console !== 'undefined' && console.warn) {
                  console.warn('Could not mirror legacy TradeForge data to TradeFourge:', adoptErr);
                }
              }
            }
            this.status = 'synced';
            this._emit('synced', { reason: 'cloud_loaded' });
            return this.getState();
          }

          // INIT_EMPTY:
          // - If remote already has existing files on Drive, apply them read-only without pushing or creating folders.
          // - If remote folder already exists without files yet, reuse it cleanly without creating a new folder.
          // - Only on true first-time login (no folder exists in Drive yet), initialize Drive once.
          if (remoteDb.exists) {
            await this._applyRemoteDbToAccount(sub, remoteDb);
            this._emit('workspace_reloaded', { reason: 'cloud_loaded' });
            this.status = 'synced';
            this._emit('synced', { reason: 'cloud_loaded' });
          } else if (remoteDb.folderExists && remoteDb.folderIds) {
            this.folderIds = remoteDb.folderIds;
            this._writeMeta(sub, {
              folderIds: remoteDb.folderIds,
              fileIds: remoteDb.fileIds
            });
            this.status = 'synced';
            this._emit('synced', { reason: 'initialized_empty' });
          } else {
            await this._pushSnapshotToDrive(account, accountSnap, {
              forceAllDomains: true,
              force: true,
              folderIds: remoteDb.folderIds,
              fileIds: remoteDb.fileIds
            });
            this.status = 'synced';
            this._emit('synced', { reason: 'initialized_empty' });
          }
          return this.getState();
        } catch (err) {
          if (isCurrentAccount()) {
            this._handleSyncError(sub, err);
          }
          return this.getState();
        }
      })();

      this._signedInFlowPromise = run;
      try {
        return await run;
      } finally {
        if (this._signedInFlowPromise === run) {
          this._signedInFlowPromise = null;
          this._signedInSub = null;
        }
      }
    },

    async resolveMigration(choice) {
      if (!this.pendingMigration) {
        throw new Error('No pending migration decision.');
      }

      const { account, remoteDb, localSnapshot, localHash } = this.pendingMigration;
      const sub = account.sub;
      this.status = 'syncing';
      this._emit('status');

      try {
        let finalSnapshot;

        if (choice === 'use_cloud') {
          await this._applyRemoteDbToAccount(sub, remoteDb);
          this._writeMeta(sub, { dismissedLocalHash: localHash });
          this.pendingMigration = null;
          this.status = 'synced';
          this._emit('workspace_reloaded', { reason: 'use_cloud' });
          this._emit('synced', { reason: 'use_cloud' });
          return { action: choice, verified: true, tradeCount: (remoteDb.trades?.trades || []).length };
        }

        if (choice === 'start_empty') {
          const emptySnap = {
            trades: [],
            lastImport: null,
            deletedUids: [],
            notes: '',
            rules: _defaultRules(),
            currency: 'USD',
            startingCapital: null,
            mt5Session: null,
            theme: typeof ThemeManager !== 'undefined' ? ThemeManager.getTheme() : undefined
          };
          StorageManager.applySnapshot(emptySnap, { silentSync: true });
          const pushRes = await this._pushSnapshotToDrive(account, emptySnap, {
            forceAllDomains: true,
            force: true,
            allowEmptyOverwrite: true,
            folderIds: remoteDb.folderIds,
            fileIds: remoteDb.fileIds,
            migratedLocalHash: ''
          });
          this._writeMeta(sub, { dismissedLocalHash: localHash });
          this.pendingMigration = null;
          this.status = 'synced';
          this._emit('workspace_reloaded', { reason: 'start_empty' });
          this._emit('synced', { reason: 'start_empty' });
          return { action: choice, verified: Boolean(pushRes.verified), tradeCount: 0 };
        }

        if (choice === 'migrate_local' || choice === 'replace_cloud') {
          finalSnapshot = {
            ...localSnapshot,
            trades: (localSnapshot.trades || []).map((t) => ({
              ...t,
              syncId: _getTradeSyncKey(t),
              updatedAt: t.updatedAt || new Date().toISOString()
            })),
            theme: typeof ThemeManager !== 'undefined' ? ThemeManager.getTheme() : localSnapshot.theme
          };
        } else {
          // 'merge': Combine local anonymous data with remote cloud data cleanly without duplicates
          const remoteSnap = CloudSyncUtils.extractSnapshotFromRemoteDb(remoteDb);
          const tradeMerge = CloudSyncUtils.mergeTradeCollections({
            baseTrades: [],
            remoteTrades: remoteSnap.trades,
            localTrades: localSnapshot.trades,
            remoteDeleted: remoteSnap.deletedUids,
            localDeleted: localSnapshot.deletedUids
          });
          const settingsMerge = CloudSyncUtils.mergeSettings({
            baseSettings: null,
            remoteSettings: { ...remoteSnap, updatedAt: remoteDb.settings?.updatedAt || remoteDb.journal?.updatedAt },
            localSettings: { ...localSnapshot, updatedAt: new Date().toISOString() }
          });
          const acctMerge = CloudSyncUtils.mergeAccounts({
            baseAccounts: null,
            remoteAccounts: { mt5Session: remoteSnap.mt5Session, updatedAt: remoteDb.settings?.updatedAt || remoteDb.accounts?.updatedAt },
            localAccounts: { mt5Session: localSnapshot.mt5Session, updatedAt: new Date().toISOString() }
          });

          finalSnapshot = {
            trades: tradeMerge.trades,
            lastImport: localSnapshot.lastImport || remoteSnap.lastImport || {
              timestamp: new Date().toISOString(),
              fileName: 'Local + Cloud Merge',
              count: tradeMerge.trades.length
            },
            deletedUids: tradeMerge.deletedUids,
            notes: settingsMerge.settings.notes,
            rules: settingsMerge.settings.rules,
            currency: settingsMerge.settings.currency,
            startingCapital: settingsMerge.settings.startingCapital,
            mt5Session: acctMerge.accounts.mt5Session,
            theme: settingsMerge.settings.theme || (typeof ThemeManager !== 'undefined' ? ThemeManager.getTheme() : undefined)
          };
        }

        // Apply merged/migrated state strictly to Google account namespace (anonymous stays untouched!)
        StorageManager.applySnapshot(finalSnapshot, { silentSync: true });

        // Push to Drive with server-side safety backup (when remote exists) & post-write readback verification
        const pushRes = await this._pushSnapshotToDrive(account, finalSnapshot, {
          forceAllDomains: true,
          force: true,
          createSafetyBackup: Boolean(remoteDb.exists),
          backupReason: `pre-${choice}`,
          folderIds: remoteDb.folderIds,
          fileIds: remoteDb.fileIds,
          migratedLocalHash: localHash,
          verify: true
        });

        this._writeMeta(sub, { migratedLocalHash: localHash });
        this.pendingMigration = null;
        this.status = 'synced';
        this._emit('workspace_reloaded', { reason: 'migration_complete' });
        this._emit('migration_complete', {
          action: choice,
          verified: Boolean(pushRes.verified),
          tradeCount: finalSnapshot.trades.length,
          backupFile: pushRes.backupFile || null
        });
        this._emit('synced', { reason: 'migration_complete' });

        return {
          action: choice,
          verified: Boolean(pushRes.verified),
          tradeCount: finalSnapshot.trades.length,
          backupFile: pushRes.backupFile || null
        };
      } catch (err) {
        this._handleSyncError(sub, err);
        throw err;
      }
    },

    async _applyRemoteDbToAccount(sub, remoteDb) {
      const remoteSnap = CloudSyncUtils.extractSnapshotFromRemoteDb(remoteDb);
      StorageManager.applySnapshot(remoteSnap, { silentSync: true });

      const hasLocalTheme = typeof ThemeManager !== 'undefined' &&
        typeof ThemeManager.hasStoredThemePreference === 'function' &&
        ThemeManager.hasStoredThemePreference();
      if (!hasLocalTheme && remoteSnap.theme && typeof ThemeManager !== 'undefined' && ThemeManager.isValidTheme && ThemeManager.isValidTheme(remoteSnap.theme)) {
        ThemeManager.applyTheme(remoteSnap.theme, { persist: true, silent: false });
      }

      const rev = (remoteDb.metadata && remoteDb.metadata.revisions) || {};
      const baseRevisions = {
        trades: Number(rev.trades) || 1,
        journal: Number(rev.journal !== undefined ? rev.journal : rev.settings) || 1,
        settings: Number(rev.settings !== undefined ? rev.settings : rev.accounts) || 1
      };
      const nowIso = new Date().toISOString();

      this.folderIds = remoteDb.folderIds;
      this.lastSyncedAt = nowIso;
      this._writeBaseSnapshot(sub, remoteSnap);
      this._writeMeta(sub, {
        folderIds: remoteDb.folderIds,
        fileIds: remoteDb.fileIds,
        revisions: baseRevisions,
        checksums: remoteDb.metadata?.checksums || {},
        dirtyDomains: { trades: false, journal: false, settings: false },
        migratedLocalHash: remoteDb.metadata?.migratedLocalHash || this._readMeta(sub).migratedLocalHash,
        lastSyncedAt: nowIso
      });
    },

    async _pushSnapshotToDrive(account, snapshot, options = {}) {
      const sub = account.sub;
      const meta = this._readMeta(sub);
      const dirty = options.forceAllDomains
        ? { trades: true, journal: true, settings: true }
        : Object.assign({}, meta.dirtyDomains);

      const hasTombstones = Array.isArray(snapshot.deletedUids) && snapshot.deletedUids.length > 0;

      try {
        const res = await GoogleDriveStorage.pushSnapshot({
          snapshot,
          expectedRevisions: options.force ? null : meta.revisions,
          expectedChecksums: options.force ? null : meta.checksums,
          dirtyDomains: dirty,
          forceAllDomains: Boolean(options.forceAllDomains),
          force: Boolean(options.force),
          allowEmptyOverwrite: Boolean(options.allowEmptyOverwrite || (hasTombstones && snapshot.trades.length === 0)),
          createSafetyBackup: Boolean(options.createSafetyBackup),
          backupReason: options.backupReason || 'pre-sync',
          migratedLocalHash: options.migratedLocalHash !== undefined ? options.migratedLocalHash : meta.migratedLocalHash,
          cachedFolderIds: options.folderIds || meta.folderIds || {},
          verify: options.verify !== false
        });

        const nowIso = (res.metadata && res.metadata.lastSyncedAt) || new Date().toISOString();
        this.folderIds = res.folderIds || meta.folderIds;
        this.lastSyncedAt = nowIso;
        this._writeBaseSnapshot(sub, snapshot);
        this._writeMeta(sub, {
          folderIds: res.folderIds || meta.folderIds,
          fileIds: res.fileIds || meta.fileIds,
          revisions: (res.metadata && res.metadata.revisions) || meta.revisions,
          checksums: (res.metadata && res.metadata.checksums) || meta.checksums,
          dirtyDomains: { trades: false, journal: false, settings: false },
          migratedLocalHash: res.metadata?.migratedLocalHash ?? meta.migratedLocalHash,
          lastSyncedAt: nowIso
        });

        return res;
      } catch (err) {
        if ((err.code === 'CONFLICT' || err.code === 'EMPTY_OVERWRITE_BLOCKED') && err.remoteDb && !options._conflictRetried) {
          await this._reconcileAccountWithRemote(account, err.remoteDb, { _conflictRetried: true });
          return {
            ok: true,
            verified: true,
            folderIds: this.folderIds,
            metadata: this._readMeta(sub)
          };
        }
        throw err;
      }
    },

    async _reconcileAccountWithRemote(account, remoteDb, options = {}) {
      const sub = account.sub;
      const meta = this._readMeta(sub);
      const localSnap = this._exportActiveWithTheme();
      const baseSnap = this._readBaseSnapshot(sub) || {};

      if (!remoteDb.exists) {
        await this._pushSnapshotToDrive(account, localSnap, {
          forceAllDomains: true,
          force: true,
          folderIds: remoteDb.folderIds,
          fileIds: remoteDb.fileIds
        });
        return { merged: false, pushed: true };
      }

      const remoteSnap = CloudSyncUtils.extractSnapshotFromRemoteDb(remoteDb);
      const hasDirty = meta.dirtyDomains.trades || meta.dirtyDomains.journal || meta.dirtyDomains.settings;
      const rRev = remoteDb.metadata?.revisions || {};
      const remoteRev = {
        trades: Number(rRev.trades) || 1,
        journal: Number(rRev.journal !== undefined ? rRev.journal : rRev.settings) || 1,
        settings: Number(rRev.settings !== undefined ? rRev.settings : rRev.accounts) || 1
      };
      const remoteSums = remoteDb.metadata?.checksums || {};
      const remoteJournalSum = remoteSums.journal || remoteSums.settings || '';
      const remoteSettingsSum = remoteSums.settings || remoteSums.accounts || '';

      const checksumDrifted = Boolean(
        (remoteSums.trades && meta.checksums.trades && remoteSums.trades !== meta.checksums.trades) ||
        (remoteJournalSum && meta.checksums.journal && remoteJournalSum !== meta.checksums.journal) ||
        (remoteSettingsSum && meta.checksums.settings && remoteSettingsSum !== meta.checksums.settings)
      );
      const remoteDrifted = Boolean(
        !meta.lastSyncedAt ||
        remoteRev.trades > (meta.revisions.trades || 0) ||
        remoteRev.journal > (meta.revisions.journal || 0) ||
        remoteRev.settings > (meta.revisions.settings || 0) ||
        checksumDrifted
      );

      const localDataHash = CloudSyncUtils.computeLocalDataHash(localSnap);
      const remoteDataHash = CloudSyncUtils.computeLocalDataHash(remoteSnap);
      const contentDiffers = localDataHash !== remoteDataHash;
      const localHasData = _snapshotHasData(localSnap);
      const remoteHasData = _snapshotHasData(remoteSnap);
      const forceAdoptLegacy = Boolean(remoteDb.legacySource && remoteDb.legacyRootName === 'TradeForge');
      const remoteCountMismatch = Boolean(
        Number(remoteDb.metadata?.counts?.trades || 0) > 0 &&
        (!Array.isArray(localSnap.trades) || localSnap.trades.length === 0)
      );
      const checksumUnavailableAndContentDiffers = Boolean(
        contentDiffers && remoteHasData && options.fullCheck && (!remoteSums.trades || !meta.checksums.trades)
      );
      const shouldPullRemote = Boolean(
        remoteDrifted ||
        (forceAdoptLegacy && (!localHasData || contentDiffers)) ||
        (contentDiffers && remoteHasData && (!localHasData || remoteCountMismatch || checksumUnavailableAndContentDiffers))
      );

      // No local dirty edits -> fast-forward pull from Drive when remote drifted, differs, or bridges TradeForge
      if (!hasDirty && shouldPullRemote) {
        await this._applyRemoteDbToAccount(sub, remoteDb);
        this._emit('workspace_reloaded', { reason: forceAdoptLegacy ? 'legacy_migrated' : 'remote_pulled' });
        if (forceAdoptLegacy) {
          try {
            await this._pushSnapshotToDrive(account, remoteSnap, {
              forceAllDomains: true,
              force: true,
              folderIds: remoteDb.folderIds,
              fileIds: remoteDb.fileIds
            });
          } catch (adoptErr) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Could not mirror legacy TradeForge data to TradeFourge immediately:', adoptErr);
            }
          }
          return { merged: false, pulled: true, adoptedLegacy: true };
        }
        return { merged: false, pulled: true };
      }

      // Remote exists only as an empty shell while local browser has unsaved data -> heal Drive safely
      if (!hasDirty && !shouldPullRemote && !remoteHasData && localHasData && contentDiffers) {
        await this._pushSnapshotToDrive(account, localSnap, {
          forceAllDomains: true,
          force: true,
          folderIds: remoteDb.folderIds,
          fileIds: remoteDb.fileIds
        });
        return { merged: false, pushed: true };
      }

      // No remote drift & no local edits -> already in sync
      if (!hasDirty) {
        return { merged: false, clean: true };
      }

      // Local dirty & remote has NOT drifted -> straight push of dirty domains
      if (hasDirty && !shouldPullRemote && !forceAdoptLegacy) {
        await this._pushSnapshotToDrive(account, localSnap, {
          folderIds: remoteDb.folderIds,
          fileIds: remoteDb.fileIds,
          _conflictRetried: options._conflictRetried
        });
        return { merged: false, pushed: true };
      }

      // BOTH local and remote changed concurrently -> 3-way merge + conflict detection
      const tradeMerge = CloudSyncUtils.mergeTradeCollections({
        baseTrades: baseSnap.trades || [],
        remoteTrades: remoteSnap.trades || [],
        localTrades: localSnap.trades || [],
        remoteDeleted: remoteSnap.deletedUids || [],
        localDeleted: localSnap.deletedUids || []
      });

      const hasBaseSnap = Boolean(baseSnap && Object.keys(baseSnap).length > 0);
      const mergeBaseSettings = hasBaseSnap
        ? baseSnap
        : (forceAdoptLegacy
            ? {
                currency: 'USD',
                startingCapital: null,
                notes: '',
                rules: _defaultRules(),
                theme: undefined
              }
            : baseSnap);
      const mergeBaseAccounts = hasBaseSnap
        ? baseSnap
        : (forceAdoptLegacy ? { mt5Session: null } : baseSnap);

      const settingsMerge = CloudSyncUtils.mergeSettings({
        baseSettings: mergeBaseSettings,
        remoteSettings: { ...remoteSnap, updatedAt: remoteDb.journal?.updatedAt || remoteDb.settings?.updatedAt },
        localSettings: { ...localSnap, updatedAt: new Date().toISOString() }
      });

      const acctMerge = CloudSyncUtils.mergeAccounts({
        baseAccounts: mergeBaseAccounts,
        remoteAccounts: { mt5Session: remoteSnap.mt5Session, updatedAt: remoteDb.settings?.updatedAt || remoteDb.accounts?.updatedAt },
        localAccounts: { mt5Session: localSnap.mt5Session, updatedAt: new Date().toISOString() }
      });

      const allConflicts = [
        ...tradeMerge.conflicts,
        ...settingsMerge.conflicts,
        ...acctMerge.conflicts
      ];
      this.lastConflicts = allConflicts;

      const mergedSnapshot = {
        trades: tradeMerge.trades,
        lastImport: localSnap.lastImport || remoteSnap.lastImport,
        deletedUids: tradeMerge.deletedUids,
        notes: settingsMerge.settings.notes,
        rules: settingsMerge.settings.rules,
        currency: settingsMerge.settings.currency,
        startingCapital: settingsMerge.settings.startingCapital,
        mt5Session: acctMerge.accounts.mt5Session,
        theme: settingsMerge.settings.theme
      };

      StorageManager.applySnapshot(mergedSnapshot, { silentSync: true });
      const hasLocalTheme = typeof ThemeManager !== 'undefined' &&
        typeof ThemeManager.hasStoredThemePreference === 'function' &&
        ThemeManager.hasStoredThemePreference();
      if (!hasLocalTheme && mergedSnapshot.theme && typeof ThemeManager !== 'undefined' && ThemeManager.isValidTheme && ThemeManager.isValidTheme(mergedSnapshot.theme)) {
        ThemeManager.applyTheme(mergedSnapshot.theme, { persist: true, silent: false });
      }
      this._emit('workspace_reloaded', { reason: 'conflict_merged', conflicts: allConflicts });

      this._writeMeta(sub, {
        revisions: remoteRev,
        fileIds: remoteDb.fileIds,
        dirtyDomains: { trades: true, journal: true, settings: true }
      });

      await this._pushSnapshotToDrive(account, mergedSnapshot, {
        forceAllDomains: true,
        force: true,
        createSafetyBackup: allConflicts.length > 0,
        backupReason: 'conflict-backup',
        folderIds: remoteDb.folderIds,
        fileIds: remoteDb.fileIds,
        _conflictRetried: true
      });

      if (allConflicts.length > 0) {
        this._emit('conflict_resolved', { conflicts: allConflicts });
      }

      return { merged: true, conflicts: allConflicts };
    },

    async syncNow(options = {}) {
      if (this._signedInFlowPromise) {
        await this._signedInFlowPromise.catch(() => {});
      }
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account) {
        return { skipped: true, reason: 'signed_out' };
      }
      if (this.status === 'migration_pending') {
        return { skipped: true, reason: 'migration_pending' };
      }

      if (this._syncPromise) {
        this._resyncRequested = true;
        return this._syncPromise;
      }

      const account = GoogleAuthManager.account;
      const sub = account.sub;

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.status = 'offline';
        this._emit('status');
        return { skipped: true, reason: 'offline' };
      }

      if (!GoogleAuthManager.hasValidToken()) {
        this.status = 'auth_expired';
        this.lastError = { code: 'AUTH_EXPIRED', message: 'Google authorization expired. Please reconnect.' };
        this._emit('auth_expired');
        return { skipped: true, reason: 'auth_expired' };
      }

      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }

      this._syncPromise = (async () => {
        this.status = 'syncing';
        this.lastError = null;
        this._emit('status');

        try {
          const meta = this._readMeta(sub);
          const metaCheck = await GoogleDriveStorage.readMetadataOnly({ folderIds: meta.folderIds });
          const folderIds = metaCheck.folderIds || meta.folderIds;
          const remoteMeta = metaCheck.metadata;

          if (folderIds) {
            this.folderIds = folderIds;
            this._writeMeta(sub, { folderIds });
          }
          if (metaCheck.fileId && metaCheck.fileId !== meta.fileIds.metadata) {
            this._writeMeta(sub, { fileIds: { metadata: metaCheck.fileId } });
          }

          const hasDirty = meta.dirtyDomains.trades || meta.dirtyDomains.journal || meta.dirtyDomains.settings;
          const remoteRevs = remoteMeta?.revisions || null;
          const remoteSums = remoteMeta?.checksums || {};
          const rTradesRev = Number(remoteRevs?.trades) || 0;
          const rJournalRev = Number(remoteRevs?.journal !== undefined ? remoteRevs.journal : remoteRevs?.settings) || 0;
          const rSettingsRev = Number(remoteRevs?.settings !== undefined ? remoteRevs.settings : remoteRevs?.accounts) || 0;

          const rJournalSum = remoteSums.journal || remoteSums.settings || '';
          const rSettingsSum = remoteSums.settings || remoteSums.accounts || '';

          const checksumDrifted = Boolean(
            (remoteSums.trades && meta.checksums.trades && remoteSums.trades !== meta.checksums.trades) ||
            (rJournalSum && meta.checksums.journal && rJournalSum !== meta.checksums.journal) ||
            (rSettingsSum && meta.checksums.settings && rSettingsSum !== meta.checksums.settings)
          );
          const remoteDrifted = Boolean(
            !remoteRevs ||
            rTradesRev > (meta.revisions.trades || 0) ||
            rJournalRev > (meta.revisions.journal || 0) ||
            rSettingsRev > (meta.revisions.settings || 0) ||
            checksumDrifted
          );

          const localTradeCount = typeof StorageManager !== 'undefined' && typeof StorageManager.getTrades === 'function'
            ? StorageManager.getTrades().length
            : 0;
          const remoteReportedTrades = Number(remoteMeta?.counts?.trades || 0);
          const countMismatch = Boolean(remoteReportedTrades > 0 && localTradeCount === 0);

          let reconcileRes = null;
          if (options.fullCheck || remoteDrifted || metaCheck.legacyAvailable || countMismatch) {
            const remoteDb = await GoogleDriveStorage.readDatabase({ ownerSub: sub, folderIds });
            reconcileRes = await this._reconcileAccountWithRemote(account, remoteDb, options);
          } else if (hasDirty) {
            const localSnap = this._exportActiveWithTheme();
            await this._pushSnapshotToDrive(account, localSnap, { folderIds });
          }

          this._retryAttempt = 0;
          this.status = 'synced';
          this._emit('synced', { reason: options.reason || 'sync', result: reconcileRes });
          return { ok: true, lastSyncedAt: this.lastSyncedAt, result: reconcileRes };
        } catch (err) {
          this._handleSyncError(sub, err);
          throw err;
        } finally {
          this._syncPromise = null;
          if (this._resyncRequested) {
            this._resyncRequested = false;
            this._scheduleAutoSync();
          }
        }
      })();

      return this._syncPromise;
    },

    _handleSyncError(sub, err) {
      const code = err && err.code ? err.code : 'SYNC_ERROR';
      const message = (err && err.message) || 'Failed to sync with Google Drive.';
      this.lastError = { code, message };

      if (code === 'AUTH_EXPIRED' || code === 'UNAUTHENTICATED' || code === 'DRIVE_SCOPE_DENIED') {
        this._clearTimers();
        this.status = 'auth_expired';
        this._emit('auth_expired', { error: this.lastError });
        return;
      }

      if (code === 'OFFLINE') {
        this._clearTimers();
        this.status = 'offline';
        this._emit('status', { error: this.lastError });
        return;
      }

      this.status = 'sync_failed';
      this._emit('sync_error', { error: this.lastError });

      if (code === 'NETWORK_ERROR' || code === 'RATE_LIMITED' || code === 'SERVER_ERROR') {
        this._scheduleRetry(sub);
      }
    },

    async createManualBackup(reason = 'manual') {
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account) {
        throw new Error('Sign in with Google first to save backups to Google Drive.');
      }
      if (!GoogleAuthManager.hasValidToken()) {
        throw new Error('Google session expired. Please reconnect first.');
      }

      const account = GoogleAuthManager.account;
      const meta = this._readMeta(account.sub);
      const snap = this._exportActiveWithTheme();
      const created = await GoogleDriveStorage.createBackupSnapshot({
        reason,
        snapshot: snap,
        cachedFolderIds: meta.folderIds || {}
      });
      this._emit('backup_created', { file: created });
      return created;
    },

    async listCloudBackups(limit = 10) {
      if (this._signedInFlowPromise) {
        await this._signedInFlowPromise.catch(() => {});
      }
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account || !GoogleAuthManager.hasValidToken()) {
        return [];
      }
      return GoogleDriveStorage.listBackups(null, limit);
    },

    async deleteCloudBackup(fileId) {
      if (!fileId) throw new Error('Backup file ID is required.');
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account) {
        throw new Error('Sign in with Google first to manage cloud backups.');
      }
      if (!GoogleAuthManager.hasValidToken()) {
        const err = new Error('Google session expired. Please reconnect first.');
        err.code = 'AUTH_EXPIRED';
        this.status = 'auth_expired';
        this.lastError = { code: 'AUTH_EXPIRED', message: err.message };
        this._emit('auth_expired', { error: this.lastError });
        throw err;
      }

      const account = GoogleAuthManager.account;
      const sub = account.sub;
      const meta = this._readMeta(sub);
      try {
        const res = await GoogleDriveStorage.deleteBackupById(fileId, {
          cachedFolderIds: meta.folderIds || {}
        });
        this._emit('backup_deleted', {
          fileId: (res && res.deletedFileId) || fileId,
          fileName: (res && res.deletedFileName) || ''
        });
        return res;
      } catch (err) {
        const code = err && err.code ? err.code : '';
        if (code === 'AUTH_EXPIRED' || code === 'UNAUTHENTICATED' || code === 'DRIVE_SCOPE_DENIED' || code === 'OFFLINE') {
          this._handleSyncError(sub, err);
        }
        throw err;
      }
    },

    async restoreFromCloud({ createSafetyBackupFirst = true } = {}) {
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account) {
        throw new Error('Sign in with Google first to restore from Google Drive.');
      }
      if (!GoogleAuthManager.hasValidToken()) {
        throw new Error('Google session expired. Please reconnect first.');
      }

      const account = GoogleAuthManager.account;
      const sub = account.sub;
      this.status = 'syncing';
      this._emit('status');

      try {
        const meta = this._readMeta(sub);
        const remoteDb = await GoogleDriveStorage.readDatabase({ ownerSub: sub, folderIds: meta.folderIds });

        if (!remoteDb.exists) {
          throw new Error('No cloud data exists yet in My Drive / TradeFourge / User Data.');
        }

        if (createSafetyBackupFirst) {
          const currentSnap = this._exportActiveWithTheme();
          if (_snapshotHasData(currentSnap)) {
            await GoogleDriveStorage.createBackupSnapshot({
              reason: 'pre-restore',
              snapshot: currentSnap,
              cachedFolderIds: remoteDb.folderIds || meta.folderIds || {}
            });
          }
        }

        await this._applyRemoteDbToAccount(sub, remoteDb);
        this.status = 'synced';
        this._emit('workspace_reloaded', { reason: 'restore_cloud' });
        this._emit('synced', { reason: 'restore_cloud' });
        return { restoredTrades: remoteDb.trades?.trades?.length || 0 };
      } catch (err) {
        this._handleSyncError(sub, err);
        throw err;
      }
    },

    async restoreFromBackupFileId(fileId) {
      if (!fileId) throw new Error('Backup file ID is required.');
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account || !GoogleAuthManager.hasValidToken()) {
        throw new Error('Valid Google Drive session required to restore a backup.');
      }

      const account = GoogleAuthManager.account;
      const sub = account.sub;
      this.status = 'syncing';
      this._emit('status');

      try {
        const meta = this._readMeta(sub);
        const currentSnap = this._exportActiveWithTheme();
        const res = await GoogleDriveStorage.restoreBackupById(fileId, {
          createSafetyBackupFirst: true,
          currentSnapshot: currentSnap,
          cachedFolderIds: meta.folderIds || {}
        });

        const restoredSnap = res.restoredSnapshot;
        StorageManager.applySnapshot(restoredSnap, { silentSync: true });
        const hasLocalTheme = typeof ThemeManager !== 'undefined' &&
          typeof ThemeManager.hasStoredThemePreference === 'function' &&
          ThemeManager.hasStoredThemePreference();
        if (!hasLocalTheme && restoredSnap.theme && typeof ThemeManager !== 'undefined' && ThemeManager.isValidTheme && ThemeManager.isValidTheme(restoredSnap.theme)) {
          ThemeManager.applyTheme(restoredSnap.theme, { persist: true, silent: false });
        }

        const nowIso = new Date().toISOString();
        this.folderIds = res.folderIds || meta.folderIds;
        this.lastSyncedAt = nowIso;
        this._writeBaseSnapshot(sub, restoredSnap);
        this._writeMeta(sub, {
          folderIds: res.folderIds || meta.folderIds,
          fileIds: res.fileIds || meta.fileIds,
          revisions: (res.metadata && res.metadata.revisions) || meta.revisions,
          checksums: (res.metadata && res.metadata.checksums) || meta.checksums,
          dirtyDomains: { trades: false, journal: false, settings: false },
          lastSyncedAt: nowIso
        });

        this.status = 'synced';
        this._emit('workspace_reloaded', { reason: 'restore_backup' });
        this._emit('synced', { reason: 'restore_backup' });
        return { restoredTrades: restoredSnap.trades.length };
      } catch (err) {
        this._handleSyncError(sub, err);
        throw err;
      }
    },

    async saveCloudExport(fileNameOrOpts, content, mimeType = 'application/json') {
      if (typeof GoogleAuthManager === 'undefined' || !GoogleAuthManager.account || !GoogleAuthManager.hasValidToken()) {
        return { skipped: true, reason: 'not_connected' };
      }
      const opts = fileNameOrOpts && typeof fileNameOrOpts === 'object'
        ? fileNameOrOpts
        : { fileName: fileNameOrOpts, content, mimeType };
      const meta = this._readMeta(GoogleAuthManager.account.sub);
      return GoogleDriveStorage.saveExport({
        fileName: opts.fileName,
        content: opts.content,
        mimeType: opts.mimeType || 'application/json',
        cachedFolderIds: meta.folderIds || {}
      });
    }
  };

  global.CloudSyncUtils = CloudSyncUtils;
  global.CloudSyncManager = CloudSyncManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CloudSyncUtils, CloudSyncManager };
  }
})(typeof window !== 'undefined' ? window : globalThis);
