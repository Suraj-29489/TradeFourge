/**
 * TradeFourge Backend - Encrypted HttpOnly Cookie Session & OAuth Transaction Store
 *
 * Security Properties:
 * - Zero secrets, access tokens, or refresh tokens ever leave the server or enter localStorage.
 * - Uses Node built-in AES-256-GCM authenticated encryption + deflate compression over JSON.
 * - Automatically shards across chunked HttpOnly cookies if payload ever exceeds ~3.4 KB,
 *   while staying well under browser 4 KB cookie limits (~500-900 bytes typically).
 * - Tracks per-instance JTI revocation cache cleanly for immediate post-logout rejection.
 */

const crypto = require('crypto');
const zlib = require('zlib');
const { isHttpsRequest, parseCookies, serializeCookie, appendSetCookie } = require('./http');

const SESSION_COOKIE_BASE = 'tf_sess';
const OAUTH_TX_COOKIE = 'tf_oauth_tx';
const MAX_CHUNKS = 4;
const CHUNK_SIZE = 3400;

const REMEMBER_ME_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const SHORT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours max idle lifetime if not remembered
const OAUTH_TX_TTL_SEC = 10 * 60; // 10 minutes

// Per-warm-instance JTI revocation cache (cleared past expiry)
const _revokedJtis = new Map(); // jti -> expiresAtMs

function _pruneRevoked() {
  const now = Date.now();
  for (const [jti, exp] of _revokedJtis.entries()) {
    if (exp <= now) _revokedJtis.delete(jti);
  }
}

function revokeSessionId(jti, expiresAtMs = Date.now() + 24 * 60 * 60 * 1000) {
  if (!jti) return;
  _pruneRevoked();
  _revokedJtis.set(String(jti), Number(expiresAtMs) || (Date.now() + 24 * 60 * 60 * 1000));
}

function isSessionRevoked(jti) {
  if (!jti) return false;
  const exp = _revokedJtis.get(String(jti));
  if (!exp) return false;
  if (exp <= Date.now()) {
    _revokedJtis.delete(String(jti));
    return false;
  }
  return true;
}

function _deriveEncKey(secret) {
  if (!secret || String(secret).length < 32) {
    const err = new Error('SESSION_SECRET must be configured with at least 32 characters.');
    err.code = 'SESSION_SECRET_MISSING';
    err.status = 500;
    throw err;
  }
  return crypto.createHmac('sha256', String(secret)).update('tradefourge:cookie-aes256gcm:v1').digest();
}

function sealJson(payloadObj, secret) {
  const key = _deriveEncKey(secret);
  const rawBuf = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  const compressed = zlib.deflateRawSync(rawBuf);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return 'v1.' + Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

function unsealJson(token, secret) {
  if (!token || typeof token !== 'string' || !token.startsWith('v1.')) {
    return null;
  }
  try {
    const key = _deriveEncKey(secret);
    const data = Buffer.from(token.slice(3), 'base64url');
    if (data.length < 29) return null;
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const plain = zlib.inflateRawSync(compressed).toString('utf8');
    return JSON.parse(plain);
  } catch (e) {
    return null;
  }
}

function _compactSession(sessionObj) {
  const now = Date.now();
  const rememberMe = sessionObj.rememberMe !== false;
  const maxExp = sessionObj.maxExp || (now + (rememberMe ? REMEMBER_ME_TTL_SEC * 1000 : SHORT_SESSION_TTL_MS));
  return {
    v: 1,
    jti: sessionObj.jti || crypto.randomBytes(12).toString('base64url'),
    iat: sessionObj.iat || now,
    maxExp,
    rm: rememberMe ? 1 : 0,
    u: {
      sub: String(sessionObj.user.sub),
      email: String(sessionObj.user.email),
      name: String(sessionObj.user.name || sessionObj.user.email),
      pic: sessionObj.user.picture ? String(sessionObj.user.picture) : '',
      ev: sessionObj.user.emailVerified ? 1 : 0
    },
    tok: {
      at: String(sessionObj.accessToken || ''),
      rt: String(sessionObj.refreshToken || ''),
      exp: Number(sessionObj.expiresAt || 0),
      sc: String(sessionObj.scope || '')
    }
  };
}

function _expandSession(compact) {
  if (!compact || compact.v !== 1 || !compact.u || !compact.u.sub || !compact.u.email || !compact.tok) {
    return null;
  }
  if (!compact.maxExp || Date.now() > Number(compact.maxExp)) {
    return null;
  }
  if (isSessionRevoked(compact.jti)) {
    return null;
  }
  return {
    jti: String(compact.jti),
    iat: Number(compact.iat || 0),
    maxExp: Number(compact.maxExp),
    rememberMe: Boolean(compact.rm),
    user: {
      sub: String(compact.u.sub),
      email: String(compact.u.email),
      name: String(compact.u.name || compact.u.email),
      picture: compact.u.pic ? String(compact.u.pic) : '',
      emailVerified: Boolean(compact.u.ev)
    },
    accessToken: String(compact.tok.at || ''),
    refreshToken: String(compact.tok.rt || ''),
    expiresAt: Number(compact.tok.exp || 0),
    scope: String(compact.tok.sc || '')
  };
}

function writeSessionCookies(res, req, sessionObj, secret, options = {}) {
  const secure = isHttpsRequest(req);
  const compact = _compactSession(sessionObj);
  const sealed = sealJson(compact, secret);
  const maxAge = compact.rm ? REMEMBER_ME_TTL_SEC : undefined;

  if (sealed.length <= CHUNK_SIZE) {
    appendSetCookie(res, serializeCookie(SESSION_COOKIE_BASE, sealed, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge
    }));
    for (let i = 0; i < MAX_CHUNKS; i++) {
      appendSetCookie(res, serializeCookie(`${SESSION_COOKIE_BASE}.${i}`, '', {
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        maxAge: 0
      }));
    }
    return compact;
  }

  // Shard cleanly across chunked cookies if token payload ever exceeds single-cookie threshold
  const chunks = [];
  for (let i = 0; i < sealed.length; i += CHUNK_SIZE) {
    chunks.push(sealed.slice(i, i + CHUNK_SIZE));
  }
  if (chunks.length > MAX_CHUNKS) {
    // Drop non-essential avatar URL first if needed to fit comfortably within cookie quota
    compact.u.pic = '';
    const trimmedSealed = sealJson(compact, secret);
    chunks.length = 0;
    for (let i = 0; i < trimmedSealed.length; i += CHUNK_SIZE) {
      chunks.push(trimmedSealed.slice(i, i + CHUNK_SIZE));
    }
  }

  appendSetCookie(res, serializeCookie(SESSION_COOKIE_BASE, `chunked:${chunks.length}`, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge
  }));

  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (i < chunks.length) {
      appendSetCookie(res, serializeCookie(`${SESSION_COOKIE_BASE}.${i}`, chunks[i], {
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        maxAge
      }));
    } else {
      appendSetCookie(res, serializeCookie(`${SESSION_COOKIE_BASE}.${i}`, '', {
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        maxAge: 0
      }));
    }
  }
  return compact;
}

