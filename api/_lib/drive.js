/**
 * TradeForge Backend - Google Drive REST API v3 Server Storage Client
 *
 * Manages each authenticated user's isolated folder structure inside their own My Drive
 * using minimum `drive.file` scope (never accesses unrelated user files):
 *
 *   My Drive / TradeForge /
 *   ├── User Data/
 *   │   ├── metadata.json
 *   │   ├── trades.json
 *   │   ├── journal.json
 *   │   └── settings.json
 *   ├── Backups/
 *   └── Exports/
 *
 * Also bridges any existing legacy `TradeForge / Database/` files transparently so zero prior data is lost.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';

const FOLDER_NAMES = {
  ROOT: 'TradeForge',
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

async function findFolderOnly(ctx, { name, parentId = 'root', role = 'root' }) {
  const escapedName = _escapeQueryValue(name);
  const escapedParent = _escapeQueryValue(parentId);
  const q = `name = '${escapedName}' and mimeType = '${FOLDER_MIME}' and '${escapedParent}' in parents and trashed = false`;
  const existing = await listFiles(ctx, { q, pageSize: 25 });
  if (existing.length === 0) return null;
  const tagged = existing.find((f) => f.appProperties && f.appProperties.tradeforgeRole === role);
  return tagged || existing[0];
}

async function findOrCreateFolder(ctx, { name, parentId = 'root', role = 'root', cachedId = null }) {
  if (cachedId) {
    const verified = await verifyItemExists(ctx, cachedId);
    if (verified && verified.mimeType === FOLDER_MIME && (!verified.parents || parentId === 'root' || verified.parents.includes(parentId))) {
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
      tradeforgeApp: 'true',
      tradeforgeRole: role
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
  const rootFolder = await findFolderOnly(ctx, { name: FOLDER_NAMES.ROOT, parentId: 'root', role: 'root' });
  if (!rootFolder) {
    return {
      exists: false,
      folderIds: null
    };
  }
  const [userDataFolder, backupsFolder, exportsFolder] = await Promise.all([
    findFolderOnly(ctx, { name: FOLDER_NAMES.USER_DATA, parentId: rootFolder.id, role: 'user_data' }),
    findFolderOnly(ctx, { name: FOLDER_NAMES.BACKUPS, parentId: rootFolder.id, role: 'backups' }),
    findFolderOnly(ctx, { name: FOLDER_NAMES.EXPORTS, parentId: rootFolder.id, role: 'exports' })
  ]);

  return {
    exists: Boolean(rootFolder),
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
    const domain = (file.appProperties && file.appProperties.tradeforgeDomain) || domainByFilename[file.name];
    if (domain && Object.prototype.hasOwnProperty.call(map, domain) && !map[domain]) {
      map[domain] = file;
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
    appProperties: Object.assign({ tradeforgeApp: 'true' }, appProperties)
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
    appProperties: { tradeforgeDomain: domainName }
  });
}

async function readDatabase(ctx, { ownerSub, cachedFolderIds = {} } = {}) {
  const ensured = await ensureFolderStructure(ctx, ownerSub, cachedFolderIds);
  const folderIds = ensured.folderIds;
  let filesMap = await listUserDataFiles(ctx, folderIds.userData);

  const hasUserDataFiles = Boolean(filesMap.metadata || filesMap.trades || filesMap.journal || filesMap.settings);

  // Backwards-compatibility bridge: check legacy `TradeForge/Database/` once if `User Data/` is empty
  let legacySource = false;
  if (!hasUserDataFiles) {
    const legacyFolder = await findFolderOnly(ctx, {
      name: FOLDER_NAMES.LEGACY_DATABASE,
      parentId: folderIds.root,
      role: 'database'
    });
    if (legacyFolder) {
      const legacyMap = await listUserDataFiles(ctx, legacyFolder.id);
      if (legacyMap.metadata || legacyMap.trades || legacyMap.settings || legacyMap.accounts) {
        legacySource = true;
        filesMap = legacyMap;
      }
    }
  }

  const result = {
    folderIds,
    folderCreated: ensured.created,
    folderReused: ensured.reused,
    legacySource,
    fileIds: legacySource
      ? { metadata: null, trades: null, journal: null, settings: null }
      : {
          metadata: filesMap.metadata ? filesMap.metadata.id : null,
          trades: filesMap.trades ? filesMap.trades.id : null,
          journal: filesMap.journal ? filesMap.journal.id : null,
          settings: filesMap.settings ? filesMap.settings.id : null
        },
    exists: Boolean(filesMap.metadata || filesMap.trades || filesMap.journal || filesMap.settings || filesMap.accounts),
    metadata: null,
    trades: null,
    journal: null,
    settings: null,
    accounts: null
  };

  const reads = [];
  if (filesMap.metadata) {
    reads.push(readJsonFile(ctx, filesMap.metadata.id).then((d) => { result.metadata = d; }));
  }
  if (filesMap.trades) {
    reads.push(readJsonFile(ctx, filesMap.trades.id).then((d) => { result.trades = d; }));
  }
  if (filesMap.journal) {
    reads.push(readJsonFile(ctx, filesMap.journal.id).then((d) => { result.journal = d; }));
  }
  if (filesMap.settings) {
    reads.push(readJsonFile(ctx, filesMap.settings.id).then((d) => { result.settings = d; }));
  }
  if (filesMap.accounts) {
    reads.push(readJsonFile(ctx, filesMap.accounts.id).then((d) => { result.accounts = d; }));
  }

  await Promise.all(reads);

  // Merge legacy `settings.notes`/`rules` + `accounts.mt5Session` cleanly if read from legacy structure
  if (!result.journal && result.settings && (result.settings.notes !== undefined || result.settings.rules !== undefined)) {
    result.journal = {
      schemaVersion: result.settings.schemaVersion || '1.0.0',
      updatedAt: result.settings.updatedAt || null,
      notes: result.settings.notes || '',
      rules: Array.isArray(result.settings.rules) ? result.settings.rules : null
    };
  }
  if (result.accounts && result.accounts.mt5Session !== undefined && (!result.settings || result.settings.mt5Session === undefined)) {
    result.settings = Object.assign({}, result.settings || {}, { mt5Session: result.accounts.mt5Session });
  }

  return result;
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
  const name = `tradeforge-backup-${ts}-${safeReason}.json`;
  return createFileInFolder(ctx, {
    name,
    parentId: backupsFolderId,
    content: bundle,
    mimeType: JSON_MIME,
    appProperties: {
      tradeforgeRole: 'backup',
      backupReason: safeReason
    }
  });
}

async function listBackups(ctx, backupsFolderId, limit = 15) {
  if (!backupsFolderId) return [];
  const escapedParent = _escapeQueryValue(backupsFolderId);
  const q = `'${escapedParent}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`;
  return listFiles(ctx, {
    q,
    orderBy: 'createdTime desc',
    pageSize: Math.min(50, Math.max(1, Number(limit) || 15)),
    fields: 'files(id,name,createdTime,modifiedTime,size,appProperties)'
  });
}

async function readOwnedBackupFile(ctx, { fileId, backupsFolderId }) {
  if (!fileId || !backupsFolderId) {
    throw _makeDriveError('INVALID_REQUEST', 'Backup file ID is required.', 400);
  }
  const meta = await verifyItemExists(ctx, fileId);
  if (!meta) {
    throw _makeDriveError('NOT_FOUND', 'Selected backup file could not be found.', 404);
  }
  const inUserBackups = Array.isArray(meta.parents) && meta.parents.includes(backupsFolderId);
  if (!inUserBackups) {
    throw _makeDriveError('FORBIDDEN', 'Backup file does not belong to your TradeForge Backups folder.', 403);
  }
  const data = await readJsonFile(ctx, fileId);
  return { meta, data };
}

async function saveExportFile(ctx, { exportsFolderId, fileName, content, mimeType = JSON_MIME }) {
  if (!exportsFolderId) {
    throw _makeDriveError('MISSING_FOLDER', 'Exports folder is missing on Google Drive.', 400);
  }
  const safeName = String(fileName || `tradeforge-export-${Date.now()}.json`).replace(/[\\/]/g, '_');
  return createFileInFolder(ctx, {
    name: safeName,
    parentId: exportsFolderId,
    content,
    mimeType,
    appProperties: {
      tradeforgeRole: 'export'
    }
  });
}

module.exports = {
  FOLDER_MIME,
  JSON_MIME,
  FOLDER_NAMES,
  DATA_FILENAMES,
  _buildStableTradesMap,
  inspectFolderStructure,
  ensureFolderStructure,
  listUserDataFiles,
  readJsonFile,
  writeDomainFile,
  readDatabase,
  readMetadataOnly,
  createBackupSnapshot,
  listBackups,
  readOwnedBackupFile,
  saveExportFile
};
