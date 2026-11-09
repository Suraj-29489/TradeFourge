/**
 * TradeForge Drive - Consolidated Google Drive Cloud Sync Router
 *
 * Exposes all Google Drive endpoints through a single Vercel Serverless Function:
 *   GET      /api/drive/authorize
 *   GET      /api/drive/status
 *   POST     /api/drive/folder
 *   GET/POST /api/drive/sync
 *   GET/POST /api/drive/backups
 */

const { sendJson, resolveConsolidatedRoute } = require('./_lib/http');
const authorizeHandler = require('./_lib/drive/authorize');
const statusHandler = require('./_lib/drive/status');
const folderHandler = require('./_lib/drive/folder');
const syncHandler = require('./_lib/drive/sync');
const backupsHandler = require('./_lib/drive/backups');

const ROUTES = new Map([
  ['authorize', authorizeHandler],
  ['status', statusHandler],
  ['folder', folderHandler],
  ['sync', syncHandler],
  ['backups', backupsHandler]
]);

module.exports = async function handler(req, res) {
  const route = resolveConsolidatedRoute(req, '/api/drive');
  const targetHandler = ROUTES.get(route);
  if (!targetHandler) {
    return sendJson(res, 404, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'API route not found.'
    });
  }
  return await targetHandler(req, res);
};
