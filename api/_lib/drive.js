/**
 * TradeFourge Backend - Google Drive REST API v3 Server Storage Client
 *
 * Manages each authenticated user's isolated folder structure inside their own My Drive
 * using minimum `drive.file` scope (never accesses unrelated user files):
 *
 *   My Drive / TradeFourge /
 *   ├── User Data/
 *   │   ├── metadata.json
 *   │   ├── trades.json
 *   │   ├── journal.json
 *   │   └── settings.json
 *   ├── Backups/
 *   └── Exports/
 *
 * Also bridges any existing legacy `TradeForge /` (pre-rename) and `Database/` folders transparently
 * so zero prior user data or backups are ever lost or overwritten.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';

const FOLDER_NAMES = {
  ROOT: 'TradeFourge',
  LEGACY_ROOTS: ['TradeForge'],
  USER_DATA: 'User Data',
  BACKUPS: 'Backups',
  EXPORTS: 'Exports',
  LEGACY_DATABASE: 'Database'
};

const DATA_FILENAMES = {
  metadata: 'metadata.json',
  trades: 'trades.json',
  journal: 'journal.json',
  settings: 'settings.json'
};

const DEFAULT_RULES_CANONICAL = JSON.stringify([
  { id: 1, text: 'Never risk more than 1-2% per trade', checked: true },
  { id: 2, text: 'Wait for higher timeframe trend confirmation', checked: true },
  { id: 3, text: 'Always set a stop loss before entering position', checked: true },
  { id: 4, text: 'Do not revenge trade after a losing streak', checked: false },
  { id: 5, text: 'Accept take-profit targets without greed', checked: true }
]);

function _getRoleProp(item) {
  const props = item && item.appProperties;
  if (!props) return '';
  return props.tradefourgeRole || props.tradeforgeRole || '';
}

function _getDomainProp(item) {
  const props = item && item.appProperties;
  if (!props) return '';
  return props.tradefourgeDomain || props.tradeforgeDomain || '';
}

function _normName(name) {
  return String(name || '').trim().toLowerCase();
}

function _compareCreatedAsc(a, b) {
  const ta = String((a && a.createdTime) || '');
  const tb = String((b && b.createdTime) || '');
  if (ta !== tb) return ta.localeCompare(tb);
  return String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
}

function _isPrimaryRootFolder(item) {
  if (!item || item.mimeType !== FOLDER_MIME || item.trashed) return false;
  const n = _normName(item.name);
  if (n === 'tradefourge') return true;
  const role = _getRoleProp(item);
  return role === 'root' && n !== 'tradeforge';
}

function _isLegacyRootFolder(item) {
  if (!item || item.mimeType !== FOLDER_MIME || item.trashed) return false;
  return _normName(item.name) === 'tradeforge';
}

function _isTopLevelFolder(folder, allFoldersById) {
  if (!folder || !Array.isArray(folder.parents) || folder.parents.length === 0) return true;
  if (folder.parents.includes('root')) return true;
  return folder.parents.every((p) => !allFoldersById.has(p));
}

function _matchesSubfolder(item, parentId, targetNormName, targetRole) {
  if (!item || item.mimeType !== FOLDER_MIME || item.trashed) return false;
  if (!Array.isArray(item.parents) || !item.parents.includes(parentId)) return false;
  const n = _normName(item.name);
  const role = _getRoleProp(item);
  return n === targetNormName || (targetRole && role === targetRole);
}

function _sortSubfoldersByPriority(folders, targetRole) {
  return [...folders].sort((a, b) => {
    const aTagged = _getRoleProp(a) === targetRole ? 0 : 1;
    const bTagged = _getRoleProp(b) === targetRole ? 0 : 1;
    if (aTagged !== bTagged) return aTagged - bTagged;
    return _compareCreatedAsc(a, b);
  });
}

// In-memory mutex per user `sub` to prevent concurrent duplicate folder creation within one worker
const _ensureMutexes = new Map();

function _escapeQueryValue(val) {
  return String(val || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function _makeDriveError(code, message, status = 500, raw = null) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.raw = raw;
  return err;
}

function _buildStableTradesMap(trades = []) {
  const map = new Map();
  if (!Array.isArray(trades)) return map;
  for (const t of trades) {
    if (!t || typeof t !== 'object') continue;
    const key = t.syncId || t.id || t.ticket || JSON.stringify(t);
    map.set(String(key), t);
  }
  return map;
}

async function driveRequest({
  url,
  method = 'GET',
  headers = {},
  body = undefined,
  getToken,
  refreshTokenFn = null,
  fetchFn = globalThis.fetch
}) {
  const exec = async (token) => {
    let response;
    try {
      response = await fetchFn(url, {
        method,
        headers: Object.assign({}, headers, { Authorization: `Bearer ${token}` }),
        body
      });
    } catch (netErr) {
      throw _makeDriveError('NETWORK_ERROR', 'Unable to reach Google Drive. Please check your connection and try again.', 502, netErr);
    }
    return response;
  };

  let token = await getToken(false);
  let res = await exec(token);

  if (res.status === 401 && typeof refreshTokenFn === 'function') {
    token = await refreshTokenFn();
    res = await exec(token);
  }

  if (res.status === 401) {
    throw _makeDriveError('AUTH_EXPIRED', 'Your Google Drive session expired. Please reconnect your Google account.', 401);
  }

  if (!res.ok) {
    let payload = null;
    let msg = `Google Drive request failed (HTTP ${res.status}).`;
    let code = 'DRIVE_ERROR';
    try {
      const txt = await res.text();
      payload = txt ? JSON.parse(txt) : null;
      if (payload && payload.error && payload.error.message) {
        msg = payload.error.message;
      }
    } catch (e) {}

    const reason = (payload && payload.error && payload.error.errors && payload.error.errors[0] && payload.error.errors[0].reason) || '';
    if (res.status === 404) {
      code = 'NOT_FOUND';
    } else if (res.status === 429 || reason.toLowerCase().includes('ratelimit')) {
      code = 'RATE_LIMITED';
    } else if (res.status === 403) {
      if (reason === 'storageQuotaExceeded') {
        code = 'QUOTA_EXCEEDED';
        msg = 'Your Google Drive storage quota is full.';
      } else if (reason.toLowerCase().includes('ratelimit') || reason.toLowerCase().includes('dailylimit')) {
        code = 'RATE_LIMITED';
      } else {
        code = 'DRIVE_SCOPE_DENIED';
        msg = 'Google Drive permission is required. Please reconnect and allow Drive access.';
      }
    } else if (res.status >= 500) {
      code = 'SERVER_ERROR';
    }
    throw _makeDriveError(code, msg, res.status, payload);
  }

  return res;
}

async function driveRequestJson(ctx, url, options = {}) {
  const res = await driveRequest({ ...ctx, url, ...options });
  const txt = await res.text();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw _makeDriveError('INVALID_JSON', 'Received invalid JSON response from Google Drive.', res.status);
  }
}

async function listFiles(ctx, {
  q,
  fields = 'files(id,name,mimeType,createdTime,modifiedTime,size,appProperties,trashed,parents)',
  orderBy = 'createdTime asc',
  pageSize = 100,
  paginate = false
}) {
  const all = [];
  let pageToken = null;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      q,
      spaces: 'drive',
      orderBy,
      pageSize: String(pageSize),
      fields: paginate ? `nextPageToken,${fields}` : fields,
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const data = await driveRequestJson(ctx, `${ctx.endpoints.driveApiUrl}?${params.toString()}`, { method: 'GET' });
    const batch = Array.isArray(data && data.files) ? data.files : [];
    all.push(...batch);
    pageToken = paginate && data && data.nextPageToken ? data.nextPageToken : null;
    pageCount++;
  } while (pageToken && pageCount < 25);

  return all;
}

async function verifyItemExists(ctx, fileId) {
  if (!fileId) return null;
  try {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,trashed,parents,modifiedTime,createdTime,appProperties',
      supportsAllDrives: 'true'
    });
    const meta = await driveRequestJson(ctx, `${ctx.endpoints.driveApiUrl}/${encodeURIComponent(fileId)}?${params.toString()}`, {
      method: 'GET'
    });
    if (!meta || meta.trashed) return null;
    return meta;
  } catch (err) {
    if (err.code === 'NOT_FOUND') return null;
    throw err;
  }
}

async function _listAllFolders(ctx, cachedFolderIds = {}) {
  const q = `mimeType = '${FOLDER_MIME}' and trashed = false`;
  const listed = await listFiles(ctx, { q, pageSize: 200, paginate: true });
  const byId = new Map();
  for (const f of listed) {
    if (f && f.id && !f.trashed && f.mimeType === FOLDER_MIME) {
      byId.set(f.id, f);
    }
  }

  const cacheCandidates = [
    cachedFolderIds && cachedFolderIds.root,
    cachedFolderIds && cachedFolderIds.userData,
    cachedFolderIds && cachedFolderIds.backups,
    cachedFolderIds && cachedFolderIds.exports
  ].filter(Boolean);

  for (const cid of cacheCandidates) {
    if (!byId.has(cid)) {
      const verified = await verifyItemExists(ctx, cid);
      if (verified && verified.id && !verified.trashed && verified.mimeType === FOLDER_MIME) {
        byId.set(verified.id, verified);
      }
    }
  }

  return Array.from(byId.values());
}

async function _deleteFolderIfEmpty(ctx, folderId) {
  if (!folderId) return false;
  try {
    const escapedParent = _escapeQueryValue(folderId);
    const children = await listFiles(ctx, {
      q: `'${escapedParent}' in parents and trashed = false`,
      pageSize: 1,
      fields: 'files(id)'
    });
    if (children.length > 0) return false;
    await driveRequest({
      ...ctx,
      url: `${ctx.endpoints.driveApiUrl}/${encodeURIComponent(folderId)}?supportsAllDrives=true`,
      method: 'DELETE'
    });
    return true;
  } catch (e) {
    return false;
  }
}

function _emptyDataEvaluation(folderId = null) {
  return {
    folderId,
    filesMap: { metadata: null, trades: null, journal: null, settings: null, accounts: null },
    hasFiles: false,
    payload: { metadata: null, trades: null, journal: null, settings: null, accounts: null },
    hasMeaningfulData: false,
    tradeCount: 0,
    maxRevision: 0,
    metaTradeCount: 0,
    updatedAtMs: 0,
    fileCount: 0,
    totalBytes: 0,
    latestFileModifiedMs: 0,
    payloadRead: false
  };
}

async function _evaluateDataFolder(ctx, folderId, { inspectPayloads = false, payloadCache = null } = {}) {
  if (!folderId) return _emptyDataEvaluation(null);

  const cached = payloadCache && payloadCache.get(folderId);
  if (cached && (!inspectPayloads || cached.payloadRead)) {
    return cached;
  }

  const filesMap = cached ? cached.filesMap : await listUserDataFiles(ctx, folderId);
  const fileObjs = Object.values(filesMap).filter(Boolean);
  const hasFiles = fileObjs.length > 0;
  const totalBytes = fileObjs.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const latestFileModifiedMs = fileObjs.reduce(
    (mx, f) => Math.max(mx, Date.parse(f.modifiedTime || f.createdTime || '') || 0),
    0
  );

  let payload = cached ? cached.payload : { metadata: null, trades: null, journal: null, settings: null, accounts: null };
  let payloadRead = Boolean(cached && cached.payloadRead);

  if (hasFiles && inspectPayloads && !payloadRead) {
    payload = await _readFilesMapPayload(ctx, filesMap);
    payloadRead = true;
  }

  const hasMeaningfulData = payloadRead ? _hasMeaningfulRemoteData(payload) : false;
  const rawTrades = payloadRead
    ? (Array.isArray(payload.trades) ? payload.trades : (payload.trades && payload.trades.trades))
    : null;
  const tradeCount = Array.isArray(rawTrades) ? rawTrades.length : 0;
  const revs = (payload.metadata && payload.metadata.revisions) || {};
  const maxRevision = Math.max(
    Number(revs.trades) || 0,
    Number(revs.journal) || 0,
    Number(revs.settings) || 0,
    Number(revs.accounts) || 0
  );
  const metaTradeCount = Number(payload.metadata && payload.metadata.counts && payload.metadata.counts.trades) || 0;
  const updatedAtStr = (payload.metadata && (payload.metadata.lastSyncedAt || payload.metadata.updatedAt)) ||
    (payload.trades && payload.trades.updatedAt) ||
    (payload.journal && payload.journal.updatedAt) ||
    (payload.settings && payload.settings.updatedAt) ||
    '';
  const updatedAtMs = Math.max(Date.parse(updatedAtStr) || 0, latestFileModifiedMs);

  const entry = {
    folderId,
    filesMap,
    hasFiles,
    payload,
    hasMeaningfulData,
    tradeCount,
    maxRevision,
    metaTradeCount,
    updatedAtMs,
    fileCount: fileObjs.length,
    totalBytes,
    latestFileModifiedMs,
    payloadRead
  };

  if (payloadCache) {
    payloadCache.set(folderId, entry);
  }
  return entry;
}

function _compareDataEvaluations(a, b) {
  const ea = a || _emptyDataEvaluation();
  const eb = b || _emptyDataEvaluation();
  if (ea.hasMeaningfulData !== eb.hasMeaningfulData) return ea.hasMeaningfulData ? -1 : 1;
  if (ea.tradeCount !== eb.tradeCount) return eb.tradeCount - ea.tradeCount;
  if (ea.hasFiles !== eb.hasFiles) return ea.hasFiles ? -1 : 1;
  if (ea.maxRevision !== eb.maxRevision) return eb.maxRevision - ea.maxRevision;
  if (ea.metaTradeCount !== eb.metaTradeCount) return eb.metaTradeCount - ea.metaTradeCount;
  if (ea.fileCount !== eb.fileCount) return eb.fileCount - ea.fileCount;
  if (ea.totalBytes !== eb.totalBytes) return eb.totalBytes - ea.totalBytes;
  if (ea.updatedAtMs !== eb.updatedAtMs) return eb.updatedAtMs - ea.updatedAtMs;
  return 0;
}

function _collectRootSubfolders(rootFolder, allFolders) {
  const rootId = rootFolder.id;
  return {
    userDataFolders: _sortSubfoldersByPriority(
      allFolders.filter((f) => _matchesSubfolder(f, rootId, 'user data', 'user_data')),
      'user_data'
    ),
    databaseFolders: _sortSubfoldersByPriority(
      allFolders.filter((f) => _matchesSubfolder(f, rootId, 'database', 'database')),
      'database'
    ),
    backupsFolders: _sortSubfoldersByPriority(
      allFolders.filter((f) => _matchesSubfolder(f, rootId, 'backups', 'backups')),
      'backups'
    ),
    exportsFolders: _sortSubfoldersByPriority(
      allFolders.filter((f) => _matchesSubfolder(f, rootId, 'exports', 'exports')),
      'exports'
    )
  };
}

function _compareRootCandidates(a, b) {
  const pCmp = _compareDataEvaluations(a.primaryEval, b.primaryEval);
  if (pCmp !== 0) return pCmp;
  const eCmp = _compareDataEvaluations(a.effectiveEval, b.effectiveEval);
  if (eCmp !== 0) return eCmp;
  if (a.subfolderScore !== b.subfolderScore) return b.subfolderScore - a.subfolderScore;
  if (a.isTopLevel !== b.isTopLevel) return a.isTopLevel ? -1 : 1;
  if (a.hasRootRole !== b.hasRootRole) return a.hasRootRole ? -1 : 1;
  return _compareCreatedAsc(a.folder, b.folder);
}

async function discoverDriveWorkspace(ctx, { inspectPayloads = false, cachedFolderIds = {} } = {}) {
  const allFolders = await _listAllFolders(ctx, cachedFolderIds);
  const allFoldersById = new Map(allFolders.map((f) => [f.id, f]));
  const primaryRoots = allFolders.filter(_isPrimaryRootFolder);
  const legacyRoots = allFolders.filter(_isLegacyRootFolder);
  const payloadCache = new Map();

  if (primaryRoots.length === 0 && legacyRoots.length === 0) {
    return {
      exists: false,
      rootName: null,
      isLegacyCanonical: false,
      canonicalRoot: null,
      canonicalSubfolders: null,
      folderIds: null,
      legacyFolderDetected: false,
      legacyRootId: null,
      primaryEval: null,
      fallbackCandidates: [],
      allBackupFolderIds: [],
      payloadCache,
      duplicateRootCount: 0
    };
  }

  const activeTierRoots = primaryRoots.length > 0 ? primaryRoots : legacyRoots;
  const isLegacyCanonical = primaryRoots.length === 0;
  const hasMultipleActiveRoots = activeTierRoots.length > 1;
  const hasMultipleUserDataSubs = activeTierRoots.some(
    (r) => allFolders.filter((f) => _matchesSubfolder(f, r.id, 'user data', 'user_data')).length > 1
  );
  const needDisambiguation = hasMultipleActiveRoots || hasMultipleUserDataSubs;
  const checkFiles = Boolean(inspectPayloads || needDisambiguation);

  const rootCandidates = await Promise.all(
    activeTierRoots.map(async (rootFolder) => {
      const subs = _collectRootSubfolders(rootFolder, allFolders);
      let bestUserData = subs.userDataFolders[0] || null;
      let primaryEval = _emptyDataEvaluation(bestUserData ? bestUserData.id : null);

      if (subs.userDataFolders.length > 0 && checkFiles) {
        const userDataEvals = await Promise.all(
          subs.userDataFolders.map(async (udFolder) => ({
            folder: udFolder,
            eval: await _evaluateDataFolder(ctx, udFolder.id, { inspectPayloads, payloadCache })
          }))
        );
        // When disambiguating duplicates on light calls, read payloads for any non-empty User Data folder
        // so populated data always beats an empty initialized placeholder.
        if (needDisambiguation && !inspectPayloads && userDataEvals.some((u) => u.eval.hasFiles)) {
          await Promise.all(
            userDataEvals.map(async (u) => {
              if (u.eval.hasFiles && !u.eval.payloadRead) {
                u.eval = await _evaluateDataFolder(ctx, u.folder.id, { inspectPayloads: true, payloadCache });
              }
            })
          );
        }
        userDataEvals.sort((x, y) => {
          const cmp = _compareDataEvaluations(x.eval, y.eval);
          if (cmp !== 0) return cmp;
          const xTag = _getRoleProp(x.folder) === 'user_data' ? 0 : 1;
          const yTag = _getRoleProp(y.folder) === 'user_data' ? 0 : 1;
          if (xTag !== yTag) return xTag - yTag;
          return _compareCreatedAsc(x.folder, y.folder);
        });
        bestUserData = userDataEvals[0].folder;
        primaryEval = userDataEvals[0].eval;
      }

      let effectiveEval = primaryEval;
      if (!effectiveEval.hasMeaningfulData && checkFiles) {
        const extraEvals = [];
        for (const dbF of subs.databaseFolders) {
          let dbEv = await _evaluateDataFolder(ctx, dbF.id, { inspectPayloads, payloadCache });
          if (needDisambiguation && dbEv.hasFiles && !dbEv.payloadRead) {
            dbEv = await _evaluateDataFolder(ctx, dbF.id, { inspectPayloads: true, payloadCache });
          }
          extraEvals.push(dbEv);
        }
        if (extraEvals.every((e) => !e.hasFiles)) {
          let rootDirectEv = await _evaluateDataFolder(ctx, rootFolder.id, { inspectPayloads, payloadCache });
          if (needDisambiguation && rootDirectEv.hasFiles && !rootDirectEv.payloadRead) {
            rootDirectEv = await _evaluateDataFolder(ctx, rootFolder.id, { inspectPayloads: true, payloadCache });
          }
          extraEvals.push(rootDirectEv);
        }
        extraEvals.sort(_compareDataEvaluations);
        if (extraEvals[0] && _compareDataEvaluations(extraEvals[0], effectiveEval) < 0) {
          effectiveEval = extraEvals[0];
        }
      }

      return {
        folder: rootFolder,
        subs,
        bestUserData,
        bestBackups: subs.backupsFolders[0] || null,
        bestExports: subs.exportsFolders[0] || null,
        primaryEval,
        effectiveEval,
        subfolderScore:
          (subs.userDataFolders.length > 0 ? 1 : 0) +
          (subs.backupsFolders.length > 0 ? 1 : 0) +
          (subs.exportsFolders.length > 0 ? 1 : 0),
        isTopLevel: _isTopLevelFolder(rootFolder, allFoldersById),
        hasRootRole: _getRoleProp(rootFolder) === 'root'
      };
    })
  );

  rootCandidates.sort(_compareRootCandidates);
  const winner = rootCandidates[0];
  const canonicalRoot = winner.folder;
  const folderIds = {
    root: canonicalRoot.id,
    userData: winner.bestUserData ? winner.bestUserData.id : null,
    database: winner.bestUserData ? winner.bestUserData.id : null,
    backups: winner.bestBackups ? winner.bestBackups.id : null,
    exports: winner.bestExports ? winner.bestExports.id : null
  };

  // Fallback data candidates in priority order (never duplicating canonical User Data):
  // 1. Canonical root's Database/ subfolder(s) & direct root files
  // 2. Other duplicate roots in the same active tier
  // 3. Legacy TradeForge roots (when canonical is TradeFourge)
  const fallbackCandidates = [];
  const seenDataIds = new Set(folderIds.userData ? [folderIds.userData] : []);
  const pushFallback = (rootName, fId) => {
    if (fId && !seenDataIds.has(fId)) {
      seenDataIds.add(fId);
      fallbackCandidates.push({ rootName, folderId: fId });
    }
  };

  for (const dbF of winner.subs.databaseFolders) {
    pushFallback(canonicalRoot.name || FOLDER_NAMES.ROOT, dbF.id);
  }
  pushFallback(canonicalRoot.name || FOLDER_NAMES.ROOT, canonicalRoot.id);

  for (let i = 1; i < rootCandidates.length; i++) {
    const alt = rootCandidates[i];
    const rName = alt.folder.name || FOLDER_NAMES.ROOT;
    for (const udF of alt.subs.userDataFolders) pushFallback(rName, udF.id);
    for (const dbF of alt.subs.databaseFolders) pushFallback(rName, dbF.id);
    pushFallback(rName, alt.folder.id);
  }

  if (primaryRoots.length > 0 && legacyRoots.length > 0) {
    const sortedLegacy = [...legacyRoots].sort(_compareCreatedAsc);
    for (const lr of sortedLegacy) {
      const lSubs = _collectRootSubfolders(lr, allFolders);
      const rName = lr.name || FOLDER_NAMES.LEGACY_ROOTS[0];
      for (const udF of lSubs.userDataFolders) pushFallback(rName, udF.id);
      for (const dbF of lSubs.databaseFolders) pushFallback(rName, dbF.id);
      pushFallback(rName, lr.id);
    }
  }

  // Collect all Backups/ folder IDs across canonical, duplicate, and legacy roots
  const backupIds = [];
  const seenBkIds = new Set();
  const pushBk = (id) => {
    if (id && !seenBkIds.has(id)) {
      seenBkIds.add(id);
      backupIds.push(id);
    }
  };
  for (const bkF of winner.subs.backupsFolders) pushBk(bkF.id);
  for (let i = 1; i < rootCandidates.length; i++) {
    for (const bkF of rootCandidates[i].subs.backupsFolders) pushBk(bkF.id);
  }
  if (primaryRoots.length > 0 && legacyRoots.length > 0) {
    for (const lr of legacyRoots) {
      const lSubs = _collectRootSubfolders(lr, allFolders);
      for (const bkF of lSubs.backupsFolders) pushBk(bkF.id);
    }
  }

  const sortedLegacyRoots = [...legacyRoots].sort(_compareCreatedAsc);
  return {
    exists: true,
    rootName: canonicalRoot.name || FOLDER_NAMES.ROOT,
    isLegacyCanonical,
    canonicalRoot,
    canonicalSubfolders: {
      userData: winner.bestUserData,
      backups: winner.bestBackups,
      exports: winner.bestExports,
      database: winner.subs.databaseFolders[0] || null
    },
    folderIds,
    legacyFolderDetected: sortedLegacyRoots.length > 0,
    legacyRootId: sortedLegacyRoots[0] ? sortedLegacyRoots[0].id : null,
    primaryEval: winner.primaryEval,
    fallbackCandidates,
    allBackupFolderIds: backupIds,
    payloadCache,
    duplicateRootCount: Math.max(0, activeTierRoots.length - 1)
  };
}

async function _createRootFolderWithRaceCheck(ctx) {
  const metadata = {
    name: FOLDER_NAMES.ROOT,
    mimeType: FOLDER_MIME,
    parents: ['root'],
    appProperties: {
      tradefourgeApp: 'true',
      tradefourgeRole: 'root'
    }
  };

  const created = await driveRequestJson(
    ctx,
    `${ctx.endpoints.driveApiUrl}?fields=id,name,mimeType,createdTime,modifiedTime,appProperties,parents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata)
    }
  );

  // Post-create cross-worker race check: adopt earliest canonical root & delete empty duplicate
  const allFolders = await _listAllFolders(ctx, { root: created.id });
  const primary = allFolders.filter(_isPrimaryRootFolder);
  const legacy = allFolders.filter(_isLegacyRootFolder);
  const tier = primary.length > 0 ? primary : legacy;
  if (tier.length > 1) {
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    tier.sort((a, b) => {
      const aTop = _isTopLevelFolder(a, byId);
      const bTop = _isTopLevelFolder(b, byId);
      if (aTop !== bTop) return aTop ? -1 : 1;
      const aTag = _getRoleProp(a) === 'root';
      const bTag = _getRoleProp(b) === 'root';
      if (aTag !== bTag) return aTag ? -1 : 1;
      return _compareCreatedAsc(a, b);
    });
    const winner = tier[0];
    if (winner && winner.id && winner.id !== created.id) {
      await _deleteFolderIfEmpty(ctx, created.id);
      return { folder: winner, created: false, allFolders };
    }
  }

  return { folder: created, created: true, allFolders };
}

async function _createSubfolderWithRaceCheck(ctx, { name, parentId, role, initialFolders = null }) {
  if (Array.isArray(initialFolders)) {
    const existingList = _sortSubfoldersByPriority(
      initialFolders.filter((f) => _matchesSubfolder(f, parentId, _normName(name), role)),
      role
    );
    if (existingList.length > 0) {
      return { folder: existingList[0], created: false };
    }
  }

  const metadata = {
    name,
    mimeType: FOLDER_MIME,
    parents: [parentId],
    appProperties: {
      tradefourgeApp: 'true',
      tradefourgeRole: role
    }
  };

  const created = await driveRequestJson(
    ctx,
    `${ctx.endpoints.driveApiUrl}?fields=id,name,mimeType,createdTime,modifiedTime,appProperties,parents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata)
    }
  );

  // Post-create sibling deduplication across concurrent workers
  const escapedParent = _escapeQueryValue(parentId);
  const childFolders = await listFiles(ctx, {
    q: `'${escapedParent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    pageSize: 50
  });
  const matching = _sortSubfoldersByPriority(
    childFolders.filter((f) => _matchesSubfolder(f, parentId, _normName(name), role)),
    role
  );
  if (matching.length > 1 && matching[0].id !== created.id) {
    await _deleteFolderIfEmpty(ctx, created.id);
    return { folder: matching[0], created: false };
  }

  return { folder: created, created: true };
}

async function inspectFolderStructure(ctx, cachedFolderIds = {}) {
  const ws = await discoverDriveWorkspace(ctx, { inspectPayloads: false, cachedFolderIds });
  return {
    exists: ws.exists,
    rootName: ws.rootName,
    legacyFolderDetected: Boolean(ws.legacyFolderDetected),
    legacyRootId: ws.legacyRootId,
    folderIds: ws.folderIds,
    duplicateRootCount: ws.duplicateRootCount
  };
}

async function ensureFolderStructure(ctx, ownerSub = 'default', cachedFolderIds = {}) {
  const lockKey = String(ownerSub || 'default');
  if (_ensureMutexes.has(lockKey)) {
    return _ensureMutexes.get(lockKey);
  }

  const task = (async () => {
    // 1. Search Google Drive FIRST — reuse any existing TradeFourge or TradeForge folder
    const ws = await discoverDriveWorkspace(ctx, { inspectPayloads: false, cachedFolderIds });

    let rootFolder = ws.canonicalRoot;
    let rootCreated = false;
    let knownFolders = null;

    if (!rootFolder) {
      const rootRes = await _createRootFolderWithRaceCheck(ctx);
      rootFolder = rootRes.folder;
      rootCreated = rootRes.created;
      knownFolders = rootRes.allFolders;
    }

    const existingSubs = ws.canonicalSubfolders || {};
    const needUserData = !existingSubs.userData;
    const needBackups = !existingSubs.backups;
    const needExports = !existingSubs.exports;

    const [userDataRes, backupsRes, exportsRes] = await Promise.all([
      existingSubs.userData
        ? Promise.resolve({ folder: existingSubs.userData, created: false })
        : _createSubfolderWithRaceCheck(ctx, {
            name: FOLDER_NAMES.USER_DATA,
            parentId: rootFolder.id,
            role: 'user_data',
            initialFolders: knownFolders
          }),
      existingSubs.backups
        ? Promise.resolve({ folder: existingSubs.backups, created: false })
        : _createSubfolderWithRaceCheck(ctx, {
            name: FOLDER_NAMES.BACKUPS,
            parentId: rootFolder.id,
            role: 'backups',
            initialFolders: knownFolders
          }),
      existingSubs.exports
        ? Promise.resolve({ folder: existingSubs.exports, created: false })
        : _createSubfolderWithRaceCheck(ctx, {
            name: FOLDER_NAMES.EXPORTS,
            parentId: rootFolder.id,
            role: 'exports',
            initialFolders: knownFolders
          })
    ]);

    return {
      folderIds: {
        root: rootFolder.id,
        userData: userDataRes.folder.id,
        database: userDataRes.folder.id,
        backups: backupsRes.folder.id,
        exports: exportsRes.folder.id
      },
      rootName: rootFolder.name || FOLDER_NAMES.ROOT,
      created: Boolean(rootCreated || (needUserData && userDataRes.created) || (needBackups && backupsRes.created) || (needExports && exportsRes.created)),
      reused: !rootCreated
    };
  })();

  _ensureMutexes.set(lockKey, task);
  try {
    return await task;
  } finally {
    _ensureMutexes.delete(lockKey);
  }
}

async function listUserDataFiles(ctx, userDataFolderId) {
  const escapedParent = _escapeQueryValue(userDataFolderId);
  const q = `'${escapedParent}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`;
  const files = await listFiles(ctx, { q, pageSize: 50 });

  const map = {
    metadata: null,
    trades: null,
    journal: null,
    settings: null,
    accounts: null
  };

  const domainByFilename = {
    [DATA_FILENAMES.metadata]: 'metadata',
    [DATA_FILENAMES.trades]: 'trades',
    [DATA_FILENAMES.journal]: 'journal',
    [DATA_FILENAMES.settings]: 'settings',
    'accounts.json': 'accounts'
  };

  for (const file of files) {
    const domain = _getDomainProp(file) || domainByFilename[file.name];
    if (!domain || !Object.prototype.hasOwnProperty.call(map, domain)) continue;
    const existing = map[domain];
    if (!existing) {
      map[domain] = file;
    } else {
      const existingTime = String(existing.modifiedTime || existing.createdTime || '');
      const candidateTime = String(file.modifiedTime || file.createdTime || '');
      const existingSize = Number(existing.size || 0);
      const candidateSize = Number(file.size || 0);
      if (candidateTime > existingTime || (candidateTime === existingTime && candidateSize > existingSize)) {
        map[domain] = file;
      }
    }
  }

  return map;
}

async function readJsonFile(ctx, fileId) {
  if (!fileId) return null;
  const res = await driveRequest({
    ...ctx,
    url: `${ctx.endpoints.driveApiUrl}/${encodeURIComponent(fileId)}?alt=media`,
    method: 'GET'
  });
  const text = await res.text();
  if (!text || !text.trim()) {
    throw _makeDriveError('CORRUPT_REMOTE_FILE', `Drive file ${fileId} was empty.`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw _makeDriveError('CORRUPT_REMOTE_FILE', `Drive file ${fileId} contains malformed JSON.`, res.status);
  }
}

async function createFileInFolder(ctx, { name, parentId, content, mimeType = JSON_MIME, appProperties = {} }) {
  const boundary = 'tf_multipart_' + Math.random().toString(36).slice(2, 12);
  const metadata = {
    name,
    mimeType,
    parents: [parentId],
    appProperties: Object.assign({ tradefourgeApp: 'true' }, appProperties)
  };
  const bodyContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    `${bodyContent}\r\n` +
    `--${boundary}--`;

  return driveRequestJson(
    ctx,
    `${ctx.endpoints.driveUploadUrl}?uploadType=multipart&fields=id,name,modifiedTime,createdTime,size,appProperties`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody
    }
  );
}

async function updateJsonFile(ctx, { fileId, data }) {
  return driveRequestJson(
    ctx,
    `${ctx.endpoints.driveUploadUrl}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime,size,appProperties`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data, null, 2)
    }
  );
}

async function writeDomainFile(ctx, { domainName, userDataFolderId, fileId = null, data }) {
  const fileName = DATA_FILENAMES[domainName];
  if (!fileName) {
    throw _makeDriveError('INVALID_DOMAIN', `Unknown Drive data domain: ${domainName}`, 400);
  }

  if (fileId) {
    try {
      return await updateJsonFile(ctx, { fileId, data });
    } catch (err) {
      if (err.code !== 'NOT_FOUND') throw err;
    }
  }

  const filesMap = await listUserDataFiles(ctx, userDataFolderId);
  const existing = filesMap[domainName];
  if (existing && existing.id) {
    return updateJsonFile(ctx, { fileId: existing.id, data });
  }

  return createFileInFolder(ctx, {
    name: fileName,
    parentId: userDataFolderId,
    content: data,
    appProperties: { tradefourgeDomain: domainName }
  });
}

function _hasAnyFilesInMap(filesMap) {
  return Boolean(filesMap && (filesMap.metadata || filesMap.trades || filesMap.journal || filesMap.settings || filesMap.accounts));
}

function _hasMeaningfulRemoteData(dbObj = {}) {
  if (!dbObj || typeof dbObj !== 'object') return false;
  const rawTrades = Array.isArray(dbObj.trades)
    ? dbObj.trades
    : (dbObj.trades && dbObj.trades.trades);
  if (Array.isArray(rawTrades) && rawTrades.length > 0) return true;
  if (Array.isArray(dbObj.trades && dbObj.trades.deletedUids) && dbObj.trades.deletedUids.length > 0) return true;
  const journalNotes = dbObj.journal && typeof dbObj.journal.notes === 'string' ? dbObj.journal.notes.trim() : '';
  const settingsNotes = dbObj.settings && typeof dbObj.settings.notes === 'string' ? dbObj.settings.notes.trim() : '';
  if (journalNotes || settingsNotes) return true;
  if (dbObj.settings && Number(dbObj.settings.startingCapital) > 0) return true;
  if (dbObj.settings && dbObj.settings.currency === 'INR') return true;
  if (dbObj.settings && dbObj.settings.mt5Session && dbObj.settings.mt5Session.isConnected) return true;
  if (dbObj.accounts && dbObj.accounts.mt5Session && dbObj.accounts.mt5Session.isConnected) return true;
  const rules = (dbObj.journal && Array.isArray(dbObj.journal.rules) && dbObj.journal.rules) ||
    (dbObj.settings && Array.isArray(dbObj.settings.rules) && dbObj.settings.rules) ||
    null;
  if (rules && JSON.stringify(rules) !== DEFAULT_RULES_CANONICAL) return true;
  return false;
}

async function _readFilesMapPayload(ctx, filesMap) {
  const out = {
    metadata: null,
    trades: null,
    journal: null,
    settings: null,
    accounts: null
  };

  const reads = [];
  if (filesMap.metadata) {
    reads.push(readJsonFile(ctx, filesMap.metadata.id).then((d) => { out.metadata = d; }));
  }
  if (filesMap.trades) {
    reads.push(readJsonFile(ctx, filesMap.trades.id).then((d) => {
      out.trades = Array.isArray(d) ? { schemaVersion: '1.0.0', trades: d } : d;
    }));
  }
  if (filesMap.journal) {
    reads.push(readJsonFile(ctx, filesMap.journal.id).then((d) => { out.journal = d; }));
  }
  if (filesMap.settings) {
    reads.push(readJsonFile(ctx, filesMap.settings.id).then((d) => { out.settings = d; }));
  }
  if (filesMap.accounts) {
    reads.push(readJsonFile(ctx, filesMap.accounts.id).then((d) => { out.accounts = d; }));
  }

  await Promise.all(reads);

  // Merge legacy `settings.notes`/`rules` + `accounts.mt5Session` cleanly if read from legacy structure
  if (!out.journal && out.settings && (out.settings.notes !== undefined || out.settings.rules !== undefined)) {
    out.journal = {
      schemaVersion: out.settings.schemaVersion || '1.0.0',
      updatedAt: out.settings.updatedAt || null,
      notes: out.settings.notes || '',
      rules: Array.isArray(out.settings.rules) ? out.settings.rules : null
    };
  }
  if (out.accounts && out.accounts.mt5Session !== undefined && (!out.settings || out.settings.mt5Session === undefined)) {
    out.settings = Object.assign({}, out.settings || {}, { mt5Session: out.accounts.mt5Session });
  }

  return out;
}

async function hasLegacyDataHint(ctx, workspaceOrFolderIds = {}) {
  const ws = (workspaceOrFolderIds && Array.isArray(workspaceOrFolderIds.fallbackCandidates))
    ? workspaceOrFolderIds
    : await discoverDriveWorkspace(ctx, { inspectPayloads: false, cachedFolderIds: workspaceOrFolderIds });

  const candidates = ws.fallbackCandidates || [];
  for (const cand of candidates) {
    const evalEntry = await _evaluateDataFolder(ctx, cand.folderId, {
      inspectPayloads: false,
      payloadCache: ws.payloadCache
    });
    if (evalEntry.hasFiles) {
      return true;
    }
  }
  return false;
}

async function readDatabase(ctx, { cachedFolderIds = {} } = {}) {
  const ws = await discoverDriveWorkspace(ctx, { inspectPayloads: true, cachedFolderIds });
  if (!ws.canonicalRoot) {
    return {
      folderExists: false,
      folderIds: null,
      rootName: null,
      folderCreated: false,
      folderReused: false,
      legacyFolderDetected: false,
      legacySource: false,
      legacyRootName: null,
      fileIds: {
        metadata: null,
        trades: null,
        journal: null,
        settings: null
      },
      exists: false,
      metadata: null,
      trades: null,
      journal: null,
      settings: null,
      accounts: null
    };
  }

  const folderIds = ws.folderIds;
  const primaryEval = ws.primaryEval || _emptyDataEvaluation(folderIds.userData);
  const primaryFilesMap = primaryEval.filesMap;
  const hasPrimaryFiles = primaryEval.hasFiles;

  let selectedEval = primaryEval;
  let legacySource = false;
  let legacyRootName = null;

  // Bridge from `Database/`, direct root files, duplicate roots, or legacy `TradeForge/` folders
  // whenever canonical `User Data/` is absent OR contains only an empty initial placeholder.
  if (!primaryEval.hasMeaningfulData) {
    let firstNonEmptyFallback = null;

    for (const cand of ws.fallbackCandidates) {
      const candEval = await _evaluateDataFolder(ctx, cand.folderId, {
        inspectPayloads: true,
        payloadCache: ws.payloadCache
      });
      if (!candEval.hasFiles) continue;
      if (candEval.hasMeaningfulData) {
        selectedEval = candEval;
        legacySource = true;
        legacyRootName = cand.rootName;
        break;
      }
      if (!firstNonEmptyFallback && !hasPrimaryFiles) {
        firstNonEmptyFallback = { evalEntry: candEval, rootName: cand.rootName };
      }
    }

    if (!legacySource && firstNonEmptyFallback) {
      selectedEval = firstNonEmptyFallback.evalEntry;
      legacySource = true;
      legacyRootName = firstNonEmptyFallback.rootName;
    }
  }

  return {
    folderExists: true,
    folderIds,
    rootName: ws.rootName,
    folderCreated: false,
    folderReused: true,
    legacyFolderDetected: Boolean(ws.legacyFolderDetected),
    legacySource,
    legacyRootName,
    // Keep fileIds anchored strictly to canonical root's `User Data/` so subsequent writes
    // never overwrite files inside separate legacy `TradeForge/` or `Database/` folders.
    fileIds: {
      metadata: primaryFilesMap.metadata ? primaryFilesMap.metadata.id : null,
      trades: primaryFilesMap.trades ? primaryFilesMap.trades.id : null,
      journal: primaryFilesMap.journal ? primaryFilesMap.journal.id : null,
      settings: primaryFilesMap.settings ? primaryFilesMap.settings.id : null
    },
    exists: _hasAnyFilesInMap(selectedEval.filesMap),
    metadata: selectedEval.payload.metadata,
    trades: selectedEval.payload.trades,
    journal: selectedEval.payload.journal,
    settings: selectedEval.payload.settings,
    accounts: selectedEval.payload.accounts
  };
}

async function readMetadataOnly(ctx, { folderIds, fileIds = {} }) {
  let metadataFileId = (fileIds && fileIds.metadata) || null;
  if (!metadataFileId && folderIds && folderIds.userData) {
    const filesMap = await listUserDataFiles(ctx, folderIds.userData);
    metadataFileId = filesMap.metadata ? filesMap.metadata.id : null;
  }
  if (!metadataFileId) return { fileId: null, metadata: null };

  try {
    const metadata = await readJsonFile(ctx, metadataFileId);
    return { fileId: metadataFileId, metadata };
  } catch (err) {
    if (err.code === 'NOT_FOUND') return { fileId: null, metadata: null };
    throw err;
  }
}

async function createBackupSnapshot(ctx, { backupsFolderId, reason = 'manual', bundle }) {
  if (!backupsFolderId) {
    throw _makeDriveError('MISSING_FOLDER', 'Backups folder is missing on Google Drive.', 400);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = String(reason || 'manual').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
  const name = `tradefourge-backup-${ts}-${safeReason}.json`;
  return createFileInFolder(ctx, {
    name,
    parentId: backupsFolderId,
    content: bundle,
    mimeType: JSON_MIME,
    appProperties: {
      tradefourgeRole: 'backup',
      backupReason: safeReason
    }
  });
}

async function inspectLegacyBackupsFolderIds(ctx, primaryRootId = null) {
  const ws = await discoverDriveWorkspace(ctx, { inspectPayloads: false });
  return (ws.allBackupFolderIds || []).filter((id) => {
    if (!primaryRootId) return true;
    const primaryBk = ws.folderIds && ws.folderIds.backups;
    return ws.canonicalRoot && ws.canonicalRoot.id === primaryRootId ? id !== primaryBk : true;
  });
}

async function listBackups(ctx, backupsFolderIds, limit = 15) {
  const idList = (Array.isArray(backupsFolderIds) ? backupsFolderIds : [backupsFolderIds]).filter(Boolean);
  const uniqueIds = Array.from(new Set(idList));
  if (uniqueIds.length === 0) return [];

  const maxLimit = Math.min(50, Math.max(1, Number(limit) || 15));
  const perFolder = await Promise.all(
    uniqueIds.map((folderId) => {
      const escapedParent = _escapeQueryValue(folderId);
      const q = `'${escapedParent}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`;
      return listFiles(ctx, {
        q,
        orderBy: 'createdTime desc',
        pageSize: maxLimit,
        fields: 'files(id,name,createdTime,modifiedTime,size,appProperties)'
      });
    })
  );

  const byId = new Map();
  for (const list of perFolder) {
    for (const f of list) {
      if (f && f.id && !byId.has(f.id)) {
        byId.set(f.id, f);
      }
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')))
    .slice(0, maxLimit);
}

async function readOwnedBackupFile(ctx, { fileId, backupsFolderId = null, allowedFolderIds = null }) {
  if (!fileId) {
    throw _makeDriveError('INVALID_REQUEST', 'Backup file ID is required.', 400);
  }
  const meta = await verifyItemExists(ctx, fileId);
  if (!meta) {
    throw _makeDriveError('NOT_FOUND', 'Selected backup file could not be found.', 404);
  }
  const allowedSet = new Set(
    (Array.isArray(allowedFolderIds) ? allowedFolderIds : [backupsFolderId]).filter(Boolean)
  );
  const inUserBackups = allowedSet.size > 0 && Array.isArray(meta.parents) && meta.parents.some((p) => allowedSet.has(p));
  if (!inUserBackups) {
    throw _makeDriveError('FORBIDDEN', 'Backup file does not belong to your TradeFourge Backups folder.', 403);
  }
  const data = await readJsonFile(ctx, fileId);
  return { meta, data };
}

async function deleteOwnedBackupFile(ctx, { fileId, backupsFolderId = null, allowedFolderIds = null }) {
  if (!fileId) {
    throw _makeDriveError('INVALID_REQUEST', 'Backup file ID is required.', 400);
  }
  const meta = await verifyItemExists(ctx, fileId);
  if (!meta) {
    throw _makeDriveError('NOT_FOUND', 'Selected backup file could not be found.', 404);
  }
  if (meta.mimeType === FOLDER_MIME) {
    throw _makeDriveError('FORBIDDEN', 'Folders cannot be deleted from backups.', 403);
  }
  const allowedSet = new Set(
    (Array.isArray(allowedFolderIds) ? allowedFolderIds : [backupsFolderId]).filter(Boolean)
  );
  const inUserBackups = allowedSet.size > 0 && Array.isArray(meta.parents) && meta.parents.some((p) => allowedSet.has(p));
  if (!inUserBackups) {
    throw _makeDriveError('FORBIDDEN', 'Backup file does not belong to your TradeFourge Backups folder.', 403);
  }
  await driveRequest({
    ...ctx,
    url: `${ctx.endpoints.driveApiUrl}/${encodeURIComponent(fileId)}`,
    method: 'DELETE'
  });
  return {
    meta,
    deletedFileId: meta.id || fileId,
    deletedFileName: meta.name || ''
  };
}

async function saveExportFile(ctx, { exportsFolderId, fileName, content, mimeType = JSON_MIME }) {
  if (!exportsFolderId) {
    throw _makeDriveError('MISSING_FOLDER', 'Exports folder is missing on Google Drive.', 400);
  }
  const safeName = String(fileName || `tradefourge-export-${Date.now()}.json`).replace(/[\\/]/g, '_');
  return createFileInFolder(ctx, {
    name: safeName,
    parentId: exportsFolderId,
    content,
    mimeType,
    appProperties: {
      tradefourgeRole: 'export'
    }
  });
}

module.exports = {
  FOLDER_MIME,
  JSON_MIME,
  FOLDER_NAMES,
  DATA_FILENAMES,
  _buildStableTradesMap,
  _hasMeaningfulRemoteData,
  discoverDriveWorkspace,
  inspectFolderStructure,
  ensureFolderStructure,
  listUserDataFiles,
  readJsonFile,
  writeDomainFile,
  readDatabase,
  readMetadataOnly,
  hasLegacyDataHint,
  inspectLegacyBackupsFolderIds,
  createBackupSnapshot,
  listBackups,
  readOwnedBackupFile,
  deleteOwnedBackupFile,
  saveExportFile
};
