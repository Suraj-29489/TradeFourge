/**
 * TradeForge Drive - Incremental / Explicit Google Drive Re-Authorization Flow
 * GET /api/drive/authorize
 */

const { getOAuthConfig } = require('../_lib/env');
const { getQueryParams, sendJson, sendRedirect, sendPopupResultHtml } = require('../_lib/http');
const { writeOAuthTxCookie, readSessionFromRequest } = require('../_lib/crypto-session');
const { generateRandomBase64Url, createPkcePair, buildGoogleAuthorizationUrl } = require('../_lib/oauth');

function _sanitizeReturnTo(raw) {
  if (!raw || typeof raw !== 'string') return '/';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  return trimmed;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const config = getOAuthConfig(req);
  const query = getQueryParams(req);
  const mode = query.get('mode') === 'popup' ? 'popup' : 'redirect';
  const rememberMe = query.get('remember') !== '0';
  const returnTo = _sanitizeReturnTo(query.get('returnTo'));
  const switchAccount = query.get('switch') === '1';

  if (!config.isReady) {
    const msg = 'Google sign-in is temporarily unavailable because server authentication is not configured yet.';
    if (mode === 'popup') {
      return sendPopupResultHtml(res, { ok: false, errorCode: 'server_not_configured', errorMessage: msg }, 200);
    }
    return sendRedirect(res, '/?auth_error=server_not_configured', 302);
  }

  const existing = readSessionFromRequest(req, config.sessionSecret);
  const loginHint = (!switchAccount && existing && existing.user && existing.user.email)
    ? existing.user.email
    : '';
  const prompt = (switchAccount || !loginHint) ? 'select_account consent' : 'consent';

  const state = generateRandomBase64Url(32);
  const { verifier, challenge } = createPkcePair();

  writeOAuthTxCookie(
    res,
    req,
    {
      state,
      verifier,
      mode,
      rememberMe,
      returnTo,
      flow: 'drive_authorize'
    },
    config.sessionSecret
  );

  const authUrl = buildGoogleAuthorizationUrl({
    config,
    state,
    codeChallenge: challenge,
    prompt,
    loginHint
  });

  return sendRedirect(res, authUrl, 302);
};
