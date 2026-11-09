/**
 * TradeForge Auth - Active Verified Session & Public User Info Endpoint
 * GET /api/auth/session (also exposed at GET /api/auth/me)
 *
 * Security Invariants:
 * - Unseals AES-256-GCM HttpOnly session cookie strictly on the server.
 * - Transparently refreshes short-lived access tokens using the encrypted refresh_token.
 * - Never returns OAuth access_token, refresh_token, client_secret, or session_secret.
 */

const { getOAuthConfig } = require('../_lib/env');
const { sendJson } = require('../_lib/http');
const { readSessionFromRequest, clearSessionCookies } = require('../_lib/crypto-session');
const { ensureValidSessionTokens, hasDriveFileScope } = require('../_lib/oauth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const config = getOAuthConfig(req);
  let session = config.isSessionSecretValid ? readSessionFromRequest(req, config.sessionSecret) : null;

  if (!session || !session.user || !session.user.sub) {
    return sendJson(res, 200, {
      ok: true,
      authenticated: false,
      configured: config.isReady,
      status: 'signed_out',
      user: null,
      driveConnected: false,
      driveScopeGranted: false,
      expiresAt: 0
    });
  }

  const tokenExpired = !session.accessToken || !session.expiresAt || Date.now() >= Number(session.expiresAt);
  let driveConnected = Boolean(session.accessToken && !tokenExpired && hasDriveFileScope(session.scope, config.requiredDriveScope));

  if (tokenExpired) {
    if (session.refreshToken && config.isReady) {
      try {
        const refreshed = await ensureValidSessionTokens({
          req,
          res,
          session,
          config,
          forceRefresh: true
        });
        session = refreshed.session;
        driveConnected = hasDriveFileScope(session.scope, config.requiredDriveScope);
      } catch (err) {
        if (err && (err.code === 'AUTH_EXPIRED' || err.oauthError === 'invalid_grant')) {
          clearSessionCookies(res, req);
          return sendJson(res, 200, {
            ok: true,
            authenticated: false,
            configured: config.isReady,
            status: 'expired',
            user: null,
            expiredUser: {
              sub: session.user.sub,
              email: session.user.email,
              name: session.user.name,
              picture: session.user.picture
            },
            driveConnected: false,
            driveScopeGranted: false,
            expiresAt: 0
          });
        }
        // Transient network hiccup refreshing: keep cookie session intact cleanly
      }
    } else {
      // Access token expired and no refresh_token stored -> ask user to reconnect
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        configured: config.isReady,
        status: 'expired',
        rememberMe: Boolean(session.rememberMe),
        user: {
          sub: session.user.sub,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture,
          emailVerified: Boolean(session.user.emailVerified)
        },
        driveConnected: false,
        driveScopeGranted: hasDriveFileScope(session.scope, config.requiredDriveScope),
        expiresAt: 0
      });
    }
  }

  const driveScopeGranted = hasDriveFileScope(session.scope, config.requiredDriveScope);

  return sendJson(res, 200, {
    ok: true,
    authenticated: true,
    configured: config.isReady,
    status: driveConnected ? 'authenticated' : 'expired',
    rememberMe: Boolean(session.rememberMe),
    user: {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
      emailVerified: Boolean(session.user.emailVerified)
    },
    driveConnected,
    driveScopeGranted,
    expiresAt: Number(session.expiresAt || 0)
  });
};
