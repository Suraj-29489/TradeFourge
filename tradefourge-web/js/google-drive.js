/**
 * TradeFourge - Google Drive Cloud Storage Client (Server-Proxied API)
 *
 * Communicates strictly with same-origin Vercel serverless `/api/drive/*` routes
 * authenticated by encrypted `HttpOnly` cookies (zero OAuth tokens ever reach frontend JS).
 *
 * Manages each authenticated user's isolated Drive layout:
 *   My Drive / TradeFourge /
 *   ├── User Data/
 *   │   ├── metadata.json
 *   │   ├── trades.json
 *   │   ├── journal.json
 *   │   └── settings.json
 *   ├── Backups/
 *   └── Exports/
 */

(function (global) {
  'use strict';

  const FOLDER_NAMES = {
    ROOT: 'TradeFourge',
    USER_DATA: 'User Data',
    BACKUPS: 'Backups',
    EXPORTS: 'Exports'
  };

  function _getFetchFn() {
    if (GoogleDriveStorage._customFetch) return GoogleDriveStorage._customFetch;
    if (typeof global.fetch === 'function') return global.fetch.bind(global);
    return null;
  }

  function _getDriveEndpoints() {
    if (typeof TradeFourgeConfig !== 'undefined' && typeof TradeFourgeConfig.getDriveEndpoints === 'function') {
      return TradeFourgeConfig.getDriveEndpoints();
    }
    return {
      authorize: '/api/drive/authorize',
      status: '/api/drive/status',
      folder: '/api/drive/folder',
      sync: '/api/drive/sync',
      backups: '/api/drive/backups'
    };
  }

  function _notifyAuthExpired(reason) {
    if (typeof GoogleAuthManager !== 'undefined' && GoogleAuthManager.invalidateToken) {
      GoogleAuthManager.invalidateToken(reason);
    }
  }

  function _makeDriveError(code, message, status = 0, raw = null) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    err.raw = raw;
    if (raw && raw.remoteDb) {
      err.remoteDb = raw.remoteDb;
    }
    return err;
  }

  const GoogleDriveStorage = {
    FOLDER_NAMES,
    _customFetch: null,
    _ensurePromises: {},

    async _requestJson(url, options = {}) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw _makeDriveError('OFFLINE', 'Device is offline. Changes are saved locally and queued for sync.', 0);
      }

      const fetchFn = _getFetchFn();
      if (!fetchFn) {
        throw _makeDriveError('FETCH_UNAVAILABLE', 'Fetch API is not available in this environment.', 0);
      }

      const headers = Object.assign(
        options.body !== undefined ? { 'Content-Type': 'application/json' } : {},
        options.headers || {}
      );

      let response;
      try {
        response = await fetchFn(url, {
          ...options,
          credentials: 'include',
          cache: 'no-store',
          headers
        });
      } catch (networkErr) {
        const isOff = typeof navigator !== 'undefined' && navigator.onLine === false;
        const msg = isOff
          ? 'Network offline while syncing with Google Drive.'
          : (networkErr && networkErr.message) || 'Network error while syncing with Google Drive.';
        throw _makeDriveError(isOff ? 'OFFLINE' : 'NETWORK_ERROR', msg, 0, networkErr);
      }

      let payload = null;
      try {
        const txt = await response.text();
        payload = txt ? JSON.parse(txt) : null;
      } catch (e) {
        payload = null;
      }

      if (response.status === 401) {
        _notifyAuthExpired('http_401');
        throw _makeDriveError(
          'AUTH_EXPIRED',
          (payload && payload.message) || 'Your Google session expired. Please reconnect your account.',
          401,
          payload
        );
      }

      if (!response.ok || (payload && payload.ok === false)) {
        const code = (payload && payload.code) ||
          (response.status === 403 ? 'DRIVE_SCOPE_DENIED' :
            response.status === 409 ? 'CONFLICT' :
            response.status === 429 ? 'RATE_LIMITED' :
            response.status >= 500 ? 'SERVER_ERROR' : 'DRIVE_ERROR');
        const message = (payload && payload.message) || `Google Drive sync request failed (HTTP ${response.status}).`;
        throw _makeDriveError(code, message, response.status, payload);
      }

      return payload;
    },

    async getStatus() {
      const ep = _getDriveEndpoints();
      return this._requestJson(ep.status || '/api/drive/status', { method: 'GET' });
    },

    async ensureFolderStructure(ownerSub = 'default', cachedFolderIds = {}) {
      const lockKey = String(ownerSub || 'default');
      if (this._ensurePromises[lockKey]) {
        return this._ensurePromises[lockKey];
      }

      const task = (async () => {
        const ep = _getDriveEndpoints();
        const res = await this._requestJson(ep.folder || '/api/drive/folder', {
          method: 'POST',
          body: JSON.stringify({ cachedFolderIds: cachedFolderIds || {} })
        });
        return res.folderIds;
      })();

      this._ensurePromises[lockKey] = task;
      try {
        return await task;
      } finally {
        delete this._ensurePromises[lockKey];
      }
    },

    async readDatabase() {
      const ep = _getDriveEndpoints();
      const base = ep.sync || '/api/drive/sync';
      return this._requestJson(`${base}?mode=full`, { method: 'GET' });
    },

    async readMetadataOnly({ folderIds = null } = {}) {
      const ep = _getDriveEndpoints();
      const base = ep.sync || '/api/drive/sync';
      const params = new URLSearchParams({ mode: 'meta' });
      if (folderIds && folderIds.root) params.set('rootId', folderIds.root);
      if (folderIds && (folderIds.userData || folderIds.database)) {
        params.set('userDataId', folderIds.userData || folderIds.database);
      }
      if (folderIds && folderIds.backups) params.set('backupsId', folderIds.backups);
      if (folderIds && folderIds.exports) params.set('exportsId', folderIds.exports);
      const data = await this._requestJson(`${base}?${params.toString()}`, { method: 'GET' });
      return {
        fileId: data.metadataFileId || null,
        metadata: data.metadata || null,
        folderIds: data.folderIds || null,
        legacyAvailable: Boolean(data.legacyAvailable)
      };
    },

    async pushSnapshot({
      snapshot,
      expectedRevisions = null,
      expectedChecksums = null,
      dirtyDomains = null,
      forceAllDomains = false,
      force = false,
      allowEmptyOverwrite = false,
      createSafetyBackup = false,
      backupReason = 'pre-sync',
      migratedLocalHash = undefined,
      cachedFolderIds = null,
      verify = true
    }) {
      const ep = _getDriveEndpoints();
      return this._requestJson(ep.sync || '/api/drive/sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'push',
          snapshot,
          expectedRevisions,
          expectedChecksums,
          dirtyDomains,
          forceAllDomains: Boolean(forceAllDomains),
          force: Boolean(force),
          allowEmptyOverwrite: Boolean(allowEmptyOverwrite),
          createSafetyBackup: Boolean(createSafetyBackup),
          backupReason,
          migratedLocalHash,
          cachedFolderIds: cachedFolderIds || {},
          verify: verify !== false
        })
      });
    },

    async saveExport({ fileName, content, mimeType = 'application/json', cachedFolderIds = null }) {
      const ep = _getDriveEndpoints();
      return this._requestJson(ep.sync || '/api/drive/sync', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_export',
          fileName,
          content,
          mimeType,
          cachedFolderIds: cachedFolderIds || {}
        })
      });
    },

    async createBackupSnapshot({ reason = 'manual', snapshot, cachedFolderIds = null }) {
      const ep = _getDriveEndpoints();
      const res = await this._requestJson(ep.backups || '/api/drive/backups', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          reason,
          snapshot,
          cachedFolderIds: cachedFolderIds || {}
        })
      });
      return res.file || null;
    },

    async listBackups(_backupsFolderId = null, limit = 15) {
      const ep = _getDriveEndpoints();
      const base = ep.backups || '/api/drive/backups';
      const data = await this._requestJson(`${base}?limit=${encodeURIComponent(String(limit || 15))}`, {
        method: 'GET'
      });
      return Array.isArray(data && data.backups) ? data.backups : [];
    },

    async restoreBackupById(fileId, {
      createSafetyBackupFirst = true,
      currentSnapshot = null,
      cachedFolderIds = null
    } = {}) {
      const ep = _getDriveEndpoints();
      return this._requestJson(ep.backups || '/api/drive/backups', {
        method: 'POST',
        body: JSON.stringify({
          action: 'restore',
          fileId,
          createSafetyBackupFirst: createSafetyBackupFirst !== false,
          currentSnapshot,
          applyToRemote: true,
          cachedFolderIds: cachedFolderIds || {}
        })
      });
    },

    async deleteBackupById(fileId, { cachedFolderIds = null } = {}) {
      const ep = _getDriveEndpoints();
      return this._requestJson(ep.backups || '/api/drive/backups', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          fileId,
          cachedFolderIds: cachedFolderIds || {}
        })
      });
    }
  };

  global.GoogleDriveStorage = GoogleDriveStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleDriveStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
