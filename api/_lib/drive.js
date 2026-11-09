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

// In-memory mutex per user `sub` to prevent concurrent duplicate folder creation
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

async function listFiles(ctx, { q, fields = 'files(id,name,mimeType,createdTime,modifiedTime,size,appProperties,trashed,parents)', orderBy = 'createdTime asc', pageSize = 100 }) {
  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    orderBy,
    pageSize: String(pageSize),
    fields
  });
  const data = await driveRequestJson(ctx, `${ctx.endpoints.driveApiUrl}?${params.toString()}`, { method: 'GET' });
  return Array.isArray(data && data.files) ? data.files : [];
}

async function verifyItemExists(ctx, fileId) {
  if (!fileId) return null;
  try {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,trashed,parents,modifiedTime,appProperties'
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

async function findMatchingFolders(ctx, { name, parentId = 'root', role = 'root' }) {
  const escapedName = _escapeQueryValue(name);
  const escapedParent = _escapeQueryValue(parentId);
  const q = `name = '${escapedName}' and mimeType = '${FOLDER_MIME}' and '${escapedParent}' in parents and trashed = false`;
  const existing = await listFiles(ctx, { q, pageSize: 25 });
  if (existing.length <= 1) return existing;
  const tagged = [];
  const untagged = [];
  for (const f of existing) {
    if (_getRoleProp(f) === role) tagged.push(f);
    else untagged.push(f);
  }
  return tagged.concat(untagged);
}

async function findFolderOnly(ctx, { name, parentId = 'root', role = 'root' }) {
  const matches = await findMatchingFolders(ctx, { name, parentId, role });
  return matches.length > 0 ? matches[0] : null;
}

async function findLegacyRootFolders(ctx) {
  const results = await Promise.all(
    FOLDER_NAMES.LEGACY_ROOTS.map((name) => findMatchingFolders(ctx, { name, parentId: 'root', role: 'root' }))
  );
  const seen = new Set();
  const out = [];
  for (const list of results) {
    for (const f of list) {
      if (f && f.id && !seen.has(f.id)) {
        seen.add(f.id);
        out.push(f);
      }
    }
  }
  return out;
}

async function findOrCreateFolder(ctx, { name, parentId = 'root', role = 'root', cachedId = null }) {
  if (cachedId) {
    const verified = await verifyItemExists(ctx, cachedId);
    if (
      verified &&
      verified.mimeType === FOLDER_MIME &&
      verified.name === name &&
      (!verified.parents || parentId === 'root' || verified.parents.includes(parentId))
    ) {
      return { folder: verified, created: false };
    }
  }

  const found = await findFolderOnly(ctx, { name, parentId, role });
  if (found) {
    return { folder: found, created: false };
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
  return { folder: created, created: true };
}

async function inspectFolderStructure(ctx) {
  const [rootFolder, legacyRoots] = await Promise.all([
    findFolderOnly(ctx, { name: FOLDER_NAMES.ROOT, parentId: 'root', role: 'root' }),
    findLegacyRootFolders(ctx)
  ]);
  const legacyRootFolder = legacyRoots[0] || null;
  if (!rootFolder) {
    return {
      exists: false,
      folderIds: null,
      legacyFolderDetected: Boolean(legacyRootFolder),
      legacyRootId: legacyRootFolder ? legacyRootFolder.id : null
    };
  }
  const [userDataFolder, backupsFolder, exportsFolder] = await Promise.all([
    findFolderOnly(ctx, { name: FOLDER_NAMES.USER_DATA, parentId: rootFolder.id, role: 'user_data' }),
    findFolderOnly(ctx, { name: FOLDER_NAMES.BACKUPS, parentId: rootFolder.id, role: 'backups' }),
    findFolderOnly(ctx, { name: FOLDER_NAMES.EXPORTS, parentId: rootFolder.id, role: 'exports' })
  ]);

  return {
    exists: Boolean(rootFolder),
    legacyFolderDetected: Boolean(legacyRootFolder),
    legacyRootId: legacyRootFolder ? legacyRootFolder.id : null,
    folderIds: {
      root: rootFolder.id,
      userData: userDataFolder ? userDataFolder.id : null,
      database: userDataFolder ? userDataFolder.id : null,
      backups: backupsFolder ? backupsFolder.id : null,
      exports: exportsFolder ? exportsFolder.id : null
    }
  };
}

async function ensureFolderStructure(ctx, ownerSub = 'default', cachedFolderIds = {}) {
  const lockKey = String(ownerSub || 'default');
  if (_ensureMutexes.has(lockKey)) {
    return _ensureMutexes.get(lockKey);
  }

  const task = (async () => {
    const rootRes = await findOrCreateFolder(ctx, {
      name: FOLDER_NAMES.ROOT,
      parentId: 'root',
      role: 'root',
      cachedId: cachedFolderIds && cachedFolderIds.root
    });

    const [userDataRes, backupsRes, exportsRes] = await Promise.all([
      findOrCreateFolder(ctx, {
        name: FOLDER_NAMES.USER_DATA,
        parentId: rootRes.folder.id,
        role: 'user_data',
        cachedId: cachedFolderIds && (cachedFolderIds.userData || cachedFolderIds.database)
      }),
      findOrCreateFolder(ctx, {
        name: FOLDER_NAMES.BACKUPS,
        parentId: rootRes.folder.id,
        role: 'backups',
        cachedId: cachedFolderIds && cachedFolderIds.backups
      }),
      findOrCreateFolder(ctx, {
        name: FOLDER_NAMES.EXPORTS,
        parentId: rootRes.folder.id,
        role: 'exports',
        cachedId: cachedFolderIds && cachedFolderIds.exports
      })
    ]);

    return {
      folderIds: {
        root: rootRes.folder.id,
        userData: userDataRes.folder.id,
        database: userDataRes.folder.id,
        backups: backupsRes.folder.id,
        exports: exportsRes.folder.id
      },
      created: Boolean(rootRes.created || userDataRes.created || backupsRes.created || exportsRes.created),
      reused: !rootRes.created
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

async function _collectLegacyDataCandidates(ctx, primaryFolderIds) {
  const candidates = [];
  const seenFolderIds = new Set();
  const pushCand = (rootName, folder) => {
    if (folder && folder.id && !seenFolderIds.has(folder.id) && folder.id !== primaryFolderIds.userData) {
      seenFolderIds.add(folder.id);
      candidates.push({ rootName, folderId: folder.id });
    }
  };

  // 1. Legacy `Database/` inside primary `TradeFourge` root folder
  if (primaryFolderIds && primaryFolderIds.root) {
    const primaryDbFolder = await findFolderOnly(ctx, {
      name: FOLDER_NAMES.LEGACY_DATABASE,
      parentId: primaryFolderIds.root,
      role: 'database'
    });
    pushCand(FOLDER_NAMES.ROOT, primaryDbFolder);
  }

  // 2. Duplicate `TradeFourge` root folders + all legacy `TradeForge` root folders
  const [allPrimaryRoots, legacyRoots] = await Promise.all([
    findMatchingFolders(ctx, { name: FOLDER_NAMES.ROOT, parentId: 'root', role: 'root' }),
    findLegacyRootFolders(ctx)
  ]);

  for (const altRoot of allPrimaryRoots) {
    if (!altRoot || !altRoot.id || altRoot.id === (primaryFolderIds && primaryFolderIds.root)) continue;
    const [ud, db] = await Promise.all([
      findFolderOnly(ctx, { name: FOLDER_NAMES.USER_DATA, parentId: altRoot.id, role: 'user_data' }),
      findFolderOnly(ctx, { name: FOLDER_NAMES.LEGACY_DATABASE, parentId: altRoot.id, role: 'database' })
    ]);
    pushCand(altRoot.name || FOLDER_NAMES.ROOT, ud);
    pushCand(altRoot.name || FOLDER_NAMES.ROOT, db);
  }

  for (const legacyRoot of legacyRoots) {
    if (!legacyRoot || !legacyRoot.id) continue;
    const [ud, db] = await Promise.all([
      findFolderOnly(ctx, { name: FOLDER_NAMES.USER_DATA, parentId: legacyRoot.id, role: 'user_data' }),
      findFolderOnly(ctx, { name: FOLDER_NAMES.LEGACY_DATABASE, parentId: legacyRoot.id, role: 'database' })
    ]);
    pushCand(legacyRoot.name || FOLDER_NAMES.LEGACY_ROOTS[0], ud);
    pushCand(legacyRoot.name || FOLDER_NAMES.LEGACY_ROOTS[0], db);
  }

  return candidates;
}

async function hasLegacyDataHint(ctx, primaryFolderIds = {}) {
  const candidates = await _collectLegacyDataCandidates(ctx, primaryFolderIds);
  for (const cand of candidates) {
    const filesMap = await listUserDataFiles(ctx, cand.folderId);
    if (_hasAnyFilesInMap(filesMap)) {
      return true;
    }
  }
  return false;
}

async function readDatabase(ctx, { ownerSub, cachedFolderIds = {} } = {}) {
  const ensured = await ensureFolderStructure(ctx, ownerSub, cachedFolderIds);
  const folderIds = ensured.folderIds;
  const primaryFilesMap = await listUserDataFiles(ctx, folderIds.userData);
  const hasPrimaryFiles = _hasAnyFilesInMap(primaryFilesMap);

  let selectedFilesMap = primaryFilesMap;
  let selectedData = hasPrimaryFiles
    ? await _readFilesMapPayload(ctx, primaryFilesMap)
    : { metadata: null, trades: null, journal: null, settings: null, accounts: null };

  let legacySource = false;
  let legacyRootName = null;

  // Bridge from `TradeFourge/Database/`, duplicate `TradeFourge` roots, or legacy `TradeForge/` folders
  // whenever `TradeFourge / User Data/` is absent OR contains only an empty initial placeholder.
  if (!_hasMeaningfulRemoteData(selectedData)) {
    const candidates = await _collectLegacyDataCandidates(ctx, folderIds);
    let firstNonEmptyFallback = null;

    for (const cand of candidates) {
      const candMap = await listUserDataFiles(ctx, cand.folderId);
      if (!_hasAnyFilesInMap(candMap)) continue;
      const candData = await _readFilesMapPayload(ctx, candMap);
      if (_hasMeaningfulRemoteData(candData)) {
        selectedFilesMap = candMap;
        selectedData = candData;
        legacySource = true;
        legacyRootName = cand.rootName;
        break;
      }
      if (!firstNonEmptyFallback && !hasPrimaryFiles) {
        firstNonEmptyFallback = { filesMap: candMap, data: candData, rootName: cand.rootName };
      }
    }

    if (!legacySource && firstNonEmptyFallback) {
      selectedFilesMap = firstNonEmptyFallback.filesMap;
      selectedData = firstNonEmptyFallback.data;
      legacySource = true;
      legacyRootName = firstNonEmptyFallback.rootName;
    }
  }

  return {
    folderIds,
    folderCreated: ensured.created,
    folderReused: ensured.reused,
    legacySource,
    legacyRootName,
    // Keep fileIds anchored strictly to canonical `TradeFourge / User Data/` so subsequent writes
    // never overwrite files inside legacy `TradeForge/` or `Database/` folders.
    fileIds: {
      metadata: primaryFilesMap.metadata ? primaryFilesMap.metadata.id : null,
      trades: primaryFilesMap.trades ? primaryFilesMap.trades.id : null,
      journal: primaryFilesMap.journal ? primaryFilesMap.journal.id : null,
      settings: primaryFilesMap.settings ? primaryFilesMap.settings.id : null
    },
    exists: _hasAnyFilesInMap(selectedFilesMap),
    metadata: selectedData.metadata,
    trades: selectedData.trades,
    journal: selectedData.journal,
    settings: selectedData.settings,
    accounts: selectedData.accounts
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
  const [allPrimaryRoots, legacyRoots] = await Promise.all([
    findMatchingFolders(ctx, { name: FOLDER_NAMES.ROOT, parentId: 'root', role: 'root' }),
    findLegacyRootFolders(ctx)
  ]);

  const rootsToCheck = [];
  for (const r of allPrimaryRoots) {
    if (r && r.id && r.id !== primaryRootId) rootsToCheck.push(r);
  }
  for (const r of legacyRoots) {
    if (r && r.id) rootsToCheck.push(r);
  }
  if (rootsToCheck.length === 0) return [];

  const backupFolders = await Promise.all(
    rootsToCheck.map((r) => findFolderOnly(ctx, { name: FOLDER_NAMES.BACKUPS, parentId: r.id, role: 'backups' }))
  );
  const ids = [];
  const seen = new Set();
  for (const f of backupFolders) {
    if (f && f.id && !seen.has(f.id)) {
      seen.add(f.id);
      ids.push(f.id);
    }
  }
  return ids;
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

async function readOwnedBackupFile(ctx, { fileId, backupsFolderId, allowedFolderIds = null }) {
  const allowedSet = new Set(
    (Array.isArray(allowedFolderIds) ? allowedFolderIds : [backupsFolderId]).filter(Boolean)
  );
  if (!fileId || allowedSet.size === 0) {
    throw _makeDriveError('INVALID_REQUEST', 'Backup file ID is required.', 400);
  }
  const meta = await verifyItemExists(ctx, fileId);
  if (!meta) {
    throw _makeDriveError('NOT_FOUND', 'Selected backup file could not be found.', 404);
  }
  const inUserBackups = Array.isArray(meta.parents) && meta.parents.some((p) => allowedSet.has(p));
  if (!inUserBackups) {
    throw _makeDriveError('FORBIDDEN', 'Backup file does not belong to your TradeFourge Backups folder.', 403);
  }
  const data = await readJsonFile(ctx, fileId);
  return { meta, data };
}

async function deleteOwnedBackupFile(ctx, { fileId, backupsFolderId, allowedFolderIds = null }) {
  const allowedSet = new Set(
    (Array.isArray(allowedFolderIds) ? allowedFolderIds : [backupsFolderId]).filter(Boolean)
  );
  if (!fileId || allowedSet.size === 0) {
    throw _makeDriveError('INVALID_REQUEST', 'Backup file ID is required.', 400);
  }
  const meta = await verifyItemExists(ctx, fileId);
  if (!meta) {
    throw _makeDriveError('NOT_FOUND', 'Selected backup file could not be found.', 404);
  }
  if (meta.mimeType === FOLDER_MIME) {
    throw _makeDriveError('FORBIDDEN', 'Folders cannot be deleted from backups.', 403);
  }
  const inUserBackups = Array.isArray(meta.parents) && meta.parents.some((p) => allowedSet.has(p));
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
