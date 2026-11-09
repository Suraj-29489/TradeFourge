/**
 * TradeForge Auth - Google OAuth 2.0 Authorization Code Callback Handler
 * GET /api/auth/callback
 */

const crypto = require('crypto');
const { getOAuthConfig } = require('../env');
const { getQueryParams, sendJson, sendRedirect, sendPopupResultHtml } = require('../http');
const {
  readOAuthTxCookie,
  clearOAuthTxCookie,
  readSessionFromRequest,
  writeSessionCookies
} = require('../crypto-session');
const {
  timingSafeStringEqual,
  hasDriveFileScope,
  exchangeAuthorizationCode,
  verifyIdentityAndProfile,
  revokeSessionTokens
} = require('../oauth');

function _appendReturnParam(basePath, key, value) {
  const safeBase = (basePath && basePath.startsWith('/') && !basePath.startsWith('//')) ? basePath : '/';
  const sep = safeBase.includes('?') ? '&' : '?';
  return `${safeBase}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const config = getOAuthConfig(req);
  const query = getQueryParams(req);
  const tx = config.isSessionSecretValid ? readOAuthTxCookie(req, config.sessionSecret) : null;

  // Transaction cookie is strictly single-use
  clearOAuthTxCookie(res, req);

  const isPopup = Boolean(tx && tx.mode === 'popup');
  const returnTo = (tx && tx.returnTo) || '/';

  const finishError = (errorCode, errorMessage) => {
    if (isPopup) {
      return sendPopupResultHtml(res, { ok: false, errorCode, errorMessage }, 200);
    }
    return sendRedirect(res, _appendReturnParam('/', 'auth_error', errorCode), 302);
  };

  if (!config.isReady) {
    return finishError('server_not_configured', 'Google sign-in is not configured on the server.');
  }

  const oauthError = query.get('error');
  if (oauthError) {
    if (oauthError === 'access_denied') {
      return finishError('access_denied', 'Google sign-in permission was cancelled.');
    }
    return finishError('oauth_failed', 'Google sign-in did not complete. Please try again.');
  }

  const code = query.get('code') || '';
  const state = query.get('state') || '';

  if (!tx || !tx.state || !tx.verifier || !timingSafeStringEqual(state, tx.state)) {
    return finishError('invalid_state', 'Your sign-in session expired or could not be verified. Please try again.');
  }

  if (!code) {
    return finishError('missing_code', 'Google did not return an authorization code.');
  }

  try {
    const tokenData = await exchangeAuthorizationCode({
      code,
      codeVerifier: tx.verifier,
      config
    });

    const user = await verifyIdentityAndProfile({
      tokenResponse: tokenData,
      config
    });

    const grantedScope = String(tokenData.scope || '');
    if (!hasDriveFileScope(grantedScope, config.requiredDriveScope)) {
      await revokeSessionTokens({
        session: { accessToken: tokenData.access_token },
        config
      });
      return finishError(
        'drive_scope_denied',
        'Google Drive permission is required so TradeForge can store your journal in My Drive / TradeForge.'
      );
    }

    // If re-authenticating the same Google account and Google did not re-issue a refresh_token,
    // retain any existing refresh_token from the current encrypted session.
    const existingSession = readSessionFromRequest(req, config.sessionSecret);
    const preservedRefreshToken =
      (!tokenData.refresh_token && existingSession && existingSession.user && existingSession.user.sub === user.sub)
        ? existingSession.refreshToken
        : '';

    const expiresInSec = Math.max(60, Number(tokenData.expires_in) || 3600);
    const nextSession = {
      jti: crypto.randomBytes(12).toString('base64url'),
      iat: Date.now(),
      rememberMe: tx.rememberMe !== false,
      user,
      accessToken: String(tokenData.access_token),
      refreshToken: String(tokenData.refresh_token || preservedRefreshToken || ''),
      expiresAt: Date.now() + expiresInSec * 1000 - 60000,
      scope: grantedScope || config.scopes
    };

    writeSessionCookies(res, req, nextSession, config.sessionSecret);

    if (isPopup) {
      return sendPopupResultHtml(res, { ok: true, user: nextSession.user }, 200);
    }

    return sendRedirect(res, _appendReturnParam(returnTo, 'auth', 'success'), 302);
  } catch (err) {
    const codeMap = {
      TOKEN_EXCHANGE_FAILED: 'token_exchange_failed',
      INVALID_ID_TOKEN: 'identity_failed',
      TOKEN_AUDIENCE_MISMATCH: 'identity_failed',
      PROFILE_FETCH_FAILED: 'identity_failed',
      SUBJECT_MISMATCH: 'identity_failed'
    };
    const safeCode = codeMap[err && err.code] || 'auth_failed';
    const safeMsg = (err && err.code === 'TOKEN_EXCHANGE_FAILED')
      ? 'Could not complete Google verification. Please try signing in again.'
      : ((err && err.message) || 'Google authentication failed.');
    return finishError(safeCode, safeMsg);
  }
};
