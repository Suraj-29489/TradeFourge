/**
 * TradeFourge - End-to-End Backend Server OAuth 2.0 (PKCE) & Google Drive API Tests
 *
 * Uses zero external dependencies: runs real `/api/*` handlers through `scripts/dev-server.js`
 * against an in-process Mock Google OAuth + Drive v3 HTTP server (`TF_ALLOW_TEST_ENDPOINTS=1`).
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

function listVercelServerlessFunctions(rootDir) {
  const apiDir = path.join(rootDir, 'api');
  const results = [];
  function walk(dir, relPrefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile() && /\.(?:js|mjs|cjs|ts)$/i.test(entry.name)) {
        results.push(`api/${rel}`);
      }
    }
  }
  walk(apiDir, '');
  return results.sort();
}

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
    driveFolderCreations: 0,
    driveFileCreations: 0,
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
            state.driveFileCreations++;
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
          if (metadata.mimeType === 'application/vnd.google-apps.folder') {
            state.driveFolderCreations++;
          }
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
          if (!rec || rec.trashed) {
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

        if (pathname.startsWith('/drive/v3/files/') && method === 'DELETE') {
          const fileId = decodeURIComponent(pathname.replace('/drive/v3/files/', ''));
          const rec = store.get(fileId);
          if (!rec || rec.trashed) {
            return _makeJsonRes(res, 404, { error: { message: 'File not found' } });
          }
          store.delete(fileId);
          res.writeHead(204);
          res.end();
          return;
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
    console.log('[1/10] Testing static file protection, HTML cleanup & existing Gemini route...');
    const [envRes, libRes, scriptRes, pkgRes, usageRes, botOptRes, botGetRes, indexRes] = await Promise.all([
      rawRequest(appUrl, '/.env.local'),
      rawRequest(appUrl, '/api/_lib/env.js'),
      rawRequest(appUrl, '/scripts/dev-server.js'),
      rawRequest(appUrl, '/package.json'),
      rawRequest(appUrl, '/api/usage'),
      rawRequest(appUrl, '/api/strategy-bot', { method: 'OPTIONS' }),
      rawRequest(appUrl, '/api/strategy-bot', { method: 'GET' }),
      rawRequest(appUrl, '/')
    ]);
    assert.strictEqual(envRes.status, 404, '.env.local must NEVER be served');
    assert.strictEqual(libRes.status, 404, '/api/_lib must return 404');
    assert.strictEqual(scriptRes.status, 404, '/scripts must return 404');
    assert.strictEqual(pkgRes.status, 404, '/package.json must return 404');
    assert.strictEqual(usageRes.status, 200, 'Existing /api/usage route must work');
    assert.strictEqual(botOptRes.status, 204, 'Existing /api/strategy-bot OPTIONS must return 204');
    assert.strictEqual(botGetRes.status, 405, 'Existing /api/strategy-bot GET must return 405');
    assert.strictEqual(indexRes.status, 200, '/ must serve index.html');
    assert.ok(!indexRes.text.includes('accounts.google.com/gsi/client'), 'GIS script must be removed');
    assert.ok(!indexRes.text.includes('authOAuthSetupDrawer'), 'Client ID setup drawer must be removed');
    assert.ok(!indexRes.text.includes('inputGoogleClientId'), 'Settings Client ID box must be removed');
    console.log('✓ Test 1 passed\n');

    // TEST 2: Unconfigured server behavior -> clean fallback redirect
    console.log('[2/10] Testing unconfigured OAuth fallback behavior...');
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
    console.log('[3/10] Testing PKCE, CSRF state validation, access_denied & drive.file scope enforcement...');
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
    console.log('[4/10] Testing full OAuth login, HttpOnly cookie security & tamper resistance...');
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
    console.log('[5/10] Testing transparent token refresh on expiration & 5xx resilience...');
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
    console.log('[6/10] Testing concurrent Drive folder creation, push verification, conflicts & exports...');
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
    assert.strictEqual(aliceDriveFiles.filter((f) => f.name === 'TradeFourge').length, 1);
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
        fileName: 'tradefourge-test-export.json',
        content: JSON.stringify(initialSnap.trades),
        mimeType: 'application/json'
      }
    });
    assert.strictEqual(exportRes.status, 200);
    assert.strictEqual(exportRes.json.file.name, 'tradefourge-test-export.json');
    console.log('✓ Test 6 passed\n');

    // TEST 7: Backups, cross-user isolation & Legacy Database/ compatibility bridge
    console.log('[7/10] Testing Backups, cross-user isolation & legacy Database/ read bridge...');
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

    // Backup deletion ownership & isolation checks
    const secondBk = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'create', reason: 'delete-target', snapshot: initialSnap }
    });
    assert.strictEqual(secondBk.status, 200);
    const aliceDeleteId = secondBk.json.file.id;

    // Cross-origin delete blocked (403)
    const evilDelete = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: 'https://evil.example' },
      body: { action: 'delete', fileId: aliceDeleteId }
    });
    assert.strictEqual(evilDelete.status, 403);

    // Missing fileId rejected (400)
    const missingDelId = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'delete' }
    });
    assert.strictEqual(missingDelId.status, 400);

    // Deleting User Data/trades.json via backups delete route must return 403 FORBIDDEN!
    const nonBackupDelete = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: push1.json.fileIds.trades }
    });
    assert.strictEqual(nonBackupDelete.status, 403);

    // Deleting Backups/ folder itself must return 403 FORBIDDEN!
    const folderDelete = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: push1.json.folderIds.backups }
    });
    assert.strictEqual(folderDelete.status, 403);

    // Valid delete removes ONLY targeted backup file; siblings and User Data/ stay untouched
    const listBeforeDel = await rawRequest(appUrl, '/api/drive/backups?limit=10', { jar: aliceJar });
    const countBeforeDel = listBeforeDel.json.backups.length;
    const validDel = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: aliceDeleteId }
    });
    assert.strictEqual(validDel.status, 200);
    assert.strictEqual(validDel.json.ok, true);
    assert.strictEqual(validDel.json.action, 'delete');
    assert.strictEqual(validDel.json.deletedFileId, aliceDeleteId);

    const listAfterDel = await rawRequest(appUrl, '/api/drive/backups?limit=10', { jar: aliceJar });
    assert.strictEqual(listAfterDel.json.backups.length, countBeforeDel - 1);
    assert.ok(!listAfterDel.json.backups.some((b) => b.id === aliceDeleteId), 'Deleted backup must disappear from listing');
    assert.ok(listAfterDel.json.backups.some((b) => b.id === aliceBackupId), 'Sibling backup must remain intact');

    // Second delete of already-deleted ID returns 404
    const dupDel = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: aliceJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: aliceDeleteId }
    });
    assert.strictEqual(dupDel.status, 404);

    // Sign in Bob with pre-existing legacy TradeFourge/Database/* files
    const bobStore = mockGoogle.getDriveStore('sub_bob_2002');
    bobStore.set('bob_root', {
      id: 'bob_root',
      name: 'TradeFourge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradefourgeRole: 'root' },
      trashed: false,
      createdTime: '2026-01-01T00:00:00Z',
      modifiedTime: '2026-01-01T00:00:00Z'
    });
    bobStore.set('bob_legacy_db', {
      id: 'bob_legacy_db',
      name: 'Database',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['bob_root'],
      appProperties: { tradefourgeRole: 'database' },
      trashed: false,
      createdTime: '2026-01-01T00:00:01Z',
      modifiedTime: '2026-01-01T00:00:01Z'
    });
    bobStore.set('bob_leg_trades', {
      id: 'bob_leg_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['bob_legacy_db'],
      appProperties: { tradefourgeDomain: 'trades' },
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
      appProperties: { tradefourgeDomain: 'settings' },
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

    // Bob tries restoring or deleting Alice's backup ID -> strictly isolated (404 / 403, never succeeds!)
    const crossRestore = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: bobJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: aliceBackupId }
    });
    assert.ok(crossRestore.status === 404 || crossRestore.status === 403, 'Cross-user backup access must be blocked');

    const crossDelete = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: bobJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: aliceBackupId }
    });
    assert.ok(crossDelete.status === 404 || crossDelete.status === 403, 'Cross-user backup delete must be blocked');

    // Bob reads his own legacy Database/ data seamlessly through User Data bridge
    const bobFull = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: bobJar });
    assert.strictEqual(bobFull.status, 200);
    assert.strictEqual(bobFull.json.legacySource, true);
    assert.strictEqual(bobFull.json.trades.trades[0].ticket, 'BOB_LEG_1');
    assert.strictEqual(bobFull.json.journal.notes, 'Legacy note');
    console.log('✓ Test 7 passed\n');

    // TEST 8: Logout, Google Token Revocation & JTI Session Replay Protection
    console.log('[8/10] Testing logout, token revocation & JTI cookie replay prevention...');
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

    // TEST 9: Vercel Hobby function count limit (<= 12) + consolidated route validation
    console.log('[9/10] Testing Vercel Serverless Function limit (<= 12) & consolidated route guards...');
    const rootDir = path.resolve(__dirname, '..');
    const detectedFunctions = listVercelServerlessFunctions(rootDir);
    assert.ok(detectedFunctions.length <= 12, `Expected <= 12 Vercel Serverless Functions, found ${detectedFunctions.length}`);
    assert.deepStrictEqual(detectedFunctions, [
      'api/auth.js',
      'api/drive.js',
      'api/strategy-bot.js',
      'api/usage.js'
    ]);

    const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8'));
    assert.deepStrictEqual(Object.keys(vercelConfig.functions || {}).sort(), detectedFunctions);
    assert.ok(
      Array.isArray(vercelConfig.rewrites) &&
      vercelConfig.rewrites.some((r) => r.source === '/api/auth/:route' && r.destination === '/api/auth?__route=:route') &&
      vercelConfig.rewrites.some((r) => r.source === '/api/drive/:route' && r.destination === '/api/drive?__route=:route'),
      'vercel.json must rewrite /api/auth/:route and /api/drive/:route cleanly'
    );

    const invalidRoutes = [
      '/api/auth',
      '/api/auth/',
      '/api/auth/nonexistent',
      '/api/auth/constructor',
      '/api/auth/__proto__',
      '/api/auth/a/b',
      '/api/auth/a/b?__route=google',
      '/api/drive',
      '/api/drive/',
      '/api/drive/nonexistent',
      '/api/drive/constructor',
      '/api/drive/x/y',
      '/api/usage-store',
      '/api/_lib/usage-store',
      '/api/_lib/auth/session'
    ];
    for (const badPath of invalidRoutes) {
      const badRes = await rawRequest(appUrl, badPath);
      assert.strictEqual(badRes.status, 404, `Expected 404 for ${badPath}, got ${badRes.status}`);
    }

    const [sessOut, meOut] = await Promise.all([
      rawRequest(appUrl, '/api/auth/session'),
      rawRequest(appUrl, '/api/auth/me')
    ]);
    assert.strictEqual(sessOut.status, 200);
    assert.strictEqual(meOut.status, 200);
    assert.deepStrictEqual(sessOut.json, meOut.json, '/api/auth/session and /api/auth/me must stay identical');
    console.log('✓ Test 9 passed\n');

    // TEST 10: Vercel rewrite destination simulation (?__route=...) end-to-end
    console.log('[10/10] Testing Vercel rewrite destination (?__route=...) end-to-end flow...');
    const rwJar = new CookieJar();
    const rwStart = await rawRequest(appUrl, '/api/auth?__route=google&mode=redirect&remember=1', { jar: rwJar });
    assert.strictEqual(rwStart.status, 302);
    const rwAuthUrl = new URL(rwStart.location);
    assert.strictEqual(rwAuthUrl.searchParams.get('redirect_uri'), `${appUrl}/api/auth/callback`);
    assert.ok(!rwAuthUrl.searchParams.has('__route'), '__route must not leak into Google auth redirect');

    const rwGoogle = await rawRequest(googleUrl, rwStart.location);
    assert.strictEqual(rwGoogle.status, 302);
    const gCbUrl = new URL(rwGoogle.location);
    assert.strictEqual(gCbUrl.pathname, '/api/auth/callback');

    // Simulate Vercel Edge rewriting /api/auth/callback?... -> /api/auth?__route=callback&...
    const rewrittenCbPath = `/api/auth?__route=callback&${gCbUrl.searchParams.toString()}`;
    const rwCbRes = await rawRequest(appUrl, rewrittenCbPath, { jar: rwJar });
    assert.strictEqual(rwCbRes.status, 302);
    assert.strictEqual(rwCbRes.location, '/?auth=success');
    assert.ok(rwJar.cookies.has('tf_sess'), 'Rewritten OAuth callback must issue session cookie');

    const [rwSess, rwMe] = await Promise.all([
      rawRequest(appUrl, '/api/auth?__route=session', { jar: rwJar }),
      rawRequest(appUrl, '/api/auth?__route=me', { jar: rwJar })
    ]);
    assert.strictEqual(rwSess.status, 200);
    assert.strictEqual(rwSess.json.authenticated, true);
    assert.deepStrictEqual(rwSess.json.user, rwMe.json.user);

    const rwAuthz = await rawRequest(appUrl, '/api/drive?__route=authorize&mode=redirect', { jar: rwJar });
    assert.strictEqual(rwAuthz.status, 302);
    assert.ok(rwAuthz.location.startsWith(googleUrl + '/o/oauth2/v2/auth'));

    const rwStatus = await rawRequest(appUrl, '/api/drive?__route=status', { jar: rwJar });
    assert.strictEqual(rwStatus.status, 200);
    assert.strictEqual(rwStatus.json.connected, true);

    const rwFolder = await rawRequest(appUrl, '/api/drive?__route=folder', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: {}
    });
    assert.strictEqual(rwFolder.status, 200);
    assert.ok(rwFolder.json.folderIds && rwFolder.json.folderIds.root);

    const rwMeta = await rawRequest(appUrl, `/api/drive?__route=sync&mode=meta&rootId=${encodeURIComponent(rwFolder.json.folderIds.root)}`, {
      jar: rwJar
    });
    assert.strictEqual(rwMeta.status, 200);
    assert.strictEqual(rwMeta.json.mode, 'meta');

    const rwSync = await rawRequest(appUrl, '/api/drive?__route=sync', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: { action: 'push', snapshot: initialSnap, forceAllDomains: true, force: true, verify: true }
    });
    assert.strictEqual(rwSync.status, 200);
    assert.strictEqual(rwSync.json.verified, true);

    const rwFull = await rawRequest(appUrl, '/api/drive?__route=sync&mode=full', { jar: rwJar });
    assert.strictEqual(rwFull.status, 200);
    assert.strictEqual(rwFull.json.mode, 'full');
    assert.strictEqual(rwFull.json.trades.trades[0].ticket, 'EX_700');

    const rwExport = await rawRequest(appUrl, '/api/drive?__route=sync', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: { action: 'save_export', fileName: 'rw-export.json', content: '[]', mimeType: 'application/json' }
    });
    assert.strictEqual(rwExport.status, 200);
    assert.strictEqual(rwExport.json.file.name, 'rw-export.json');

    const rwBkCreate = await rawRequest(appUrl, '/api/drive?__route=backups', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: { action: 'create', reason: 'rw-test', snapshot: initialSnap }
    });
    assert.strictEqual(rwBkCreate.status, 200);
    assert.ok(rwBkCreate.json.file && rwBkCreate.json.file.id);

    const rwBackups = await rawRequest(appUrl, '/api/drive?__route=backups&limit=5', { jar: rwJar });
    assert.strictEqual(rwBackups.status, 200);
    assert.ok(Array.isArray(rwBackups.json.backups) && rwBackups.json.backups.length >= 1);

    const rwBkRestore = await rawRequest(appUrl, '/api/drive?__route=backups', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: rwBkCreate.json.file.id, createSafetyBackupFirst: true }
    });
    assert.strictEqual(rwBkRestore.status, 200);
    assert.strictEqual(rwBkRestore.json.restoredTrades, 1);

    const rwBkDelete = await rawRequest(appUrl, '/api/drive?__route=backups', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: rwBkCreate.json.file.id }
    });
    assert.strictEqual(rwBkDelete.status, 200);
    assert.strictEqual(rwBkDelete.json.deletedFileId, rwBkCreate.json.file.id);

    const rwLogout = await rawRequest(appUrl, '/api/auth?__route=logout', {
      method: 'POST',
      jar: rwJar,
      headers: { Origin: appUrl },
      body: {}
    });
    assert.strictEqual(rwLogout.status, 200);
    assert.strictEqual(rwJar.cookies.has('tf_sess'), false);

    // Production proxy headers + fallback redirect URI check (https://tradefourge.vercel.app/api/auth/callback)
    const prevRedirectUri = process.env.GOOGLE_REDIRECT_URI;
    try {
      process.env.GOOGLE_REDIRECT_URI = '';
      const prodHeaders = {
        'X-Forwarded-Host': 'tradefourge.vercel.app',
        'X-Forwarded-Proto': 'https'
      };
      const prodJar = new CookieJar();
      const prodStart = await rawRequest(appUrl, '/api/auth?__route=google&mode=redirect&remember=1', {
        jar: prodJar,
        headers: prodHeaders
      });
      assert.strictEqual(prodStart.status, 302);
      const prodAuthUrl = new URL(prodStart.location);
      assert.strictEqual(
        prodAuthUrl.searchParams.get('redirect_uri'),
        'https://tradefourge.vercel.app/api/auth/callback',
        'Production redirect_uri must resolve to https://tradefourge.vercel.app/api/auth/callback'
      );
      assert.ok(prodJar.cookies.get('tf_oauth_tx').raw.includes('Secure'), 'Production tx cookie must have Secure attribute');

      const prodGoogle = await rawRequest(googleUrl, prodStart.location);
      const prodCbUrl = new URL(prodGoogle.location);
      assert.strictEqual(prodCbUrl.origin + prodCbUrl.pathname, 'https://tradefourge.vercel.app/api/auth/callback');

      const prodCbRes = await rawRequest(appUrl, `/api/auth?__route=callback&${prodCbUrl.searchParams.toString()}`, {
        jar: prodJar,
        headers: prodHeaders
      });
      assert.strictEqual(prodCbRes.status, 302);
      assert.strictEqual(prodCbRes.location, '/?auth=success');
      assert.ok(prodJar.cookies.get('tf_sess').raw.includes('Secure'), 'Production session cookie must have Secure attribute');

      const prodFolder = await rawRequest(appUrl, '/api/drive?__route=folder', {
        method: 'POST',
        jar: prodJar,
        headers: { ...prodHeaders, Origin: 'https://tradefourge.vercel.app' },
        body: {}
      });
      assert.strictEqual(prodFolder.status, 200);

      const prodLogout = await rawRequest(appUrl, '/api/auth?__route=logout', {
        method: 'POST',
        jar: prodJar,
        headers: { ...prodHeaders, Origin: 'https://tradefourge.vercel.app' },
        body: {}
      });
      assert.strictEqual(prodLogout.status, 200);
    } finally {
      process.env.GOOGLE_REDIRECT_URI = prevRedirectUri;
    }

    // Strategy-bot POST contract check via consolidated usage-store helper
    const strategyBotHandler = require(path.resolve(__dirname, '../api/strategy-bot'));
    let botStatus = 0;
    let botBody = null;
    const mockBotRes = {
      _headers: {},
      setHeader(k, v) { this._headers[k] = v; },
      status(code) { botStatus = code; return this; },
      json(obj) { botBody = obj; return this; },
      end() {}
    };
    await strategyBotHandler({ method: 'POST', body: { input: '' } }, mockBotRes);
    assert.strictEqual(botStatus, 400);
    assert.ok(botBody && botBody.error && botBody.error.message);
    console.log('✓ Test 10 passed\n');

    // TEST 11: Legacy `TradeForge` & `TradeFourge` Dual-Folder Bridging, Empty Shell Override & Legacy Backups
    console.log('[11/12] Testing legacy TradeForge + TradeFourge dual-folder search, fetch & backups...');
    const carolSub = 'sub_carol_legacy_3003';
    mockGoogle.state.nextUser = {
      sub: carolSub,
      email: 'carol.drive@gmail.com',
      name: 'Carol Drive',
      picture: 'https://example.com/carol.png',
      email_verified: true
    };
    const carolDrive = mockGoogle.getDriveStore(carolSub);
    carolDrive.set('c_old_root', {
      id: 'c_old_root',
      name: 'TradeForge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'root' },
      trashed: false,
      createdTime: '2026-07-01T00:00:00Z',
      modifiedTime: '2026-07-01T00:00:00Z'
    });
    carolDrive.set('c_old_ud', {
      id: 'c_old_ud',
      name: 'User Data',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['c_old_root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'user_data' },
      trashed: false,
      createdTime: '2026-07-01T00:00:01Z',
      modifiedTime: '2026-07-01T00:00:01Z'
    });
    carolDrive.set('c_old_bk_dir', {
      id: 'c_old_bk_dir',
      name: 'Backups',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['c_old_root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'backups' },
      trashed: false,
      createdTime: '2026-07-01T00:00:02Z',
      modifiedTime: '2026-07-01T00:00:02Z'
    });
    carolDrive.set('c_old_trades', {
      id: 'c_old_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['c_old_ud'],
      appProperties: { tradeforgeApp: 'true', tradeforgeDomain: 'trades' },
      trashed: false,
      createdTime: '2026-07-01T00:00:03Z',
      modifiedTime: '2026-07-01T00:00:03Z',
      _content: JSON.stringify({
        trades: [
          { ticket: 'TF_OLD_1', symbol: 'XAUUSD', profit: 420 },
          { ticket: 'TF_OLD_2', symbol: 'GBPUSD', profit: -50 }
        ]
      })
    });
    carolDrive.set('c_old_settings', {
      id: 'c_old_settings',
      name: 'settings.json',
      mimeType: 'application/json',
      parents: ['c_old_ud'],
      appProperties: { tradeforgeApp: 'true', tradeforgeDomain: 'settings' },
      trashed: false,
      createdTime: '2026-07-01T00:00:03Z',
      modifiedTime: '2026-07-01T00:00:03Z',
      _content: JSON.stringify({ currency: 'INR', startingCapital: 90000, notes: 'From old TradeForge folder' })
    });
    carolDrive.set('c_old_bk_file', {
      id: 'c_old_bk_file',
      name: 'tradeforge-backup-2026-07-01-manual.json',
      mimeType: 'application/json',
      parents: ['c_old_bk_dir'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'backup' },
      trashed: false,
      createdTime: '2026-07-01T00:05:00Z',
      modifiedTime: '2026-07-01T00:05:00Z',
      size: '300',
      _content: JSON.stringify({
        schemaVersion: '1.0.0',
        backupReason: 'manual',
        trades: { trades: [{ ticket: 'BK_OLD_1', symbol: 'EURUSD', profit: 88 }] },
        settings: { currency: 'USD', startingCapital: 12000 }
      })
    });

    // Empty post-rename TradeFourge/User Data/ shell created after login (simulates hosted bug!)
    carolDrive.set('c_new_root', {
      id: 'c_new_root',
      name: 'TradeFourge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'root' },
      trashed: false,
      createdTime: '2026-11-09T00:00:00Z',
      modifiedTime: '2026-11-09T00:00:00Z'
    });
    carolDrive.set('c_new_ud', {
      id: 'c_new_ud',
      name: 'User Data',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['c_new_root'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'user_data' },
      trashed: false,
      createdTime: '2026-11-09T00:00:01Z',
      modifiedTime: '2026-11-09T00:00:01Z'
    });
    carolDrive.set('c_new_bk', {
      id: 'c_new_bk',
      name: 'Backups',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['c_new_root'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'backups' },
      trashed: false,
      createdTime: '2026-11-09T00:00:02Z',
      modifiedTime: '2026-11-09T00:00:02Z'
    });
    carolDrive.set('c_new_exp', {
      id: 'c_new_exp',
      name: 'Exports',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['c_new_root'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'exports' },
      trashed: false,
      createdTime: '2026-11-09T00:00:03Z',
      modifiedTime: '2026-11-09T00:00:03Z'
    });
    carolDrive.set('c_new_trades', {
      id: 'c_new_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['c_new_ud'],
      appProperties: { tradefourgeApp: 'true', tradefourgeDomain: 'trades' },
      trashed: false,
      createdTime: '2026-11-09T00:00:04Z',
      modifiedTime: '2026-11-09T00:00:04Z',
      _content: JSON.stringify({ schemaVersion: '1.0.0', trades: [], deletedUids: [] })
    });
    carolDrive.set('c_new_meta', {
      id: 'c_new_meta',
      name: 'metadata.json',
      mimeType: 'application/json',
      parents: ['c_new_ud'],
      appProperties: { tradefourgeApp: 'true', tradefourgeDomain: 'metadata' },
      trashed: false,
      createdTime: '2026-11-09T00:00:04Z',
      modifiedTime: '2026-11-09T00:00:04Z',
      _content: JSON.stringify({
        appName: 'TradeFourge',
        revisions: { trades: 1, journal: 1, settings: 1 },
        counts: { trades: 0 }
      })
    });

    const carolJar = new CookieJar();
    await performFullOAuthLogin(appUrl, googleUrl, carolJar);

    const carolStatus = await rawRequest(appUrl, '/api/drive/status', { jar: carolJar });
    assert.strictEqual(carolStatus.status, 200);
    assert.strictEqual(carolStatus.json.legacyFolderDetected, true, 'Status must report legacy TradeForge folder presence');

    const carolMeta = await rawRequest(appUrl, '/api/drive/sync?mode=meta', { jar: carolJar });
    assert.strictEqual(carolMeta.status, 200);
    assert.strictEqual(carolMeta.json.legacyAvailable, true, 'Meta must advertise legacyAvailable when TradeFourge has 0 trades and TradeForge has data');

    const carolFull = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: carolJar });
    assert.strictEqual(carolFull.status, 200);
    assert.strictEqual(carolFull.json.legacySource, true);
    assert.strictEqual(carolFull.json.legacyRootName, 'TradeForge');
    assert.strictEqual(carolFull.json.trades.trades.length, 2);
    assert.strictEqual(carolFull.json.trades.trades[0].ticket, 'TF_OLD_1');
    assert.strictEqual(carolFull.json.journal.notes, 'From old TradeForge folder');
    assert.strictEqual(carolFull.json.settings.currency, 'INR');
    // File IDs must remain anchored to TradeFourge/User Data/, never pointing writes to TradeForge/
    assert.strictEqual(carolFull.json.fileIds.trades, 'c_new_trades');
    assert.strictEqual(carolFull.json.fileIds.metadata, 'c_new_meta');

    // Non-backup file in TradeForge/User Data/ must still fail with 403 FORBIDDEN on restore/delete
    const nonBackupRes = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: carolJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: 'c_old_trades' }
    });
    assert.strictEqual(nonBackupRes.status, 403, 'Non-backup file inside legacy User Data must still return 403 FORBIDDEN');

    // Legacy backups inside TradeForge/Backups/ must appear in listing & support restore + delete
    const carolBkList = await rawRequest(appUrl, '/api/drive/backups?limit=10', { jar: carolJar });
    assert.strictEqual(carolBkList.status, 200);
    assert.ok(carolBkList.json.backups.some((b) => b.id === 'c_old_bk_file'), 'Legacy TradeForge/Backups snapshot must appear in list');

    const carolBkRestore = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: carolJar,
      headers: { Origin: appUrl },
      body: { action: 'restore', fileId: 'c_old_bk_file', createSafetyBackupFirst: false }
    });
    assert.strictEqual(carolBkRestore.status, 200);
    assert.strictEqual(carolBkRestore.json.restoredTrades, 1);
    assert.strictEqual(carolBkRestore.json.restoredSnapshot.trades[0].ticket, 'BK_OLD_1');

    // Once TradeFourge/User Data/ is populated, populated TradeFourge takes precedence over older TradeForge
    const carolMetaAfter = await rawRequest(appUrl, '/api/drive/sync?mode=meta', { jar: carolJar });
    assert.strictEqual(carolMetaAfter.json.legacyAvailable, false, 'legacyAvailable becomes false once TradeFourge has trades');
    const carolFullAfter = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: carolJar });
    assert.strictEqual(carolFullAfter.json.legacySource, false);
    assert.strictEqual(carolFullAfter.json.trades.trades[0].ticket, 'BK_OLD_1');

    const carolBkDel = await rawRequest(appUrl, '/api/drive/backups', {
      method: 'POST',
      jar: carolJar,
      headers: { Origin: appUrl },
      body: { action: 'delete', fileId: 'c_old_bk_file' }
    });
    assert.strictEqual(carolBkDel.status, 200);
    assert.strictEqual(carolBkDel.json.deletedFileId, 'c_old_bk_file');
    console.log('✓ Test 11 passed\n');

    // TEST 12: Search-First Zero-Duplicate Folder Discovery, Cross-Worker Race Deduplication, TradeForge-Only & Moved Duplicate Folders
    console.log('[12/12] Testing search-first discovery, zero duplicate creation & cross-worker race dedup...');

    // 12A: Empty Drive (Dana) - Read-only GET endpoints & missing delete create ZERO folders
    const danaSub = 'sub_dana_search_4004';
    mockGoogle.state.nextUser = {
      sub: danaSub,
      email: 'dana.clean@gmail.com',
      name: 'Dana Clean',
      picture: 'https://example.com/dana.png',
      email_verified: true
    };
    const danaJar = new CookieJar();
    await performFullOAuthLogin(appUrl, googleUrl, danaJar);
    mockGoogle.state.driveFolderCreations = 0;

    const [danaStatus, danaMeta, danaFull, danaBackups, danaDelMissing] = await Promise.all([
      rawRequest(appUrl, '/api/drive/status', { jar: danaJar }),
      rawRequest(appUrl, '/api/drive/sync?mode=meta', { jar: danaJar }),
      rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: danaJar }),
      rawRequest(appUrl, '/api/drive/backups?limit=10', { jar: danaJar }),
      rawRequest(appUrl, '/api/drive/backups', {
        method: 'POST',
        jar: danaJar,
        headers: { Origin: appUrl },
        body: { action: 'delete', fileId: 'missing_bk_id' }
      })
    ]);
    assert.strictEqual(danaStatus.status, 200);
    assert.strictEqual(danaStatus.json.folderExists, false);
    assert.strictEqual(danaStatus.json.rootName, null);
    assert.strictEqual(danaStatus.json.folderIds, null);
    assert.strictEqual(danaMeta.status, 200);
    assert.strictEqual(danaMeta.json.folderExists, false);
    assert.strictEqual(danaMeta.json.folderIds, null);
    assert.strictEqual(danaMeta.json.legacyAvailable, false);
    assert.strictEqual(danaFull.status, 200);
    assert.strictEqual(danaFull.json.folderExists, false);
    assert.strictEqual(danaFull.json.exists, false);
    assert.strictEqual(danaFull.json.folderIds, null);
    assert.strictEqual(danaBackups.status, 200);
    assert.deepStrictEqual(danaBackups.json.backups, []);
    assert.strictEqual(danaDelMissing.status, 404);
    assert.strictEqual(mockGoogle.state.driveFolderCreations, 0, 'Read-only status/meta/full/backups on empty Drive must create 0 folders');
    assert.strictEqual(mockGoogle.getDriveStore(danaSub).size, 0, 'Dana Drive store must stay empty before first write');

    // Cross-worker concurrent folder creation race deduplication (distinct ownerSub lock keys bypass local mutex)
    const { ensureFolderStructure } = require(path.resolve(__dirname, '../api/_lib/drive'));
    let danaToken = null;
    for (const [tok, entry] of mockGoogle.state.accessTokens.entries()) {
      if (entry.user.sub === danaSub && !entry.expired) {
        danaToken = tok;
        break;
      }
    }
    assert.ok(danaToken, 'Dana mock access token must exist');
    const danaCtx = {
      endpoints: {
        driveApiUrl: process.env.TF_TEST_GOOGLE_DRIVE_API_URL,
        driveUploadUrl: process.env.TF_TEST_GOOGLE_DRIVE_UPLOAD_URL
      },
      getToken: async () => danaToken
    };
    const [raceResA, raceResB] = await Promise.all([
      ensureFolderStructure(danaCtx, 'worker_A'),
      ensureFolderStructure(danaCtx, 'worker_B')
    ]);
    assert.strictEqual(raceResA.folderIds.root, raceResB.folderIds.root, 'Racing workers must converge to 1 canonical TradeFourge root');
    assert.strictEqual(raceResA.folderIds.userData, raceResB.folderIds.userData, 'Racing workers must converge to 1 User Data folder');
    assert.strictEqual(raceResA.folderIds.backups, raceResB.folderIds.backups, 'Racing workers must converge to 1 Backups folder');
    assert.strictEqual(raceResA.folderIds.exports, raceResB.folderIds.exports, 'Racing workers must converge to 1 Exports folder');
    const danaStoreVals = Array.from(mockGoogle.getDriveStore(danaSub).values());
    assert.strictEqual(danaStoreVals.filter((f) => f.name === 'TradeFourge' && !f.trashed).length, 1);
    assert.strictEqual(danaStoreVals.filter((f) => f.name === 'User Data' && !f.trashed).length, 1);
    assert.strictEqual(danaStoreVals.filter((f) => f.name === 'Backups' && !f.trashed).length, 1);
    assert.strictEqual(danaStoreVals.filter((f) => f.name === 'Exports' && !f.trashed).length, 1);

    // 12B: TradeForge-only user (Evan) - reuses existing TradeForge in-place with ZERO TradeFourge folders created
    const evanSub = 'sub_evan_tradeforge_5005';
    mockGoogle.state.nextUser = {
      sub: evanSub,
      email: 'evan.legacy@gmail.com',
      name: 'Evan Legacy',
      picture: 'https://example.com/evan.png',
      email_verified: true
    };
    const evanDrive = mockGoogle.getDriveStore(evanSub);
    evanDrive.set('evan_root', {
      id: 'evan_root',
      name: 'TradeForge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'root' },
      trashed: false,
      createdTime: '2026-06-01T00:00:00Z',
      modifiedTime: '2026-06-01T00:00:00Z'
    });
    evanDrive.set('evan_ud', {
      id: 'evan_ud',
      name: 'User Data',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['evan_root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'user_data' },
      trashed: false,
      createdTime: '2026-06-01T00:00:01Z',
      modifiedTime: '2026-06-01T00:00:01Z'
    });
    evanDrive.set('evan_bk', {
      id: 'evan_bk',
      name: 'Backups',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['evan_root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'backups' },
      trashed: false,
      createdTime: '2026-06-01T00:00:02Z',
      modifiedTime: '2026-06-01T00:00:02Z'
    });
    evanDrive.set('evan_exp', {
      id: 'evan_exp',
      name: 'Exports',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['evan_root'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'exports' },
      trashed: false,
      createdTime: '2026-06-01T00:00:03Z',
      modifiedTime: '2026-06-01T00:00:03Z'
    });
    const evanTrades = [
      { ticket: 'EV_1', symbol: 'XAUUSD', type: 'buy', lots: 0.1, profit: 150, openTime: '2026-06-02T09:00:00Z', closeTime: '2026-06-02T10:00:00Z', broker: 'exness' },
      { ticket: 'EV_2', symbol: 'EURUSD', type: 'sell', lots: 0.2, profit: 75, openTime: '2026-06-03T09:00:00Z', closeTime: '2026-06-03T10:00:00Z', broker: 'exness' }
    ];
    evanDrive.set('evan_trades', {
      id: 'evan_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['evan_ud'],
      appProperties: { tradeforgeApp: 'true', tradeforgeDomain: 'trades' },
      trashed: false,
      createdTime: '2026-06-03T10:00:00Z',
      modifiedTime: '2026-06-03T10:00:00Z',
      _content: JSON.stringify({ schemaVersion: '1.0.0', trades: evanTrades, deletedUids: [] })
    });
    evanDrive.set('evan_settings', {
      id: 'evan_settings',
      name: 'settings.json',
      mimeType: 'application/json',
      parents: ['evan_ud'],
      appProperties: { tradeforgeApp: 'true', tradeforgeDomain: 'settings' },
      trashed: false,
      createdTime: '2026-06-03T10:00:00Z',
      modifiedTime: '2026-06-03T10:00:00Z',
      _content: JSON.stringify({ currency: 'INR', startingCapital: 60000 })
    });
    evanDrive.set('evan_meta', {
      id: 'evan_meta',
      name: 'metadata.json',
      mimeType: 'application/json',
      parents: ['evan_ud'],
      appProperties: { tradeforgeApp: 'true', tradeforgeDomain: 'metadata' },
      trashed: false,
      createdTime: '2026-06-03T10:00:00Z',
      modifiedTime: '2026-06-03T10:00:00Z',
      _content: JSON.stringify({ appName: 'TradeForge', revisions: { trades: 1, journal: 1, settings: 1 }, counts: { trades: 2 } })
    });
    evanDrive.set('evan_bk_1', {
      id: 'evan_bk_1',
      name: 'tradeforge-backup-2026-06-03-manual.json',
      mimeType: 'application/json',
      parents: ['evan_bk'],
      appProperties: { tradeforgeApp: 'true', tradeforgeRole: 'backup' },
      trashed: false,
      createdTime: '2026-06-03T10:05:00Z',
      modifiedTime: '2026-06-03T10:05:00Z',
      size: '250',
      _content: JSON.stringify({ trades: { trades: evanTrades } })
    });

    const evanJar = new CookieJar();
    await performFullOAuthLogin(appUrl, googleUrl, evanJar);
    mockGoogle.state.driveFolderCreations = 0;

    const evanStatus = await rawRequest(appUrl, '/api/drive/status', { jar: evanJar });
    assert.strictEqual(evanStatus.status, 200);
    assert.strictEqual(evanStatus.json.folderExists, true);
    assert.strictEqual(evanStatus.json.rootName, 'TradeForge');
    assert.strictEqual(evanStatus.json.folderIds.root, 'evan_root');

    const evanMeta = await rawRequest(appUrl, '/api/drive/sync?mode=meta', { jar: evanJar });
    assert.strictEqual(evanMeta.status, 200);
    assert.strictEqual(evanMeta.json.folderIds.root, 'evan_root');

    const evanFull = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: evanJar });
    assert.strictEqual(evanFull.status, 200);
    assert.strictEqual(evanFull.json.rootName, 'TradeForge');
    assert.strictEqual(evanFull.json.folderIds.root, 'evan_root');
    assert.strictEqual(evanFull.json.trades.trades.length, 2);
    assert.strictEqual(evanFull.json.settings.currency, 'INR');

    const evanBkList = await rawRequest(appUrl, '/api/drive/backups?limit=10', { jar: evanJar });
    assert.strictEqual(evanBkList.status, 200);
    assert.ok(evanBkList.json.backups.some((b) => b.id === 'evan_bk_1'));

    const evanPush = await rawRequest(appUrl, '/api/drive/sync', {
      method: 'POST',
      jar: evanJar,
      headers: { Origin: appUrl },
      body: {
        action: 'push',
        snapshot: {
          trades: [...evanTrades, { ticket: 'EV_3', symbol: 'GBPUSD', profit: 45, broker: 'exness' }],
          deletedUids: [],
          currency: 'INR',
          startingCapital: 60000
        },
        forceAllDomains: true,
        force: true
      }
    });
    assert.strictEqual(evanPush.status, 200);
    assert.strictEqual(evanPush.json.folderIds.root, 'evan_root', 'Push must reuse TradeForge root in-place');
    assert.strictEqual(mockGoogle.state.driveFolderCreations, 0, 'TradeForge-only user must incur 0 new folder creations');
    assert.ok(!Array.from(evanDrive.values()).some((f) => f.name === 'TradeFourge'), 'Must NEVER create duplicate TradeFourge folder');

    // 12C: Duplicate same-name TradeFourge folders (early empty shell + later moved untagged populated folder)
    const frankSub = 'sub_frank_dups_6006';
    mockGoogle.state.nextUser = {
      sub: frankSub,
      email: 'frank.dups@gmail.com',
      name: 'Frank Dups',
      picture: 'https://example.com/frank.png',
      email_verified: true
    };
    const frankDrive = mockGoogle.getDriveStore(frankSub);
    // Custom parent folder simulating user moving their real TradeFourge folder out of My Drive root
    frankDrive.set('f_custom_parent', {
      id: 'f_custom_parent',
      name: 'Trading Archive',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      trashed: false,
      createdTime: '2026-08-01T00:00:00Z',
      modifiedTime: '2026-08-01T00:00:00Z'
    });
    // Earlier empty TradeFourge shell at root
    frankDrive.set('f_empty_early', {
      id: 'f_empty_early',
      name: 'TradeFourge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'root' },
      trashed: false,
      createdTime: '2026-09-01T00:00:00Z',
      modifiedTime: '2026-09-01T00:00:00Z'
    });
    frankDrive.set('f_empty_early_ud', {
      id: 'f_empty_early_ud',
      name: 'User Data',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['f_empty_early'],
      appProperties: { tradefourgeApp: 'true', tradefourgeRole: 'user_data' },
      trashed: false,
      createdTime: '2026-09-01T00:00:01Z',
      modifiedTime: '2026-09-01T00:00:01Z'
    });
    frankDrive.set('f_empty_early_trades', {
      id: 'f_empty_early_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['f_empty_early_ud'],
      trashed: false,
      createdTime: '2026-09-01T00:00:02Z',
      modifiedTime: '2026-09-01T00:00:02Z',
      _content: JSON.stringify({ schemaVersion: '1.0.0', trades: [], deletedUids: [] })
    });
    // Later moved & untagged populated TradeFourge folder
    frankDrive.set('f_real_root', {
      id: 'f_real_root',
      name: 'TradeFourge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['f_custom_parent'],
      appProperties: {},
      trashed: false,
      createdTime: '2026-10-01T00:00:00Z',
      modifiedTime: '2026-10-01T00:00:00Z'
    });
    frankDrive.set('f_real_ud', {
      id: 'f_real_ud',
      name: 'User Data',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['f_real_root'],
      appProperties: {},
      trashed: false,
      createdTime: '2026-10-01T00:00:01Z',
      modifiedTime: '2026-10-01T00:00:01Z'
    });
    frankDrive.set('f_real_bk', {
      id: 'f_real_bk',
      name: 'Backups',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['f_real_root'],
      appProperties: {},
      trashed: false,
      createdTime: '2026-10-01T00:00:02Z',
      modifiedTime: '2026-10-01T00:00:02Z'
    });
    frankDrive.set('f_real_exp', {
      id: 'f_real_exp',
      name: 'Exports',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['f_real_root'],
      appProperties: {},
      trashed: false,
      createdTime: '2026-10-01T00:00:03Z',
      modifiedTime: '2026-10-01T00:00:03Z'
    });
    const frankTrades = [
      { ticket: 'FR_1', symbol: 'NAS100', type: 'buy', lots: 0.2, profit: 310, openTime: '2026-10-02T09:00:00Z', closeTime: '2026-10-02T10:00:00Z', broker: 'exness' },
      { ticket: 'FR_2', symbol: 'XAUUSD', type: 'sell', lots: 0.1, profit: 190, openTime: '2026-10-03T09:00:00Z', closeTime: '2026-10-03T10:00:00Z', broker: 'exness' }
    ];
    frankDrive.set('f_real_trades', {
      id: 'f_real_trades',
      name: 'trades.json',
      mimeType: 'application/json',
      parents: ['f_real_ud'],
      trashed: false,
      createdTime: '2026-10-03T10:00:00Z',
      modifiedTime: '2026-10-03T10:00:00Z',
      size: '500',
      _content: JSON.stringify({ schemaVersion: '1.0.0', trades: frankTrades, deletedUids: [] })
    });
    frankDrive.set('f_real_settings', {
      id: 'f_real_settings',
      name: 'settings.json',
      mimeType: 'application/json',
      parents: ['f_real_ud'],
      trashed: false,
      createdTime: '2026-10-03T10:00:00Z',
      modifiedTime: '2026-10-03T10:00:00Z',
      _content: JSON.stringify({ currency: 'INR', startingCapital: 120000 })
    });
    // Empty orphan #3 at root
    frankDrive.set('f_empty_orphan', {
      id: 'f_empty_orphan',
      name: 'TradeFourge',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      trashed: false,
      createdTime: '2026-11-01T00:00:00Z',
      modifiedTime: '2026-11-01T00:00:00Z'
    });

    const frankJar = new CookieJar();
    await performFullOAuthLogin(appUrl, googleUrl, frankJar);
    mockGoogle.state.driveFolderCreations = 0;

    const frankStatus = await rawRequest(appUrl, '/api/drive/status', { jar: frankJar });
    assert.strictEqual(frankStatus.status, 200);
    assert.strictEqual(frankStatus.json.folderIds.root, 'f_real_root', 'Must select moved populated folder over empty shells');
    assert.strictEqual(frankStatus.json.folderIds.userData, 'f_real_ud');

    const frankMetaStale = await rawRequest(
      appUrl,
      '/api/drive/sync?mode=meta&rootId=f_empty_early&userDataId=f_empty_early_ud',
      { jar: frankJar }
    );
    assert.strictEqual(frankMetaStale.status, 200);
    assert.strictEqual(frankMetaStale.json.folderIds.root, 'f_real_root', 'Must self-heal away from stale empty cachedFolderIds');

    const frankFull = await rawRequest(appUrl, '/api/drive/sync?mode=full', { jar: frankJar });
    assert.strictEqual(frankFull.status, 200);
    assert.strictEqual(frankFull.json.folderIds.root, 'f_real_root');
    assert.strictEqual(frankFull.json.trades.trades.length, 2);
    assert.strictEqual(frankFull.json.trades.trades[0].ticket, 'FR_1');
    assert.strictEqual(frankFull.json.settings.currency, 'INR');
    assert.strictEqual(frankFull.json.settings.startingCapital, 120000);

    const frankFolderPost = await rawRequest(appUrl, '/api/drive/folder', {
      method: 'POST',
      jar: frankJar,
      headers: { Origin: appUrl },
      body: { cachedFolderIds: { root: 'f_empty_early', userData: 'f_empty_early_ud' } }
    });
    assert.strictEqual(frankFolderPost.status, 200);
    assert.strictEqual(frankFolderPost.json.folderIds.root, 'f_real_root');
    assert.strictEqual(frankFolderPost.json.created, false);
    assert.strictEqual(mockGoogle.state.driveFolderCreations, 0, 'Duplicate disambiguation + reuse must create 0 new folders');

    console.log('✓ Test 12 passed\n');

    // TEST 13: Localhost dev-server parity (/api/strategy-bot HTTP POST stream parsing & /api/* hot-reload)
    console.log('[13/13] Testing localhost dev-server parity: /api/strategy-bot stream body & /api/* hot-reload...');
    const [botEmptyPostRes, botInvalidJsonRes, privRes, tosRes] = await Promise.all([
      rawRequest(appUrl, '/api/strategy-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { input: '' }
      }),
      new Promise((resolve, reject) => {
        const u = new URL('/api/strategy-bot', appUrl);
        const r = http.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (resp) => {
          const chunks = [];
          resp.on('data', (c) => chunks.push(c));
          resp.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: resp.statusCode, json: JSON.parse(text) });
          });
        });
        r.on('error', reject);
        r.write('{not valid json');
        r.end();
      }),
      rawRequest(appUrl, '/privacy-policy'),
      rawRequest(appUrl, '/terms-of-service')
    ]);
    assert.strictEqual(botEmptyPostRes.status, 400);
    assert.ok(
      botEmptyPostRes.json && botEmptyPostRes.json.error && botEmptyPostRes.json.error.message.includes('input'),
      'POST /api/strategy-bot over HTTP on dev-server must parse stream body cleanly'
    );
    assert.strictEqual(botInvalidJsonRes.status, 400);
    assert.ok(botInvalidJsonRes.json && botInvalidJsonRes.json.error && botInvalidJsonRes.json.error.message.includes('Invalid JSON'));
    assert.strictEqual(privRes.status, 200, 'Clean URL /privacy-policy must work locally');
    assert.strictEqual(tosRes.status, 200, 'Clean URL /terms-of-service must work locally');

    // Hot-reload verification in isolated temp workspace
    const tmpReloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-dev-hotreload-'));
    try {
      const tmpApiDir = path.join(tmpReloadDir, 'api');
      const tmpLibDir = path.join(tmpApiDir, '_lib');
      fs.mkdirSync(tmpLibDir, { recursive: true });
      const helperFile = path.join(tmpLibDir, 'helper.js');
      const routeFile = path.join(tmpApiDir, 'ping.js');
      fs.writeFileSync(helperFile, "module.exports = { ver: 'v1' };\n");
      fs.writeFileSync(
        routeFile,
        "const h = require('./_lib/helper');\nmodule.exports = async (req, res) => res.status(200).json({ ok: true, ver: h.ver });\n"
      );

      let reloadEvents = 0;
      const hotServer = createAppServer({
        rootDir: tmpReloadDir,
        reloadEnv: false,
        hotReloadApi: true,
        onApiReload: () => { reloadEvents++; }
      });
      await new Promise((resolve) => hotServer.listen(0, '127.0.0.1', resolve));
      const hotPort = hotServer.address().port;
      const hotUrl = `http://127.0.0.1:${hotPort}`;
      try {
        const resV1 = await rawRequest(hotUrl, '/api/ping');
        assert.strictEqual(resV1.status, 200);
        assert.strictEqual(resV1.json.ver, 'v1');
        assert.strictEqual(reloadEvents, 0);

        // Update nested api/_lib helper and advance mtime cleanly
        fs.writeFileSync(helperFile, "module.exports = { ver: 'v2-updated' };\n");
        const futureDate = new Date(Date.now() + 2000);
        fs.utimesSync(helperFile, futureDate, futureDate);

        const resV2 = await rawRequest(hotUrl, '/api/ping');
        assert.strictEqual(resV2.status, 200);
        assert.strictEqual(resV2.json.ver, 'v2-updated', 'dev-server must auto-reload updated /api/_lib modules without restart');
        assert.strictEqual(reloadEvents, 1);
      } finally {
        await new Promise((r) => hotServer.close(r));
      }
    } finally {
      fs.rmSync(tmpReloadDir, { recursive: true, force: true });
    }

    // Revoked JTI map persists on globalThis across module reloads
    const cryptoSess = require(path.resolve(__dirname, '../api/_lib/crypto-session'));
    cryptoSess.revokeSessionId('jti_hotreload_persist_test', Date.now() + 60000);
    delete require.cache[require.resolve(path.resolve(__dirname, '../api/_lib/crypto-session'))];
    const cryptoSessReloaded = require(path.resolve(__dirname, '../api/_lib/crypto-session'));
    assert.strictEqual(
      cryptoSessReloaded.isSessionRevoked('jti_hotreload_persist_test'),
      true,
      'Revoked session IDs must persist across hot-reloads'
    );
    console.log('✓ Test 13 passed\n');

    console.log('================================================================');
    console.log('ALL 13 BACKEND OAUTH + ENCRYPTED COOKIE + DRIVE API TESTS PASSED!');
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
