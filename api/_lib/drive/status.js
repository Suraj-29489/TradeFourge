/**
 * TradeForge Drive - Check User Google Drive Connection & Folder Status
 * GET /api/drive/status
 */

const { sendJson, sanitizeErrorForClient } = require('../http');
const { requireDriveContext } = require('../drive-session');
const { inspectFolderStructure, readMetadataOnly } = require('../drive');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  try {
    const { driveCtx, getSession } = await requireDriveContext(req, res);
    const inspected = await inspectFolderStructure(driveCtx);
    let metadata = null;
    if (inspected.exists && inspected.folderIds && inspected.folderIds.userData) {
      const metaRes = await readMetadataOnly(driveCtx, { folderIds: inspected.folderIds });
      metadata = metaRes.metadata;
    }

    const session = getSession();
    return sendJson(res, 200, {
      ok: true,
      connected: true,
      folderExists: inspected.exists,
      folderIds: inspected.folderIds,
      metadata,
      user: session.user
    });
  } catch (err) {
    const safe = sanitizeErrorForClient(err, 'Unable to check Google Drive status.');
    return sendJson(res, safe.status, {
      ok: false,
      code: safe.code,
      message: safe.message
    });
  }
};
