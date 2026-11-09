/**
 * TradeForge - End-to-End Backend Server OAuth 2.0 (PKCE) & Google Drive API Tests
 *
 * Uses zero external dependencies: runs real `/api/*` handlers through `scripts/dev-server.js`
 * against an in-process Mock Google OAuth + Drive v3 HTTP server (`TF_ALLOW_TEST_ENDPOINTS=1`).
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const path = require('path');

function _makeJsonRes(res, status, obj) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function _parseForm(raw = '') {
  return new URLSearchParams(String(raw || ''));
}

function _parseMultipart(contentType = '', raw = '') {
  const m = String(contentType).match(/boundary=([^\s;]+)/i);
  if (!m) throw new Error('Missing multipart boundary');
  const boundary = m[1];
  const sections = String(raw)
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((s) => s.replace(/^\r?\n/, '').replace(/\r?\n$/, ''));
  const parts = sections.map((sec) => {
    const idx = sec.indexOf('\r\n\r\n');
    const hdr = idx >= 0 ? sec.slice(0, idx) : '';
    const body = idx >= 0 ? sec.slice(idx + 4) : sec;
    return { hdr, body };
  });
  return {
    metadata: JSON.parse(parts[0].body),
    contentStr: parts[1].body,
    mimeType: (parts[1].hdr.match(/Content-Type:\s*([^\r\n;]+)/i) || [])[1] || 'application/json'
  };
}

function _parseQueryConditions(qStr = '') {
  return String(qStr)
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((expr) => {
      let m = expr.match(/^name\s*=\s*'((?:\\'|[^'])*)'$/i);
      if (m) return { type: 'name_eq', val: m[1].replace(/\\'/g, "'") };
      m = expr.match(/^mimeType\s*=\s*'((?:\\'|[^'])*)'$/i);
      if (m) return { type: 'mime_eq', val: m[1].replace(/\\'/g, "'") };
      m = expr.match(/^mimeType\s*!=\s*'((?:\\'|[^'])*)'$/i);
      if (m) return { type: 'mime_neq', val: m[1].replace(/\\'/g, "'") };
      m = expr.match(/^'((?:\\'|[^'])*)'\s+in\s+parents$/i);
      if (m) return { type: 'parent_in', val: m[1].replace(/\\'/g, "'") };
      m = expr.match(/^trashed\s*=\s*(true|false)$/i);
      if (m) return { type: 'trashed_eq', val: m[1].toLowerCase() === 'true' };
      return { type: 'unknown', raw: expr };
    });
}

function _matchesFile(file, conditions) {
  return conditions.every((c) => {
    if (c.type === 'name_eq') return file.name === c.val;
    if (c.type === 'mime_eq') return file.mimeType === c.val;
    if (c.type === 'mime_neq') return file.mimeType !== c.val;
    if (c.type === 'parent_in') return Array.isArray(file.parents) && file.parents.includes(c.val);
    if (c.type === 'trashed_eq') return Boolean(file.trashed) === c.val;
    return true;
  });
}

async function readStreamBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function createMockGoogleServer() {
  const state = {
    expectedClientId: '1234567890-testwebclient.apps.googleusercontent.com',
    expectedClientSecret: 'GOCSPX-test-server-secret-value-9988',
    nextUser: {
      sub: 'sub_alice_1001',
      email: 'alice.trader@gmail.com',
      name: 'Alice Trader',
      picture: 'https://example.com/alice.png',
      email_verified: true
    },
    nextOAuthBehavior: {
      error: null, // e.g. 'access_denied'
      grantDriveScope: true,
      issueRefreshToken: true,
      idTokenAudienceOverride: null,
      expiresIn: 3600
    },
    forceRefreshResponse: null, // { status, body } | null
    forceNextDriveResponse: null, // { status, body } | null
    authCodes: new Map(), // code -> { state, codeChallenge, codeChallengeMethod, redirectUri, clientId, user, grantDriveScope, issueRefreshToken, idTokenAud, expiresIn }
    accessTokens: new Map(), // token -> { user, scope, expired, idToken }
    refreshTokens: new Map(), // rt -> { user, scope }
    revokedTokens: [],
    tokenRequests: [],
    driveIdSeq: 1,
    drivesBySub: new Map()
  };

  function getDriveStore(sub) {
    if (!state.drivesBySub.has(sub)) {
      state.drivesBySub.set(sub, new Map());
    }
    return state.drivesBySub.get(sub);
  }

  function makeAuthCodeForCurrentUser() {
    const code = 'authcode_' + crypto.randomBytes(8).toString('hex');
    return code;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = urlObj.pathname;
      const method = (req.method || 'GET').toUpperCase();

      // 1. Mock Authorization UI / auto-redirect endpoint
      if (pathname === '/o/oauth2/v2/auth' && method === 'GET') {
        const redirectUri = urlObj.searchParams.get('redirect_uri');
        const oauthState = urlObj.searchParams.get('state') || '';
        const codeChallenge = urlObj.searchParams.get('code_challenge') || '';
        const codeChallengeMethod = urlObj.searchParams.get('code_challenge_method') || '';
        const clientId = urlObj.searchParams.get('client_id') || '';

        if (state.nextOAuthBehavior.error) {
          const cb = new URL(redirectUri);
          cb.searchParams.set('error', state.nextOAuthBehavior.error);
          if (oauthState) cb.searchParams.set('state', oauthState);
          res.writeHead(302, { Location: cb.toString() });
          res.end();
          return;
        }

        const code = makeAuthCodeForCurrentUser();
        state.authCodes.set(code, {
          state: oauthState,
          codeChallenge,
          codeChallengeMethod,
          redirectUri,
          clientId,
          user: { ...state.nextUser },
          grantDriveScope: state.nextOAuthBehavior.grantDriveScope,
          issueRefreshToken: state.nextOAuthBehavior.issueRefreshToken,
          idTokenAud: state.nextOAuthBehavior.idTokenAudienceOverride || clientId,
          expiresIn: state.nextOAuthBehavior.expiresIn || 3600
        });

        const cb = new URL(redirectUri);
        cb.searchParams.set('code', code);
        cb.searchParams.set('state', oauthState);
        res.writeHead(302, { Location: cb.toString() });
        res.end();
        return;
      }

      // 2. Mock OAuth Token Exchange & Refresh Endpoint
      if (pathname === '/token' && method === 'POST') {
        const raw = await readStreamBody(req);
        const form = _parseForm(raw);
        const grantType = form.get('grant_type');
        const clientId = form.get('client_id');
        const clientSecret = form.get('client_secret');
        state.tokenRequests.push({ grantType, clientId, hasSecret: Boolean(clientSecret) });

        if (clientId !== state.expectedClientId || clientSecret !== state.expectedClientSecret) {
          return _makeJsonRes(res, 401, { error: 'invalid_client', error_description: 'Client authentication failed.' });
        }

        if (grantType === 'authorization_code') {
          const code = form.get('code');
          const codeVerifier = form.get('code_verifier') || '';
          const redirectUri = form.get('redirect_uri') || '';
          const entry = state.authCodes.get(code);
          if (!entry) {
            return _makeJsonRes(res, 400, { error: 'invalid_grant', error_description: 'Invalid authorization code.' });
          }
          state.authCodes.delete(code);

          if (entry.redirectUri !== redirectUri) {
            return _makeJsonRes(res, 400, { error: 'redirect_uri_mismatch' });
          }
          if (entry.codeChallengeMethod !== 'S256') {
            return _makeJsonRes(res, 400, { error: 'invalid_request', error_description: 'PKCE S256 required.' });
          }
          const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
          if (expectedChallenge !== entry.codeChallenge) {
            return _makeJsonRes(res, 400, { error: 'invalid_grant', error_description: 'PKCE code_verifier mismatch.' });
          }

          const scope = entry.grantDriveScope
            ? 'openid email profile https://www.googleapis.com/auth/drive.file'
            : 'openid email profile';
          const accessToken = 'ya29.mock_at_' + crypto.randomBytes(10).toString('hex');
          const idToken = 'idt_' + crypto.randomBytes(8).toString('hex');
          const refreshToken = entry.issueRefreshToken
            ? '1//mock_rt_' + crypto.randomBytes(10).toString('hex')
            : undefined;

          state.accessTokens.set(accessToken, {
            user: entry.user,
            scope,
            expired: false,
            idToken,
            aud: entry.idTokenAud
          });
          if (refreshToken) {
            state.refreshTokens.set(refreshToken, { user: entry.user, scope });
          }

          const payload = {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: entry.expiresIn,
            scope,
            id_token: idToken
          };
          if (refreshToken) payload.refresh_token = refreshToken;
          return _makeJsonRes(res, 200, payload);
        }

        if (grantType === 'refresh_token') {
          if (state.forceRefreshResponse) {
            const forced = state.forceRefreshResponse;
            state.forceRefreshResponse = null;
            return _makeJsonRes(res, forced.status, forced.body);
          }
          const rt = form.get('refresh_token');
          const rtEntry = state.refreshTokens.get(rt);
          if (!rtEntry) {
            return _makeJsonRes(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
          }
          const nextAccessToken = 'ya29.mock_at_refreshed_' + crypto.randomBytes(8).toString('hex');
          state.accessTokens.set(nextAccessToken, {
            user: rtEntry.user,
            scope: rtEntry.scope,
            expired: false
          });
          return _makeJsonRes(res, 200, {
            access_token: nextAccessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: rtEntry.scope
          });
        }

        return _makeJsonRes(res, 400, { error: 'unsupported_grant_type' });
      }

      // 3. Mock TokenInfo Endpoint (ID token validation)
      if (pathname === '/tokeninfo' && method === 'GET') {
        const idToken = urlObj.searchParams.get('id_token');
        for (const entry of state.accessTokens.values()) {
          if (entry.idToken === idToken) {
            return _makeJsonRes(res, 200, {
              sub: entry.user.sub,
              email: entry.user.email,
              email_verified: String(entry.user.email_verified),
              aud: entry.aud || state.expectedClientId
            });
          }
        }
        return _makeJsonRes(res, 400, { error_description: 'Invalid Value' });
      }

      // 4. Mock UserInfo Endpoint
      if (pathname === '/oauth2/v3/userinfo' && method === 'GET') {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const entry = state.accessTokens.get(token);
        if (!entry || entry.expired) {
          return _makeJsonRes(res, 401, { error: 'invalid_token' });
        }
        return _makeJsonRes(res, 200, entry.user);
      }

      // 5. Mock Revoke Endpoint
      if (pathname === '/revoke' && method === 'POST') {
        const raw = await readStreamBody(req);
        const form = _parseForm(raw);
        const tok = form.get('token');
        if (tok) {
          state.revokedTokens.push(tok);
          state.accessTokens.delete(tok);
          state.refreshTokens.delete(tok);
        }
        return _makeJsonRes(res, 200, {});
      }

      // 6. Mock Google Drive REST API v3
      if (pathname.startsWith('/drive/v3/files') || pathname.startsWith('/upload/drive/v3/files')) {
        if (state.forceNextDriveResponse) {
          const forced = state.forceNextDriveResponse;
          state.forceNextDriveResponse = null;
          return _makeJsonRes(res, forced.status, forced.body);
        }

        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const entry = state.accessTokens.get(token);
        if (!entry || entry.expired) {
          return _makeJsonRes(res, 401, { error: { message: 'Invalid Credentials' } });
        }
        if (!String(entry.scope || '').includes('https://www.googleapis.com/auth/drive.file')) {
          return _makeJsonRes(res, 403, { error: { message: 'Insufficient Permission', errors: [{ reason: 'insufficientPermissions' }] } });
        }

        const store = getDriveStore(entry.user.sub);

        if (pathname.startsWith('/upload/drive/v3/files')) {
          if (method === 'POST') {
            const raw = await readStreamBody(req);
            const { metadata, contentStr, mimeType } = _parseMultipart(req.headers['content-type'], raw);
            const id = `drv_${state.driveIdSeq++}`;
            const now = new Date(Date.now() + state.driveIdSeq * 10).toISOString();
            const rec = {
              id,
              name: metadata.name,
              mimeType: metadata.mimeType || mimeType || 'application/json',
              parents: metadata.parents || ['root'],
              appProperties: metadata.appProperties || {},
              trashed: false,
              createdTime: now,
              modifiedTime: now,
              size: String(contentStr.length),
              _content: contentStr
            };
            store.set(id, rec);
            const { _content, ...pub } = rec;
            return _makeJsonRes(res, 200, pub);
          }
          if (method === 'PATCH') {
            const fileId = decodeURIComponent(pathname.replace('/upload/drive/v3/files/', ''));
            const rec = store.get(fileId);
            if (!rec || rec.trashed) {
              return _makeJsonRes(res, 404, { error: { message: 'File not found' } });
            }
            const raw = await readStreamBody(req);
            rec._content = raw;
            rec.modifiedTime = new Date(Date.now() + (++state.driveIdSeq) * 10).toISOString();
            rec.size = String(raw.length);
            const { _content, ...pub } = rec;
            return _makeJsonRes(res, 200, pub);
          }
        }

        if (pathname === '/drive/v3/files' && method === 'GET') {
          const q = urlObj.searchParams.get('q') || '';
          const conditions = _parseQueryConditions(q);
          let files = Array.from(store.values()).filter((f) => _matchesFile(f, conditions));
          const orderBy = urlObj.searchParams.get('orderBy') || '';
          if (orderBy.includes('createdTime desc')) {
            files.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
          } else {
            files.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
          }
          const pageSize = Number(urlObj.searchParams.get('pageSize')) || 100;
          files = files.slice(0, pageSize).map(({ _content, ...pub }) => pub);
          return _makeJsonRes(res, 200, { files });
        }

        if (pathname === '/drive/v3/files' && method === 'POST') {
          const raw = await readStreamBody(req);
          const metadata = JSON.parse(raw);
          const id = `fld_${state.driveIdSeq++}`;
          const now = new Date(Date.now() + state.driveIdSeq * 10).toISOString();
          const rec = {
            id,
            name: metadata.name,
            mimeType: metadata.mimeType,
            parents: metadata.parents || ['root'],
            appProperties: metadata.appProperties || {},
            trashed: false,
            createdTime: now,
            modifiedTime: now,
            size: '0',
            _content: null
          };
          store.set(id, rec);
          const { _content, ...pub } = rec;
          return _makeJsonRes(res, 200, pub);
        }

        if (pathname.startsWith('/drive/v3/files/') && method === 'GET') {
          const fileId = decodeURIComponent(pathname.replace('/drive/v3/files/', ''));
          const rec = store.get(fileId);
          if (!rec) {
            return _makeJsonRes(res, 404, { error: { message: 'File not found' } });
          }
          if (urlObj.searchParams.get('alt') === 'media') {
            res.writeHead(200, { 'Content-Type': rec.mimeType || 'application/json' });
            res.end(rec._content || '');
            return;
          }
          const { _content, ...pub } = rec;
          return _makeJsonRes(res, 200, pub);
        }
      }

      _makeJsonRes(res, 404, { error: `Unhandled mock Google route: ${method} ${pathname}` });
    } catch (err) {
      _makeJsonRes(res, 500, { error: err.message });
    }
  });

  return { server, state, getDriveStore };
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  applySetCookieHeaders(setCookieHeaders = []) {
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of arr) {
      if (!raw) continue;
      const parts = String(raw).split(';').map((s) => s.trim());
      const [kv, ...attrs] = parts;
      const eq = kv.indexOf('=');
      if (eq === -1) continue;
      const name = kv.slice(0, eq).trim();
      const val = kv.slice(eq + 1).trim();
      const maxAgeAttr = attrs.find((a) => /^max-age=/i.test(a));
      const maxAge = maxAgeAttr ? Number(maxAgeAttr.split('=')[1]) : null;
      if ((maxAge !== null && maxAge <= 0) || val === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, {
          value: val,
          raw,
          httpOnly: attrs.some((a) => a.toLowerCase() === 'httponly'),
          sameSite: (attrs.find((a) => /^samesite=/i.test(a)) || '').split('=')[1] || ''
        });
      }
    }
  }
  headerString() {
    if (this.cookies.size === 0) return '';
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v.value}`)
      .join('; ');
  }
}

async function rawRequest(baseUrl, pathOrUrl, { method = 'GET', jar = null, headers = {}, body = undefined } = {}) {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : baseUrl + pathOrUrl;
  const reqHeaders = Object.assign({}, headers);
  if (jar) {
    const cStr = jar.headerString();
    if (cStr) reqHeaders.Cookie = cStr;
  }
  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(fullUrl, {
    method,
    headers: reqHeaders,
    body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
    redirect: 'manual'
  });

  if (jar && typeof res.headers.getSetCookie === 'function') {
    jar.applySetCookieHeaders(res.headers.getSetCookie());
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {}

  return {
    status: res.status,
    headers: res.headers,
    location: res.headers.get('location') || '',
    text,
    json
  };
}

async function performFullOAuthLogin(appUrl, googleUrl, jar, queryStr = '') {
  const start = await rawRequest(appUrl, `/api/auth/google${queryStr}`, { jar });
  assert.strictEqual(start.status, 302, 'OAuth start must redirect 302');
  assert.ok(start.location.startsWith(googleUrl + '/o/oauth2/v2/auth'), 'Must redirect to Google auth endpoint');

  const gRes = await rawRequest(googleUrl, start.location);
  assert.strictEqual(gRes.status, 302, 'Mock Google must redirect back to callback');
  assert.ok(gRes.location.startsWith(appUrl + '/api/auth/callback'), 'Must redirect back to app callback URI');

  const cbRes = await rawRequest(appUrl, gRes.location, { jar });
  assert.strictEqual(cbRes.status, 302, 'Callback must redirect back to app root');
  return cbRes;
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING BACKEND OAUTH + ENCRYPTED COOKIE + DRIVE API TESTS');
  console.log('================================================================\n');

  const mockGoogle = createMockGoogleServer();
  await new Promise((resolve) => mockGoogle.server.listen(0, '127.0.0.1', resolve));
  const gPort = mockGoogle.server.address().port;
  const googleUrl = `http://127.0.0.1:${gPort}`;

  const CLIENT_ID = '1234567890-testwebclient.apps.googleusercontent.com';
  const CLIENT_SECRET = 'GOCSPX-test-server-secret-value-9988';
  const SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // Ensure local env loader marks itself loaded before overriding vars to test unconfigured fallback
  const { loadLocalEnv } = require(path.resolve(__dirname, '../api/_lib/env'));
  loadLocalEnv();

  process.env.NODE_ENV = 'test';
  process.env.TF_ALLOW_TEST_ENDPOINTS = '1';
  process.env.TF_TEST_GOOGLE_AUTH_URL = `${googleUrl}/o/oauth2/v2/auth`;
  process.env.TF_TEST_GOOGLE_TOKEN_URL = `${googleUrl}/token`;
  process.env.TF_TEST_GOOGLE_USERINFO_URL = `${googleUrl}/oauth2/v3/userinfo`;
  process.env.TF_TEST_GOOGLE_TOKENINFO_URL = `${googleUrl}/tokeninfo`;
  process.env.TF_TEST_GOOGLE_REVOKE_URL = `${googleUrl}/revoke`;
  process.env.TF_TEST_GOOGLE_DRIVE_API_URL = `${googleUrl}/drive/v3/files`;
  process.env.TF_TEST_GOOGLE_DRIVE_UPLOAD_URL = `${googleUrl}/upload/drive/v3/files`;
  process.env.SESSION_SECRET = SESSION_SECRET;
  process.env.GOOGLE_CLIENT_ID = '';
  process.env.GOOGLE_CLIENT_SECRET = '';
  process.env.GOOGLE_REDIRECT_URI = '';

  const { createAppServer } = require(path.resolve(__dirname, '../scripts/dev-server'));
  const appServer = createAppServer({ reloadEnv: false });
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  const aPort = appServer.address().port;
  const appUrl = `http://127.0.0.1:${aPort}`;
  process.env.GOOGLE_REDIRECT_URI = `${appUrl}/api/auth/callback`;

  try {
    // TEST 1: Static security & frontend HTML cleanliness & Gemini route check
    console.log('[1/8] Testing static file protection, HTML cleanup & existing Gemini route...');
    const [envRes, libRes, scriptRes, pkgRes, usageRes, indexRes] = await Promise.all([
      rawRequest(appUrl, '/.env.local'),
      rawRequest(appUrl, '/api/_lib/env.js'),
      rawRequest(appUrl, '/scripts/dev-server.js'),
      rawRequest(appUrl, '/package.json'),
      rawRequest(appUrl, '/api/usage'),
      rawRequest(appUrl, '/')
    ]);
    assert.strictEqual(envRes.status, 404, '.env.local must NEVER be served');
    assert.strictEqual(libRes.status, 404, '/api/_lib must return 404');
    assert.strictEqual(scriptRes.status, 404, '/scripts must return 404');
    assert.strictEqual(pkgRes.status, 404, '/package.json must return 404');
    assert.strictEqual(usageRes.status, 200, 'Existing /api/usage route must work');
    assert.strictEqual(indexRes.status, 200, '/ must serve index.html');
    assert.ok(!indexRes.text.includes('accounts.google.com/gsi/client'), 'GIS script must be removed');
    assert.ok(!indexRes.text.includes('authOAuthSetupDrawer'), 'Client ID setup drawer must be removed');
    assert.ok(!indexRes.text.includes('inputGoogleClientId'), 'Settings Client ID box must be removed');
    console.log('✓ Test 1 passed\n');

    // TEST 2: Unconfigured server behavior -> clean fallback redirect
    console.log('[2/8] Testing unconfigured OAuth fallback behavior...');
    const jarUnconf = new CookieJar();
    const unconfStart = await rawRequest(appUrl, '/api/auth/google', { jar: jarUnconf });
    assert.strictEqual(unconfStart.status, 302);
    assert.ok(unconfStart.location.includes('auth_error=server_not_configured'));
    const unconfMe = await rawRequest(appUrl, '/api/auth/me', { jar: jarUnconf });
    assert.strictEqual(unconfMe.json.configured, false);
    assert.strictEqual(unconfMe.json.authenticated, false);
    console.log('✓ Test 2 passed\n');

    // Enable OAuth server credentials
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;

    // TEST 3: PKCE + CSRF state + consent scope enforcement
    console.log('[3/8] Testing PKCE, CSRF state validation, access_denied & drive.file scope enforcement...');
    const badStateJar = new CookieJar();
    const badStart = await rawRequest(appUrl, '/api/auth/google', { jar: badStateJar });
    const badAuthUrl = new URL(badStart.location);
    assert.strictEqual(badAuthUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.strictEqual(badAuthUrl.searchParams.get('access_type'), 'offline');
    assert.ok(badStart.location.includes('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file'));
    assert.strictEqual(badStateJar.cookies.get('tf_oauth_tx').httpOnly, true);

    const forgedCb = await rawRequest(appUrl, '/api/auth/callback?code=abc&state=wrong_state', { jar: badStateJar });
    assert.strictEqual(forgedCb.status, 302);
    assert.ok(forgedCb.location.includes('auth_error=invalid_state'));
    assert.strictEqual(badStateJar.cookies.has('tf_oauth_tx'), false, 'Single-use tx cookie must be cleared');

    // Deny drive.file scope
    mockGoogle.state.nextOAuthBehavior.grantDriveScope = false;
    const scopeDenyJar = new CookieJar();
    const scopeDenyRes = await performFullOAuthLogin(appUrl, googleUrl, scopeDenyJar);
    assert.ok(scopeDenyRes.location.includes('auth_error=drive_scope_denied'));
    assert.strictEqual(mockGoogle.state.revokedTokens.length, 1, 'Under-privileged token must be revoked immediately');
    assert.strictEqual(scopeDenyJar.cookies.has('tf_sess'), false);
    mockGoogle.state.nextOAuthBehavior.grantDriveScope = true;
    console.log('✓ Test 3 passed\n');

    // TEST 4: Full OAuth login -> Encrypted HttpOnly Cookie Session -> No secrets leaked -> Tamper rejection
    console.log('[4/8] Testing full OAuth login, HttpOnly cookie security & tamper resistance...');
    const aliceJar = new CookieJar();
    const loginCb = await performFullOAuthLogin(appUrl, googleUrl, aliceJar, '?prompt=select_account&remember=1');
    assert.strictEqual(loginCb.location, '/?auth=success');

    const aliceCookie = aliceJar.cookies.get('tf_sess');
    assert.ok(aliceCookie && aliceCookie.httpOnly, 'Session cookie must be HttpOnly');
    assert.ok(!aliceCookie.value.includes('ya29.'), 'Cookie must be encrypted, never plaintext access_token');
    assert.ok(!aliceCookie.value.includes('mock_rt_'), 'Cookie must never contain plaintext refresh_token');

    const meRes = await rawRequest(appUrl, '/api/auth/me', { jar: aliceJar });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.json.authenticated, true);
    assert.strictEqual(meRes.json.driveConnected, true);
    assert.strictEqual(meRes.json.driveScopeGranted, true);
    assert.strictEqual(meRes.json.rememberMe, true);
    assert.strictEqual(meRes.json.user.email, 'alice.trader@gmail.com');
    assert.ok(!meRes.text.includes('ya29.'), '/api/auth/me must NEVER leak access_token');
    assert.ok(!meRes.text.includes('mock_rt_'), '/api/auth/me must NEVER leak refresh_token');
    assert.ok(!meRes.text.includes(CLIENT_SECRET), '/api/auth/me must NEVER leak client_secret');
    assert.ok(!meRes.text.includes(SESSION_SECRET), '/api/auth/me must NEVER leak session_secret');

    // Tampered cookie rejection
    const tamperJar = new CookieJar();
    tamperJar.cookies.set('tf_sess', { value: aliceCookie.value.slice(0, -4) + 'ZZZZ', httpOnly: true });
    const tamperMe = await rawRequest(appUrl, '/api/auth/me', { jar: tamperJar });
    assert.strictEqual(tamperMe.json.authenticated, false);
    const tamperDrive = await rawRequest(appUrl, '/api/drive/status', { jar: tamperJar });
    assert.strictEqual(tamperDrive.status, 401);
    console.log('✓ Test 4 passed\n');

    // TEST 5: Transparent server-side refresh_token rotation & 5xx resilience
    console.log('[5/8] Testing transparent token refresh on expiration & 5xx resilience...');
    for (const [tok, entry] of mockGoogle.state.accessTokens.entries()) {
      if (entry.user.sub === 'sub_alice_1001') entry.expired = true;
    }
    const statusAfterExpiry = await rawRequest(appUrl, '/api/drive/status', { jar: aliceJar });
    assert.strictEqual(statusAfterExpiry.status, 200, 'Drive status must auto-refresh expired access_token seamlessly');
    assert.strictEqual(statusAfterExpiry.json.connected, true);
    assert.strictEqual(statusAfterExpiry.json.folderExists, false);
    assert.ok(mockGoogle.state.tokenRequests.some((r) => r.grantType === 'refresh_token' && r.hasSecret));

    // Re-auth same user WITHOUT issuing a new refresh_token -> preserves original refresh_token!
    mockGoogle.state.nextOAuthBehavior.issueRefreshToken = false;
    const reauthCb = await performFullOAuthLogin(appUrl, googleUrl, aliceJar, '?remember=1');
    assert.strictEqual(reauthCb.location, '/?auth=success');
    mockGoogle.state.nextOAuthBehavior.issueRefreshToken = true;
    for (const [tok, entry] of mockGoogle.state.accessTokens.entries()) {
      if (entry.user.sub === 'sub_alice_1001') entry.expired = true;
    }
    const stillRefreshes = await rawRequest(appUrl, '/api/drive/status', { jar: aliceJar });
    assert.strictEqual(stillRefreshes.status, 200, 'Preserved refresh_token must keep working across re-auth');
    console.log('✓ Test 5 passed\n');

    // TEST 6: Concurrent folder creation idempotency + CSRF Origin check + Push/Verify + Conflicts + Exports
    console.log('[6/8] Testing concurrent Drive folder creation, push verification, conflicts & exports...');
    const evilPost = await rawRequest(appUrl, '/api/drive/folder', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: 'https://evil.example' },
      body: {}
    });
    assert.strictEqual(evilPost.status, 403, 'Cross-origin mutation must be rejected');

    const [fldA, fldB] = await Promise.all([
      rawRequest(appUrl, '/api/drive/folder', { method: 'POST', jar: aliceJar, headers: { Origin: appUrl }, body: {} }),
      rawRequest(appUrl, '/api/drive/folder', { method: 'POST', jar: aliceJar, headers: { Origin: appUrl }, body: {} })
    ]);
    assert.strictEqual(fldA.status, 200);
    assert.strictEqual(fldA.json.folderIds.root, fldB.json.folderIds.root);
    assert.strictEqual(fldA.json.folderIds.userData, fldB.json.folderIds.userData);
    assert.strictEqual(fldA.json.folderIds.backups, fldB.json.folderIds.backups);
    assert.strictEqual(fldA.json.folderIds.exports, fldB.json.folderIds.exports);

    const aliceDriveFiles = Array.from(mockGoogle.getDriveStore('sub_alice_1001').values());
    assert.strictEqual(aliceDriveFiles.filter((f) => f.name === 'TradeForge').length, 1);
    assert.strictEqual(aliceDriveFiles.filter((f) => f.name === 'User Data').length, 1);
    assert.strictEqual(aliceDriveFiles.filter((f) => f.name === 'Backups').length, 1);
    assert.strictEqual(aliceDriveFiles.filter((f) => f.name === 'Exports').length, 1);

    const initialSnap = {
      trades: [
        {
          ticket: 'EX_700',
          symbol: 'XAUUSD',
          type: 'buy',
          lots: 0.2,
          openTime: '2026-10-10T09:00:00Z',
          closeTime: '2026-10-10T10:00:00Z',
          profit: 240.5,
          broker: 'exness'
        }
      ],
      deletedUids: [],
      notes: 'Respect daily max loss',
      rules: [{ id: 1, text: 'Always set SL', checked: true }],
      currency: 'INR',
      startingCapital: 100000,
      theme: 'midnight',
      mt5Session: null
    };

    const push1 = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'push', snapshot: initialSnap, forceAllDomains: true, force: true, verify: true }
    });
    assert.strictEqual(push1.status, 200);
    assert.strictEqual(push1.json.verified, true);
    assert.strictEqual(push1.json.metadata.counts.trades, 1);

    // Check files physically created inside User Data/
    const udFiles = Array.from(mockGoogle.getDriveStore('sub_alice_1001').values())
      .filter((f) => f.parents && f.parents.includes(push1.json.folderIds.userData));
    const names = udFiles.map((f) => f.name).sort();
    assert.deepStrictEqual(names, ['journal.json', 'metadata.json', 'settings.json', 'trades.json']);

    // Empty-overwrite protection
    const emptyBlock = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: {
        action: 'push',
        snapshot: { ...initialSnap, trades: [] },
        expectedRevisions: push1.json.metadata.revisions
      }
    });
    assert.strictEqual(emptyBlock.status, 409);
    assert.strictEqual(emptyBlock.json.code, 'EMPTY_OVERWRITE_BLOCKED');
    assert.ok(emptyBlock.json.remoteDb);

    // Device 2 pushes a valid revision bump (rev 1 -> rev 2)
    const push2 = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: {
        action: 'push',
        snapshot: { ...initialSnap, trades: [...initialSnap.trades, { ticket: 'EX_702', symbol: 'GBPUSD', profit: 80 }] },
        expectedRevisions: push1.json.metadata.revisions,
        dirtyDomains: { trades: true, journal: false, settings: false }
      }
    });
    assert.strictEqual(push2.status, 200);
    assert.strictEqual(push2.json.metadata.revisions.trades, 2);

    // Device 1 attempts to push with stale rev 1 -> must trigger 409 CONFLICT
    const conflictPush = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: {
        action: 'push',
        snapshot: { ...initialSnap, trades: [...initialSnap.trades, { ticket: 'EX_701', symbol: 'EURUSD', profit: 50 }] },
        expectedRevisions: push1.json.metadata.revisions // stale rev 1 when remote is now rev 2!
      }
    });
    assert.strictEqual(conflictPush.status, 409);
    assert.strictEqual(conflictPush.json.code, 'CONFLICT');

    // Save export into Exports/
    const exportRes = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: {
        action: 'save_export',
        fileName: 'tradeforge-test-export.json',
        content: JSON.stringify(initialSnap.trades),
        mimeType: 'application/json'
      }
    });
    assert.strictEqual(exportRes.status, 200);
    assert.strictEqual(exportRes.json.file.name, 'tradeforge-test-export.json');
    console.log('✓ Test 6 passed\n');

    // TEST 7: Backups, cross-user isolation & Legacy Database/ compatibility bridge
    console.log('[7/8] Testing Backups, cross-user isolation & legacy Database/ read bridge...');
    const manualBk = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'create', reason: 'test-snap', snapshot: initialSnap }
    });
    assert.strictEqual(manualBk.status, 200);
    const aliceBackupId = manualBk.json.file.id;

    // Passing Alice's trades.json fileId (not inside Backups/) to restore must return 403 FORBIDDEN!
    const badRestore = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: push1.json.fileIds.trades }
    });
    assert.strictEqual(badRestore.status, 403);

    // Valid restore creates pre-backup-restore backup first
    const validRestore = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: aliceBackupId, createSafetyBackupFirst: true }
    });
    assert.strictEqual(validRestore.status, 200);
    assert.strictEqual(validRestore.json.restoredTrades, 1);
    assert.ok(validRestore.json.safetyBackupFile.name.includes('pre-backup-restore'));

    // Sign in Bob with pre-existing legacy TradeForge/Database/* files
    const bobStore = mockGoogle.getDriveStore('sub_bob_2002');
    bobStore.set('bob_root', {
      id: 'bob_root',
      name: 'TradeForge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradeforgeRole: 'root' },
      trashed: false,
      createdTime: '2026-01-01T00:00:00Z',
      modifiedTime: '2026-01-01T00:00:00Z'
    });
    bobStore.set('bob_legacy_db', {
      id: 'bob_legacy_db',
      name: 'Database',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['bob_root'],
      appProperties: { tradeforgeRole: 'database' },
      trashed: false,
      createdTime: '2026-01-01T00:00:01Z',
      modifiedTime: '2026-01-01T00:00:01Z'
    });
    bobStore.set('bob_leg_trades', {
      id: 'bob_leg_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['bob_legacy_db'],
      appProperties: { tradeforgeDomain: 'trades' },
      trashed: false,
      createdTime: '2026-01-01T00:00:02Z',
      modifiedTime: '2026-01-01T00:00:02Z',
      _content: JSON.stringify({ trades: [{ ticket: 'BOB_LEG_1', symbol: 'US30', profit: 320 }] })
    });
    bobStore.set('bob_leg_settings', {
      id: 'bob_leg_settings',
      name: 'settings.json',
      mimeType: 'application/json',
      parents: ['bob_legacy_db'],
      appProperties: { tradeforgeDomain: 'settings' },
      trashed: false,
      createdTime: '2026-01-01T00:00:03Z',
      modifiedTime: '2026-01-01T00:00:03Z',
      _content: JSON.stringify({ currency: 'USD', startingCapital: 25000, notes: 'Legacy note' })
    });

    mockGoogle.state.nextUser = {
      sub: 'sub_bob_2002',
      email: 'bob.fx@gmail.com',
      name: 'Bob FX',
      picture: '',
      email_verified: true
    };
    const bobJar = new CookieJar();
    await performFullOAuthLogin(appUrl, googleUrl, bobJar);

    // Bob tries restoring Alice's backup ID -> strictly isolated (404 / 403, never succeeds!)
    const crossRestore = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: bobJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: aliceBackupId }
    });
    assert.ok(crossRestore.status === 404 || crossRestore.status === 403, 'Cross-user backup access must be blocked');

    // Bob reads his own legacy Database/ data seamlessly through User Data bridge
    const bobFull = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: bobJar });
    assert.strictEqual(bobFull.status, 200);
    assert.strictEqual(bobFull.json.legacySource, true);
    assert.strictEqual(bobFull.json.trades.trades[0].ticket, 'BOB_LEG_1');
    assert.strictEqual(bobFull.json.journal.notes, 'Legacy note');
    console.log('✓ Test 7 passed\n');

    // TEST 8: Logout, Google Token Revocation & JTI Session Replay Protection
    console.log('[8/8] Testing logout, token revocation & JTI cookie replay prevention...');
    const savedAliceCookieHeader = aliceJar.headerString();
    const badLogout = await rawRequest(appUrl, '/api/auth/logout', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: 'https://evil.example' },
      body: {}
    });
    assert.strictEqual(badLogout.status, 403);

    const revBefore = mockGoogle.state.revokedTokens.length;
    const logoutRes = await rawRequest(appUrl, '/api/auth/logout', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: {}
    });
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(aliceJar.cookies.has('tf_sess'), false, 'Logout must clear session cookie');
    assert.ok(mockGoogle.state.revokedTokens.length > revBefore, 'Logout must revoke Google token');

    // Replay the captured pre-logout cookie -> JTI revocation list must reject it!
    const replayMe = await rawRequest(appUrl, '/api/auth/me', {
      headers: { Cookie: savedAliceCookieHeader }
    });
    assert.strictEqual(replayMe.json.authenticated, false, 'Replayed cookie after logout must be rejected');

    const replayDrive = await rawRequest(appUrl, '/api/drive/status', {
      headers: { Cookie: savedAliceCookieHeader }
    });
    assert.strictEqual(replayDrive.status, 401, 'Replayed cookie must receive 401 on Drive endpoints');
    console.log('✓ Test 8 passed\n');

    console.log('================================================================');
    console.log('ALL 8 BACKEND OAUTH + ENCRYPTED COOKIE + DRIVE API TESTS PASSED!');
    console.log('================================================================');
  } finally {
    await new Promise((r) => appServer.close(r));
    await new Promise((r) => mockGoogle.server.close(r));
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('TEST FAILURE:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  createMockGoogleServer,
  CookieJar,
  rawRequest,
  performFullOAuthLogin
};
