/**
 * TradeFourge Backend - Google OAuth 2.0 Authorization Code Flow + PKCE & Token Lifecycle
 *
 * Security Invariants:
 * - Client Secret stays exclusively on the server and is sent only in server-to-server POSTs.
 * - Uses PKCE (S256) + cryptographic CSRF state verified via constant-time comparison.
 * - Validates returned identity and audience (`aud`) via Google endpoints before issuing session cookie.
 * - Refreshes short-lived access tokens transparently via server-side refresh_token rotation.
 */

const crypto = require('crypto');
const { writeSessionCookies } = require('./crypto-session');

const EXPIRY_SAFETY_BUFFER_MS = 60 * 1000;

function generateRandomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function createPkcePair() {
  const verifier = generateRandomBase64Url(32);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hasDriveFileScope(scopeStr, requiredScope = 'https://www.googleapis.com/auth/drive.file') {
  if (!scopeStr || typeof scopeStr !== 'string') return false;
  const scopes = scopeStr.trim().split(/\s+/);
  return scopes.includes(requiredScope);
}

function buildGoogleAuthorizationUrl({ config, state, codeChallenge, prompt = 'select_account', loginHint = '' }) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes,
    access_type: 'offline',
    include_granted_scopes: 'true',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  if (prompt) {
    params.set('prompt', prompt);
  }
  if (loginHint) {
    params.set('login_hint', loginHint);
  }

  return `${config.endpoints.authUrl}?${params.toString()}`;
}

async function exchangeAuthorizationCode({ code, codeVerifier, config, fetchFn = globalThis.fetch }) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const res = await fetchFn(config.endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    const err = new Error(
      (data && (data.error_description || data.error)) ||
      `Google token exchange failed (HTTP ${res.status}).`
    );
    err.code = 'TOKEN_EXCHANGE_FAILED';
    err.status = res.status >= 400 && res.status < 500 ? 401 : 502;
    err.oauthError = data && data.error ? data.error : '';
    throw err;
  }

  return data;
}

async function verifyIdentityAndProfile({ tokenResponse, config, fetchFn = globalThis.fetch }) {
  let tokenInfoSub = '';
  if (tokenResponse.id_token) {
    const infoUrl = `${config.endpoints.tokeninfoUrl}?id_token=${encodeURIComponent(tokenResponse.id_token)}`;
    const infoRes = await fetchFn(infoUrl, { method: 'GET' });
    const infoData = await infoRes.json().catch(() => null);
    if (!infoRes.ok || !infoData || !infoData.sub) {
      const err = new Error('Could not verify Google identity token.');
      err.code = 'INVALID_ID_TOKEN';
      err.status = 401;
      throw err;
    }
    if (infoData.aud && infoData.aud !== config.clientId) {
      const err = new Error('Google identity token audience mismatch.');
      err.code = 'TOKEN_AUDIENCE_MISMATCH';
      err.status = 401;
      throw err;
    }
    tokenInfoSub = String(infoData.sub);
  }

  const profileRes = await fetchFn(config.endpoints.userinfoUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
  });
  const profile = await profileRes.json().catch(() => null);
  if (!profileRes.ok || !profile || !profile.sub || !profile.email) {
    const err = new Error('Could not retrieve verified Google account profile.');
    err.code = 'PROFILE_FETCH_FAILED';
    err.status = 401;
    throw err;
  }

  if (tokenInfoSub && String(profile.sub) !== tokenInfoSub) {
    const err = new Error('Google identity verification subject mismatch.');
    err.code = 'SUBJECT_MISMATCH';
    err.status = 401;
    throw err;
  }

  return {
    sub: String(profile.sub),
    email: String(profile.email),
    name: String(profile.name || profile.email),
    picture: profile.picture ? String(profile.picture) : '',
    emailVerified: Boolean(profile.email_verified)
  };
}

async function refreshAccessToken({ refreshToken, config, fetchFn = globalThis.fetch }) {
  if (!refreshToken) {
    const err = new Error('Google authorization expired. Please sign in again.');
    err.code = 'AUTH_EXPIRED';
    err.status = 401;
    throw err;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetchFn(config.endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) {
    const isClientRevoked = res.status >= 400 && res.status < 500;
    const err = new Error(
      isClientRevoked
        ? 'Google authorization expired or was revoked. Please reconnect.'
        : `Google authorization service unavailable (HTTP ${res.status}).`
    );
    err.code = isClientRevoked ? 'AUTH_EXPIRED' : 'TOKEN_REFRESH_TRANSIENT';
    err.status = isClientRevoked ? 401 : 502;
    err.oauthError = data && data.error ? data.error : '';
    throw err;
  }

  const expiresInMs = Math.max(60, Number(data.expires_in) || 3600) * 1000;
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
    expiresAt: Date.now() + expiresInMs - EXPIRY_SAFETY_BUFFER_MS,
    scope: data.scope ? String(data.scope) : ''
  };
}

async function ensureValidSessionTokens({ req, res, session, config, forceRefresh = false, fetchFn = globalThis.fetch }) {
  if (!session || !session.user || !session.user.sub) {
    const err = new Error('Authentication required. Please sign in with Google.');
    err.code = 'UNAUTHENTICATED';
    err.status = 401;
    throw err;
  }

  const hasFreshToken = Boolean(
    !forceRefresh &&
    session.accessToken &&
    session.expiresAt &&
    Date.now() < Number(session.expiresAt)
  );

  if (hasFreshToken) {
    return { accessToken: session.accessToken, session, refreshed: false };
  }

  const refreshed = await refreshAccessToken({
    refreshToken: session.refreshToken,
    config,
    fetchFn
  });

  const updatedSession = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || session.refreshToken,
    expiresAt: refreshed.expiresAt,
    scope: refreshed.scope || session.scope
  };

  if (res && req) {
    writeSessionCookies(res, req, updatedSession, config.sessionSecret);
  }

  return {
    accessToken: updatedSession.accessToken,
    session: updatedSession,
    refreshed: true
  };
}

async function revokeSessionTokens({ session, config, fetchFn = globalThis.fetch }) {
  if (!session) return;
  const tokenToRevoke = session.refreshToken || session.accessToken;
  if (!tokenToRevoke) return;

  try {
    const body = new URLSearchParams({ token: tokenToRevoke });
    await fetchFn(config.endpoints.revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
  } catch (e) {
    // Non-fatal: cookie clear still logs the user out locally
  }
}

module.exports = {
  generateRandomBase64Url,
  createPkcePair,
  timingSafeStringEqual,
  hasDriveFileScope,
  buildGoogleAuthorizationUrl,
  exchangeAuthorizationCode,
  verifyIdentityAndProfile,
  refreshAccessToken,
  ensureValidSessionTokens,
  revokeSessionTokens
};
