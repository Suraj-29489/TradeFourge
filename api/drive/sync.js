/**
 * TradeForge Drive - Bidirectional Cloud Synchronization Endpoint
 * GET  /api/drive/sync?mode=meta|full
 * POST /api/drive/sync  (action: 'push' | 'save_export')
 */

const {
  getQueryParams,
  sendJson,
  parseJsonBody,
  verifySameOriginMutation,
  sanitizeErrorForClient
} = require('../_lib/http');
const { requireDriveContext } = require('../_lib/drive-session');
const {
  ensureFolderStructure,
  readDatabase,
  readMetadataOnly,
  readJsonFile,
  writeDomainFile,
  createBackupSnapshot,
  saveExportFile
} = require('../_lib/drive');
const {
  buildTradesPayload,
  buildJournalPayload,
  buildSettingsPayload,
  buildMetadataPayload,
  computeDomainChecksums,
  extractSnapshotFromRemoteDb,
  buildBackupBundle,
  normalizeRemoteRevisions
} = require('../_lib/sync-engine');

async function _handleGet(req, res) {
  const { driveCtx, getSession } = await requireDriveContext(req, res);
  const session = getSession();
  const query = getQueryParams(req);
  const mode = query.get('mode') === 'meta' ? 'meta' : 'full';

  if (mode === 'meta') {
    const cachedFolderIds = {
      root: query.get('rootId') || null,
      userData: query.get('userDataId') || null,
      backups: query.get('backupsId') || null,
      exports: query.get('exportsId') || null
    };
    const ensured = await ensureFolderStructure(driveCtx, session.user.sub, cachedFolderIds);
    const metaRes = await readMetadataOnly(driveCtx, { folderIds: ensured.folderIds });
    return sendJson(res, 200, {
      ok: true,
      mode: 'meta',
      folderIds: ensured.folderIds,
      metadataFileId: metaRes.fileId,
      metadata: metaRes.metadata,
      user: session.user
    });
  }

  const remoteDb = await readDatabase(driveCtx, {
    ownerSub: session.user.sub
  });

  return sendJson(res, 200, {
    ok: true,
    mode: 'full',
    folderIds: remoteDb.folderIds,
    fileIds: remoteDb.fileIds,
    exists: remoteDb.exists,
    legacySource: remoteDb.legacySource,
    metadata: remoteDb.metadata,
    trades: remoteDb.trades,
    journal: remoteDb.journal,
    settings: remoteDb.settings,
    accounts: remoteDb.accounts,
    user: session.user
  });
}