function readSessionFromRequest(req, secret) {
  if (!secret || String(secret).length < 32) return null;
  const cookies = parseCookies(req);
  const baseVal = cookies[SESSION_COOKIE_BASE];
  if (!baseVal) return null;

  let sealed = baseVal;
  if (baseVal.startsWith('chunked:')) {
    const count = parseInt(baseVal.slice('chunked:'.length), 10);
    if (!Number.isInteger(count) || count <= 0 || count > MAX_CHUNKS) {
      return null;
    }
    let joined = '';
    for (let i = 0; i < count; i++) {
      const part = cookies[`${SESSION_COOKIE_BASE}.${i}`];
      if (!part) return null;
      joined += part;
    }
    sealed = joined;
  }

  const parsed = unsealJson(sealed, secret);
  return _expandSession(parsed);
}

function clearSessionCookies(res, req) {
  const secure = isHttpsRequest(req);
  appendSetCookie(res, serializeCookie(SESSION_COOKIE_BASE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: 0
  }));
  for (let i = 0; i < MAX_CHUNKS; i++) {
    appendSetCookie(res, serializeCookie(`${SESSION_COOKIE_BASE}.${i}`, '', {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 0
    }));
  }
}

function writeOAuthTxCookie(res, req, txObj, secret) {
  const secure = isHttpsRequest(req);
  const sealed = sealJson({
    ...txObj,
    exp: Date.now() + OAUTH_TX_TTL_SEC * 1000
  }, secret);
  appendSetCookie(res, serializeCookie(OAUTH_TX_COOKIE, sealed, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: OAUTH_TX_TTL_SEC
  }));
}

function readOAuthTxCookie(req, secret) {
  if (!secret || String(secret).length < 32) return null;
  const cookies = parseCookies(req);
  const raw = cookies[OAUTH_TX_COOKIE];
  if (!raw) return null;
  const parsed = unsealJson(raw, secret);
  if (!parsed || !parsed.state || !parsed.exp || Date.now() > Number(parsed.exp)) {
    return null;
  }
  return parsed;
}

function clearOAuthTxCookie(res, req) {
  const secure = isHttpsRequest(req);
  appendSetCookie(res, serializeCookie(OAUTH_TX_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    maxAge: 0
  }));
}

module.exports = {
  SESSION_COOKIE_BASE,
  OAUTH_TX_COOKIE,
  sealJson,
  unsealJson,
  revokeSessionId,
  isSessionRevoked,
  writeSessionCookies,
  readSessionFromRequest,
  clearSessionCookies,
  writeOAuthTxCookie,
  readOAuthTxCookie,
  clearOAuthTxCookie
};
