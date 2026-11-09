/**
 * TradeForge Auth - Start Google OAuth 2.0 Authorization Code + PKCE Flow
 * GET /api/auth/google
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

function _sanitizePrompt(raw) {
  const allowed = new Set(['select_account', 'consent', 'select_account consent', '']);
  if (typeof raw !== 'string') return 'select_account';
  return allowed.has(raw) ? raw : 'select_account';
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
  const prompt = _sanitizePrompt(query.get('prompt'));

  if (!config.isReady) {
    const msg = 'Google sign-in is temporarily unavailable because server authentication is not configured yet.';
    if (mode === 'popup') {
      return sendPopupResultHtml(res, { ok: false, errorCode: 'server_not_configured', errorMessage: msg }, 200);
    }
    return sendRedirect(res, `/?auth_error=server_not_configured`, 302);
  }

  let loginHint = '';
  if (query.get('use_current') === '1') {
    const existing = readSessionFromRequest(req, config.sessionSecret);
    if (existing && existing.user && existing.user.email) {
      loginHint = existing.user.email;
    }
  }

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
      flow: 'signin'
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