async function _handlePost(req, res) {
  if (!verifySameOriginMutation(req)) {
    return sendJson(res, 403, { ok: false, code: 'FORBIDDEN_ORIGIN', message: 'Cross-origin request rejected.' });
  }

  const body = await parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { ok: false, code: 'INVALID_BODY', message: 'Request body must be a JSON object.' });
  }

  const { driveCtx, getSession } = await requireDriveContext(req, res);
  const session = getSession();
  const action = body.action || 'push';

  if (action === 'save_export') {
    const ensured = await ensureFolderStructure(driveCtx, session.user.sub, body.cachedFolderIds || {});
    if (body.content === undefined || body.content === null) {
      return sendJson(res, 400, { ok: false, code: 'MISSING_CONTENT', message: 'Export content is required.' });
    }
    const created = await saveExportFile(driveCtx, {
      exportsFolderId: ensured.folderIds.exports,
      fileName: body.fileName || `tradeforge-export-${new Date().toISOString().slice(0, 10)}.json`,
      content: body.content,
      mimeType: body.mimeType || 'application/json'
    });
    return sendJson(res, 200, {
      ok: true,
      action: 'save_export',
      folderIds: ensured.folderIds,
      file: created
    });
  }

  if (action !== 'push') {
    return sendJson(res, 400, { ok: false, code: 'UNKNOWN_ACTION', message: `Unsupported sync action: ${action}` });
  }

  const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;
  if (!snapshot || !Array.isArray(snapshot.trades)) {
    return sendJson(res, 400, { ok: false, code: 'INVALID_SNAPSHOT', message: 'Snapshot with a trades array is required.' });
  }

  const remoteDb = await readDatabase(driveCtx, {
    ownerSub: session.user.sub,
    cachedFolderIds: body.cachedFolderIds || {}
  });

  const remoteTradesCount = Array.isArray(remoteDb.trades && remoteDb.trades.trades)
    ? remoteDb.trades.trades.length
    : 0;

  // Empty-overwrite guard: prevent unintentional wipe of non-empty remote history
  if (remoteTradesCount > 0 && snapshot.trades.length === 0 && !body.allowEmptyOverwrite) {
    return sendJson(res, 409, {
      ok: false,
      code: 'EMPTY_OVERWRITE_BLOCKED',
      message: 'Blocked overwrite of non-empty Google Drive trade history with an empty dataset.',
      remoteDb
    });
  }

  // Concurrent revision / checksum conflict check
  if (!body.force && remoteDb.exists && body.expectedRevisions && typeof body.expectedRevisions === 'object') {
    const remoteRevs = normalizeRemoteRevisions(remoteDb.metadata);
    const remoteSums = (remoteDb.metadata && remoteDb.metadata.checksums) || {};
    const expRevs = body.expectedRevisions;
    const expSums = body.expectedChecksums || {};

    const expTradesRev = Number(expRevs.trades) || 0;
    const expJournalRev = Number(expRevs.journal !== undefined ? expRevs.journal : expRevs.settings) || 0;
    const expSettingsRev = Number(expRevs.settings !== undefined ? expRevs.settings : expRevs.accounts) || 0;

    const remoteJournalSum = remoteSums.journal || remoteSums.settings || '';
    const expJournalSum = expSums.journal || expSums.settings || '';
    const remoteSettingsSum = remoteSums.settings || remoteSums.accounts || '';
    const expSettingsSum = expSums.settings || expSums.accounts || '';

    const drifted =
      remoteRevs.trades > expTradesRev ||
      remoteRevs.journal > expJournalRev ||
      remoteRevs.settings > expSettingsRev ||
      Boolean(remoteSums.trades && expSums.trades && remoteSums.trades !== expSums.trades) ||
      Boolean(remoteJournalSum && expJournalSum && remoteJournalSum !== expJournalSum) ||
      Boolean(remoteSettingsSum && expSettingsSum && remoteSettingsSum !== expSettingsSum);

    if (drifted) {
      return sendJson(res, 409, {
        ok: false,
        code: 'CONFLICT',
        message: 'Google Drive data changed in another session or device.',
        remoteDb
      });
    }
  }

  let backupFile = null;
  if (body.createSafetyBackup && remoteDb.exists && remoteDb.folderIds && remoteDb.folderIds.backups) {
    const existingRemoteSnap = extractSnapshotFromRemoteDb(remoteDb);
    const bundle = buildBackupBundle({
      snapshot: existingRemoteSnap,
      owner: session.user,
      reason: body.backupReason || 'pre-sync'
    });
    backupFile = await createBackupSnapshot(driveCtx, {
      backupsFolderId: remoteDb.folderIds.backups,
      reason: body.backupReason || 'pre-sync',
      bundle
    });
  }

  const nowIso = new Date().toISOString();
  const folderIds = remoteDb.folderIds;
  const fileIds = Object.assign(
    { metadata: null, trades: null, journal: null, settings: null },
    remoteDb.fileIds || {}
  );

  const currentRevs = normalizeRemoteRevisions(remoteDb.metadata);
  const currentChecksums = (remoteDb.metadata && remoteDb.metadata.checksums) || {};
  const rawDirty = body.dirtyDomains && typeof body.dirtyDomains === 'object' ? body.dirtyDomains : null;
  const dirty = rawDirty
    ? {
        trades: Boolean(rawDirty.trades),
        journal: rawDirty.journal !== undefined ? Boolean(rawDirty.journal) : Boolean(rawDirty.settings),
        settings: Boolean(rawDirty.settings || rawDirty.accounts)
      }
    : { trades: true, journal: true, settings: true };
  const forceAll = Boolean(body.forceAllDomains || remoteDb.legacySource || !remoteDb.exists);

  const tradesPayload = buildTradesPayload(snapshot, nowIso);
  const journalPayload = buildJournalPayload(snapshot, nowIso);
  const settingsPayload = buildSettingsPayload(snapshot, session.user, nowIso);
  const nextChecksums = computeDomainChecksums({ tradesPayload, journalPayload, settingsPayload });

  const nextRevisions = {
    trades: Math.max(1, currentRevs.trades),
    journal: Math.max(1, currentRevs.journal),
    settings: Math.max(1, currentRevs.settings)
  };

  const uploads = [];
  if (dirty.trades || !fileIds.trades || forceAll) {
    nextRevisions.trades = Math.max(1, currentRevs.trades + 1);
    uploads.push(
      writeDomainFile(driveCtx, {
        domainName: 'trades',
        userDataFolderId: folderIds.userData,
        fileId: fileIds.trades,
        data: tradesPayload
      }).then((f) => {
        fileIds.trades = f.id;
      })
    );
  }
  if (dirty.journal || !fileIds.journal || forceAll) {
    nextRevisions.journal = Math.max(1, currentRevs.journal + 1);
    uploads.push(
      writeDomainFile(driveCtx, {
        domainName: 'journal',
        userDataFolderId: folderIds.userData,
        fileId: fileIds.journal,
        data: journalPayload
      }).then((f) => {
        fileIds.journal = f.id;
      })
    );
  }
  if (dirty.settings || !fileIds.settings || forceAll) {
    nextRevisions.settings = Math.max(1, currentRevs.settings + 1);
    uploads.push(
      writeDomainFile(driveCtx, {
        domainName: 'settings',
        userDataFolderId: folderIds.userData,
        fileId: fileIds.settings,
        data: settingsPayload
      }).then((f) => {
        fileIds.settings = f.id;
      })
    );
  }

  if (uploads.length > 0) {
    await Promise.all(uploads);
  }

  const migratedLocalHash = body.migratedLocalHash !== undefined
    ? String(body.migratedLocalHash || '')
    : String((remoteDb.metadata && remoteDb.metadata.migratedLocalHash) || '');

  const metadataPayload = buildMetadataPayload({
    owner: session.user,
    folderIds,
    revisions: nextRevisions,
    checksums: {
      trades: nextChecksums.trades || currentChecksums.trades || '',
      journal: nextChecksums.journal || currentChecksums.journal || '',
      settings: nextChecksums.settings || currentChecksums.settings || ''
    },
    counts: { trades: tradesPayload.trades.length },
    migratedLocalHash,
    nowIso
  });

  const metaFileRes = await writeDomainFile(driveCtx, {
    domainName: 'metadata',
    userDataFolderId: folderIds.userData,
    fileId: fileIds.metadata,
    data: metadataPayload
  });
  fileIds.metadata = metaFileRes.id;

  let verified = true;
  if (body.verify !== false) {
    try {
      const [readTrades, readMeta] = await Promise.all([
        fileIds.trades ? readJsonFile(driveCtx, fileIds.trades) : null,
        fileIds.metadata ? readJsonFile(driveCtx, fileIds.metadata) : null
      ]);
      const remoteCount = Array.isArray(readTrades && readTrades.trades) ? readTrades.trades.length : -1;
      const metaCount = readMeta && readMeta.counts ? readMeta.counts.trades : undefined;
      verified = remoteCount === tradesPayload.trades.length && (metaCount === undefined || metaCount === tradesPayload.trades.length);
    } catch (e) {
      verified = false;
    }
  }

  return sendJson(res, 200, {
    ok: true,
    verified,
    folderIds,
    fileIds,
    metadata: metadataPayload,
    backupFile
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await _handleGet(req, res);
    }
    if (req.method === 'POST') {
      return await _handlePost(req, res);
    }
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  } catch (err) {
    const safe = sanitizeErrorForClient(err, 'Google Drive synchronization failed.');
    return sendJson(res, safe.status, {
      ok: false,
      code: safe.code,
      message: safe.message
    });
  }
};
