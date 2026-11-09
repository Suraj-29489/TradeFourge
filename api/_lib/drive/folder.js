/**
 * TradeFourge Drive - Idempotent Folder Hierarchy Initialization
 * POST /api/drive/folder
 *
 * Ensures inside authenticated user's My Drive:
 *   TradeFourge / { User Data/, Backups/, Exports/ }
 */

const { sendJson, parseJsonBody, verifySameOriginMutation, sanitizeErrorForClient } = require('../http');
const { requireDriveContext } = require('../drive-session');
const { ensureFolderStructure } = require('../drive');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  if (!verifySameOriginMutation(req)) {
    return sendJson(res, 403, { ok: false, code: 'FORBIDDEN_ORIGIN', message: 'Cross-origin request rejected.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { driveCtx, getSession } = await requireDriveContext(req, res);
    const session = getSession();
    const ensured = await ensureFolderStructure(
      driveCtx,
      session.user.sub,
      (body && body.cachedFolderIds) || {}
    );

    return sendJson(res, 200, {
      ok: true,
      folderIds: ensured.folderIds,
      created: ensured.created,
      reused: ensured.reused
    });
  } catch (err) {
    const safe = sanitizeErrorForClient(err, 'Failed to initialize Google Drive folders.');
    return sendJson(res, safe.status, {
      ok: false,
      code: safe.code,
      message: safe.message
    });
  }
};
