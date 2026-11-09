/**
 * TradeForge Auth - Logout & Token Revocation Endpoint
 * POST /api/auth/logout
 */

const { getOAuthConfig } = require('../env');
const { sendJson, verifySameOriginMutation } = require('../http');
const {
  readSessionFromRequest,
  clearSessionCookies,
  clearOAuthTxCookie,
  revokeSessionId
} = require('../crypto-session');
const { revokeSessionTokens } = require('../oauth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  if (!verifySameOriginMutation(req)) {
    return sendJson(res, 403, { ok: false, code: 'FORBIDDEN_ORIGIN', message: 'Cross-origin request rejected.' });
  }

  const config = getOAuthConfig(req);
  const session = config.isSessionSecretValid ? readSessionFromRequest(req, config.sessionSecret) : null;

  if (session) {
    revokeSessionId(session.jti, session.maxExp);
    await revokeSessionTokens({ session, config });
  }

  clearSessionCookies(res, req);
  clearOAuthTxCookie(res, req);

  return sendJson(res, 200, {
    ok: true,
    authenticated: false
  });
};
