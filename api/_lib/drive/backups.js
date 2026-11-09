/**
 * TradeFourge Drive - Backups Listing, Manual Snapshot & Safe Restore Endpoint
 * GET  /api/drive/backups
 * POST /api/drive/backups  (action: 'create' | 'restore' | 'delete')
 */

const {
  getQueryParams,
  sendJson,
  parseJsonBody,
  verifySameOriginMutation,
  sanitizeErrorForClient
} = require('../http');
const { requireDriveContext } = require('../drive-session');
const {
  discoverDriveWorkspace,
  ensureFolderStructure,
  listBackups,
  createBackupSnapshot,
  readOwnedBackupFile,
  deleteOwnedBackupFile,
  readDatabase,
  writeDomainFile
} = require('../drive');
const {
  buildTradesPayload,
  buildJournalPayload,
  buildSettingsPayload,
  buildMetadataPayload,
  computeDomainChecksums,
  extractSnapshotFromRemoteDb,
  buildBackupBundle,
  normalizeRemoteRevisions
} = require('../sync-engine');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { driveCtx } = await requireDriveContext(req, res);
      const query = getQueryParams(req);
      const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 15));
      const ws = await discoverDriveWorkspace(driveCtx, { inspectPayloads: false });
      const backups = ws.allBackupFolderIds && ws.allBackupFolderIds.length > 0
        ? await listBackups(driveCtx, ws.allBackupFolderIds, limit)
        : [];

      return sendJson(res, 200, {
        ok: true,
        folderIds: ws.folderIds,
        backups
      });
    }

    if (req.method === 'POST') {
      if (!verifySameOriginMutation(req)) {
        return sendJson(res, 403, { ok: false, code: 'FORBIDDEN_ORIGIN', message: 'Cross-origin request rejected.' });
      }

      const body = await parseJsonBody(req);
      if (!body || typeof body !== 'object') {
        return sendJson(res, 400, { ok: false, code: 'INVALID_BODY', message: 'Request body must be a JSON object.' });
      }

      const { driveCtx, getSession } = await requireDriveContext(req, res);
      const session = getSession();
      const action = body.action || 'create';

      if (action === 'create') {
        const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;
        if (!snapshot || !Array.isArray(snapshot.trades)) {
          return sendJson(res, 400, { ok: false, code: 'INVALID_SNAPSHOT', message: 'Snapshot with a trades array is required.' });
        }

        const ensured = await ensureFolderStructure(driveCtx, session.user.sub, body.cachedFolderIds || {});
        const folderIds = ensured.folderIds;

        const bundle = buildBackupBundle({
          snapshot,
          owner: session.user,
          reason: body.reason || 'manual'
        });

        const file = await createBackupSnapshot(driveCtx, {
          backupsFolderId: folderIds.backups,
          reason: body.reason || 'manual',
          bundle
        });

        return sendJson(res, 200, {
          ok: true,
          action: 'create',
          folderIds,
          file
        });
      }

      if (action === 'restore') {
        if (!body.fileId || typeof body.fileId !== 'string') {
          return sendJson(res, 400, { ok: false, code: 'MISSING_FILE_ID', message: 'Backup fileId is required.' });
        }

        // Read-only workspace discovery first: verify ownership strictly within user's TradeFourge/TradeForge Backups
        const ws = await discoverDriveWorkspace(driveCtx, {
          inspectPayloads: false,
          cachedFolderIds: body.cachedFolderIds || {}
        });
        const { data: backupData } = await readOwnedBackupFile(driveCtx, {
          fileId: body.fileId,
          backupsFolderId: ws.folderIds && ws.folderIds.backups,
          allowedFolderIds: ws.allBackupFolderIds || []
        });

        if (!backupData || (!backupData.trades && !backupData.settings && !backupData.journal && !backupData.accounts)) {
          return sendJson(res, 400, { ok: false, code: 'INVALID_BACKUP', message: 'Selected backup file is not a valid TradeFourge backup.' });
        }

        const remoteDb = await readDatabase(driveCtx, {
          ownerSub: session.user.sub,
          cachedFolderIds: ws.folderIds || body.cachedFolderIds || {}
        });

        let folderIds = remoteDb.folderIds || ws.folderIds;
        if (
          !folderIds ||
          !folderIds.root ||
          (body.applyToRemote !== false && !folderIds.userData) ||
          (body.createSafetyBackupFirst !== false && !folderIds.backups)
        ) {
          const ensured = await ensureFolderStructure(
            driveCtx,
            session.user.sub,
            folderIds || body.cachedFolderIds || {}
          );
          folderIds = ensured.folderIds;
        }

        let safetyBackupFile = null;
        if (body.createSafetyBackupFirst !== false) {
          const safetySnap = (body.currentSnapshot && Array.isArray(body.currentSnapshot.trades))
            ? body.currentSnapshot
            : (remoteDb.exists ? extractSnapshotFromRemoteDb(remoteDb) : null);

          if (safetySnap) {
            const safetyBundle = buildBackupBundle({
              snapshot: safetySnap,
              owner: session.user,
              reason: 'pre-backup-restore'
            });
            safetyBackupFile = await createBackupSnapshot(driveCtx, {
              backupsFolderId: folderIds.backups,
              reason: 'pre-backup-restore',
              bundle: safetyBundle
            });
          }
        }

        const restoredSnapshot = extractSnapshotFromRemoteDb({
          trades: backupData.trades,
          journal: backupData.journal,
          accounts: backupData.accounts,
          settings: backupData.settings
        });

        let metadataPayload = remoteDb.metadata;
        let fileIds = Object.assign({ metadata: null, trades: null, journal: null, settings: null }, remoteDb.fileIds || {});

        if (body.applyToRemote !== false) {
          const nowIso = new Date().toISOString();
          const currentRevs = normalizeRemoteRevisions(remoteDb.metadata);
          const nextRevisions = {
            trades: Math.max(1, currentRevs.trades + 1),
            journal: Math.max(1, currentRevs.journal + 1),
            settings: Math.max(1, currentRevs.settings + 1)
          };

          const tradesPayload = buildTradesPayload(restoredSnapshot, nowIso);
          const journalPayload = buildJournalPayload(restoredSnapshot, nowIso);
          const settingsPayload = buildSettingsPayload(restoredSnapshot, session.user, nowIso);
          const checksums = computeDomainChecksums({ tradesPayload, journalPayload, settingsPayload });

          await Promise.all([
            writeDomainFile(driveCtx, {
              domainName: 'trades',
              userDataFolderId: folderIds.userData,
              fileId: fileIds.trades,
              data: tradesPayload
            }).then((f) => { fileIds.trades = f.id; }),
            writeDomainFile(driveCtx, {
              domainName: 'journal',
              userDataFolderId: folderIds.userData,
              fileId: fileIds.journal,
              data: journalPayload
            }).then((f) => { fileIds.journal = f.id; }),
            writeDomainFile(driveCtx, {
              domainName: 'settings',
              userDataFolderId: folderIds.userData,
              fileId: fileIds.settings,
              data: settingsPayload
            }).then((f) => { fileIds.settings = f.id; })
          ]);

          metadataPayload = buildMetadataPayload({
            owner: session.user,
            folderIds,
            revisions: nextRevisions,
            checksums,
            counts: { trades: restoredSnapshot.trades.length },
            migratedLocalHash: String((remoteDb.metadata && remoteDb.metadata.migratedLocalHash) || ''),
            nowIso
          });

          const metaRes = await writeDomainFile(driveCtx, {
            domainName: 'metadata',
            userDataFolderId: folderIds.userData,
            fileId: fileIds.metadata,
            data: metadataPayload
          });
          fileIds.metadata = metaRes.id;
        }

        return sendJson(res, 200, {
          ok: true,
          action: 'restore',
          restoredTrades: restoredSnapshot.trades.length,
          restoredSnapshot,
          safetyBackupFile,
          folderIds,
          fileIds,
          metadata: metadataPayload
        });
      }

      if (action === 'delete') {
        if (!body.fileId || typeof body.fileId !== 'string') {
          return sendJson(res, 400, { ok: false, code: 'MISSING_FILE_ID', message: 'Backup fileId is required.' });
        }

        const ws = await discoverDriveWorkspace(driveCtx, {
          inspectPayloads: false,
          cachedFolderIds: body.cachedFolderIds || {}
        });
        const deleted = await deleteOwnedBackupFile(driveCtx, {
          fileId: body.fileId,
          backupsFolderId: ws.folderIds && ws.folderIds.backups,
          allowedFolderIds: ws.allBackupFolderIds || []
        });

        return sendJson(res, 200, {
          ok: true,
          action: 'delete',
          deletedFileId: deleted.deletedFileId,
          deletedFileName: deleted.deletedFileName,
          folderIds: ws.folderIds
        });
      }

      return sendJson(res, 400, { ok: false, code: 'UNKNOWN_ACTION', message: `Unsupported backup action: ${action}` });
    }

    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  } catch (err) {
    const safe = sanitizeErrorForClient(err, 'Google Drive backup operation failed.');
    return sendJson(res, safe.status, {
      ok: false,
      code: safe.code,
      message: safe.message
    });
  }
};
