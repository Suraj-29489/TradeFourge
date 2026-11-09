/**
 * TradeForge Backend - Authenticated Google Drive Execution Context Helper
 */

const { getOAuthConfig } = require('./env');
const { readSessionFromRequest } = require('./crypto-session');
const { ensureValidSessionTokens, hasDriveFileScope } = require('./oauth');

async function requireDriveContext(req, res) {
  const config = getOAuthConfig(req);
  if (!config.isReady) {
    const err = new Error('Google authentication is not configured on the server.');
    err.status = 503;
    err.code = 'SERVER_NOT_CONFIGURED';
    throw err;
  }

  const initialSession = readSessionFromRequest(req, config.sessionSecret);
  if (!initialSession || !initialSession.user || !initialSession.user.sub) {
    const err = new Error('Authentication required. Please sign in with Google.');
    err.status = 401;
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  let tokenState = await ensureValidSessionTokens({
    req,
    res,
    session: initialSession,
    config,
    forceRefresh: false
  });

  if (!hasDriveFileScope(tokenState.session.scope, config.requiredDriveScope)) {
    const err = new Error('Google Drive access permission is required. Please reconnect your Google account.');
    err.status = 403;
    err.code = 'DRIVE_SCOPE_DENIED';
    throw err;
  }

  const driveCtx = {
    endpoints: config.endpoints,
    getToken: async (force = false) => {
      if (
        force ||
        !tokenState.accessToken ||
        !tokenState.session.expiresAt ||
        Date.now() >= Number(tokenState.session.expiresAt)
      ) {
        tokenState = await ensureValidSessionTokens({
          req,
          res,
          session: tokenState.session,
          config,
          forceRefresh: Boolean(force)
        });
      }
      return tokenState.accessToken;
    },
    refreshTokenFn: async () => {
      tokenState = await ensureValidSessionTokens({
        req,
        res,
        session: tokenState.session,
        config,
        forceRefresh: true
      });
      return tokenState.accessToken;
    }
  };

  return {
    config,
    driveCtx,
    getSession: () => tokenState.session
  };
}

module.exports = {
  requireDriveContext
};
