/**
 * TradeForge Auth - Consolidated Authentication Router
 *
 * Exposes all authentication endpoints through a single Vercel Serverless Function:
 *   GET  /api/auth/google
 *   GET  /api/auth/callback
 *   GET  /api/auth/session
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 */

const { sendJson, resolveConsolidatedRoute } = require('./_lib/http');
const googleHandler = require('./_lib/auth/google');
const callbackHandler = require('./_lib/auth/callback');
const sessionHandler = require('./_lib/auth/session');
const logoutHandler = require('./_lib/auth/logout');

const ROUTES = new Map([
  ['google', googleHandler],
  ['callback', callbackHandler],
  ['session', sessionHandler],
  ['me', sessionHandler],
  ['logout', logoutHandler]
]);

module.exports = async function handler(req, res) {
  const route = resolveConsolidatedRoute(req, '/api/auth');
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
