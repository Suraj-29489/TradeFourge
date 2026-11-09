/**
 * TradeFourge Backend - Environment & OAuth Configuration Loader
 *
 * Loads local `.env.local` variables (when not already populated by Vercel/Node)
 * and resolves Google OAuth 2.0 + session security settings strictly on the server.
 */

const fs = require('fs');
const path = require('path');

let _envLoaded = false;
const _fileLoadedKeys = globalThis.__tfFileLoadedEnvKeys instanceof Set
  ? globalThis.__tfFileLoadedEnvKeys
  : (globalThis.__tfFileLoadedEnvKeys = new Set());

function _cleanEnvValue(raw) {
  if (raw === undefined || raw === null) return '';
  const trimmed = String(raw).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function _isPlaceholder(key, val) {
  if (!val) return true;
  if (val.includes('YOUR_GEMINI_API_KEY') || val.includes('YOUR_GOOGLE_') || val.includes('REPLACE_WITH_')) {
    return true;
  }
  if (key === 'GOOGLE_CLIENT_ID' && val.startsWith('YOUR_')) return true;
  return false;
}

function loadLocalEnv(options = false) {
  const force = typeof options === 'object' && options !== null ? Boolean(options.force) : Boolean(options);
  const reloadFileKeys = typeof options === 'object' && options !== null ? Boolean(options.reloadFileKeys) : false;

  if (_envLoaded && !force) return;
  _envLoaded = true;

  const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';
  const baseDir = typeof __dirname !== 'undefined' ? __dirname : '.';
  const candidates = Array.from(new Set([
    path.resolve(cwd, '.env.local'),
    path.resolve(baseDir, '../../.env.local'),
    path.resolve(baseDir, '../../../.env.local'),
    path.resolve(cwd, '.env'),
    path.resolve(baseDir, '../../.env'),
    path.resolve(baseDir, '../../../.env')
  ]));

  const nextFileKeys = reloadFileKeys ? new Set() : null;

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = _cleanEnvValue(trimmed.slice(eqIdx + 1));
        if (!key) continue;
        const canSet =
          process.env[key] === undefined ||
          process.env[key] === '' ||
          (reloadFileKeys && _fileLoadedKeys.has(key));
        if (!_isPlaceholder(key, val) && canSet && !(nextFileKeys && nextFileKeys.has(key))) {
          process.env[key] = val;
          _fileLoadedKeys.add(key);
          if (nextFileKeys) nextFileKeys.add(key);
        }
      }
    } catch (e) {
      // Ignore read failures on read-only / restricted filesystems
    }
  }
}

function getRequestOrigin(req) {
  if (!req || !req.headers) return 'http://localhost:3000';
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = xfHost || String(req.headers.host || '').trim() || 'localhost:3000';

  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawHost);
  const proto = xfProto || (req.socket && req.socket.encrypted ? 'https' : (isLocalHost ? 'http' : 'https'));
  return `${proto}://${rawHost}`;
}

function isProductionEnv(req) {
  if (process.env.VERCEL_ENV === 'production') return true;
  if (process.env.NODE_ENV === 'production') return true;
  if (req && req.headers) {
    const origin = getRequestOrigin(req);
    if (origin.startsWith('https://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return true;
    }
  }
  return false;
}

function getGoogleEndpoints() {
  const allowOverrides = process.env.NODE_ENV === 'test' || process.env.TF_ALLOW_TEST_ENDPOINTS === '1';
  return {
    authUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_AUTH_URL) || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_TOKEN_URL) || 'https://oauth2.googleapis.com/token',
    userinfoUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_USERINFO_URL) || 'https://www.googleapis.com/oauth2/v3/userinfo',
    tokeninfoUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_TOKENINFO_URL) || 'https://oauth2.googleapis.com/tokeninfo',
    revokeUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_REVOKE_URL) || 'https://oauth2.googleapis.com/revoke',
    driveApiUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_DRIVE_API_URL) || 'https://www.googleapis.com/drive/v3/files',
    driveUploadUrl: (allowOverrides && process.env.TF_TEST_GOOGLE_DRIVE_UPLOAD_URL) || 'https://www.googleapis.com/upload/drive/v3/files'
  };
}

function getOAuthConfig(req) {
  loadLocalEnv();

  const origin = getRequestOrigin(req);
  const clientId = _cleanEnvValue(process.env.GOOGLE_CLIENT_ID || '');
  const clientSecret = _cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET || '');
  const explicitRedirect = _cleanEnvValue(process.env.GOOGLE_REDIRECT_URI || '');
  const sessionSecret = _cleanEnvValue(process.env.SESSION_SECRET || '');

  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const redirectUri = explicitRedirect || (isLocal ? `${origin}/api/auth/callback` : 'https://tradefourge.vercel.app/api/auth/callback');

  const isOAuthConfigured = Boolean(
    clientId &&
    clientId.length >= 12 &&
    !clientId.startsWith('YOUR_') &&
    clientSecret &&
    clientSecret.length >= 8 &&
    !clientSecret.startsWith('YOUR_')
  );

  const isSessionSecretValid = Boolean(sessionSecret && sessionSecret.length >= 32);

  return {
    origin,
    isLocal,
    isProduction: isProductionEnv(req),
    clientId,
    clientSecret,
    redirectUri,
    sessionSecret,
    isOAuthConfigured,
    isSessionSecretValid,
    isReady: isOAuthConfigured && isSessionSecretValid,
    scopes: 'openid email profile https://www.googleapis.com/auth/drive.file',
    requiredDriveScope: 'https://www.googleapis.com/auth/drive.file',
    endpoints: getGoogleEndpoints()
  };
}

module.exports = {
  loadLocalEnv,
  getRequestOrigin,
  isProductionEnv,
  getGoogleEndpoints,
  getOAuthConfig
};
