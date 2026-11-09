/**
 * TradeForge Backend - HTTP Request/Response Security & Cookie Utilities
 */

const { getRequestOrigin } = require('./env');

function applySecurityHeaders(res, { contentType = 'application/json; charset=utf-8' } = {}) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function sendJson(res, statusCode, payload) {
  applySecurityHeaders(res, { contentType: 'application/json; charset=utf-8' });
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location, statusCode = 302) {
  if (!res) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Location', location);
  res.statusCode = statusCode;
  res.end();
}

function escapeJsonForInlineScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sendPopupResultHtml(res, { ok, user = null, errorCode = '', errorMessage = '' }, statusCode = 200) {
  applySecurityHeaders(res, { contentType: 'text/html; charset=utf-8' });
  const payload = escapeJsonForInlineScript({
    type: 'tradeforge_oauth_result',
    ok: Boolean(ok),
    user: ok && user ? {
      sub: String(user.sub || ''),
      email: String(user.email || ''),
      name: String(user.name || ''),
      picture: String(user.picture || ''),
      emailVerified: Boolean(user.emailVerified)
    } : null,
    errorCode: errorCode || '',
    errorMessage: errorMessage || ''
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>TradeForge Authentication</title></head>
<body style="background:#0B1218;color:#E6ECEF;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;">
    <p id="statusMsg">Completing authentication...</p>
  </div>
  <script>
    (function () {
      var data = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, window.location.origin);
          window.close();
          return;
        }
      } catch (e) {}
      var target = new URL('/', window.location.origin);
      if (data.ok) {
        target.searchParams.set('auth', 'success');
      } else {
        target.searchParams.set('auth_error', data.errorCode || 'auth_failed');
        if (data.errorMessage) target.searchParams.set('auth_error_desc', data.errorMessage);
      }
      window.location.replace(target.toString());
    })();
  </script>
</body>
</html>`;

  res.statusCode = statusCode;
  res.end(html);
}

function isHttpsRequest(req) {
  if (!req || !req.headers) return false;
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (xfProto === 'https') return true;
  if (xfProto === 'http') return false;
  if (req.socket && req.socket.encrypted) return true;
  return process.env.VERCEL_ENV === 'production';
}

function parseCookies(req) {
  const out = {};
  const header = req && req.headers ? req.headers.cookie : '';
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(rawVal);
    } catch (e) {
      out[key] = rawVal;
    }
  }
  return out;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value || '')}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  else parts.push('SameSite=Lax');
  if (options.secure) parts.push('Secure');
  if (typeof options.maxAge === 'number' && Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
    if (options.maxAge === 0) {
      parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  }
  return parts.join('; ');
}

function appendSetCookie(res, cookieStr) {
  if (!res || !cookieStr) return;
  const existing = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : null;
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', existing.concat(cookieStr));
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

async function parseJsonBody(req, { maxBytes = 10 * 1024 * 1024 } = {}) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    const rawStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    if (!rawStr.trim()) return {};
    try {
      return JSON.parse(rawStr);
    } catch (e) {
      const err = new Error('Invalid JSON request payload.');
      err.code = 'INVALID_JSON';
      err.status = 400;
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    const fail = (status, code, message) => {
      if (settled) return;
      settled = true;
      const err = new Error(message);
      err.status = status;
      err.code = code;
      reject(err);
    };

    if (typeof req.on !== 'function') {
      resolve({});
      return;
    }

    req.on('data', (chunk) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        fail(413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds maximum allowed size.');
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (e) {
        const err = new Error('Invalid JSON request payload.');
        err.status = 400;
        err.code = 'INVALID_JSON';
        reject(err);
      }
    });

    req.on('error', (streamErr) => {
      fail(400, 'READ_ERROR', (streamErr && streamErr.message) || 'Failed to read request body.');
    });
  });
}

function getQueryParams(req) {
  const params = new URLSearchParams();
  if (req && req.url) {
    const qIdx = req.url.indexOf('?');
    if (qIdx !== -1) {
      const rawParams = new URLSearchParams(req.url.slice(qIdx + 1));
      for (const [k, v] of rawParams.entries()) {
        params.set(k, v);
      }
    }
  }
  if (req && req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (!params.has(k) && v !== undefined && v !== null) {
        params.set(k, Array.isArray(v) ? String(v[0]) : String(v));
      }
    }
  }
  return params;
}

function verifySameOriginMutation(req) {
  const originHeader = req && req.headers ? String(req.headers.origin || '').trim() : '';
  const refererHeader = req && req.headers ? String(req.headers.referer || '').trim() : '';
  const expectedOrigin = getRequestOrigin(req);

  const normalizeHost = (urlStr) => {
    try {
      return new URL(urlStr).host.toLowerCase();
    } catch (e) {
      return '';
    }
  };

  const expectedHost = normalizeHost(expectedOrigin);
  if (originHeader) {
    if (originHeader === 'null' || normalizeHost(originHeader) !== expectedHost) {
      return false;
    }
  }
  if (!originHeader && refererHeader) {
    if (normalizeHost(refererHeader) !== expectedHost) {
      return false;
    }
  }
  return true;
}

function sanitizeErrorForClient(err, fallbackMsg = 'An unexpected server error occurred.') {
  const status = (err && Number(err.status)) || 500;
  const code = (err && err.code) || 'INTERNAL_ERROR';
  let msg = (err && err.message) ? String(err.message) : fallbackMsg;
  msg = msg
    .replace(/GOCSPX-[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/ya29\.[0-9A-Za-z._-]+/g, '[REDACTED]')
    .replace(/1\/\/[0-9A-Za-z._-]+/g, '[REDACTED]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[REDACTED]')
    .replace(/bearer\s+[0-9A-Za-z._-]+/gi, 'Bearer [REDACTED]');
  return { status, code, message: msg };
}

module.exports = {
  applySecurityHeaders,
  sendJson,
  sendRedirect,
  sendPopupResultHtml,
  isHttpsRequest,
  parseCookies,
  serializeCookie,
  appendSetCookie,
  parseJsonBody,
  getQueryParams,
  verifySameOriginMutation,
  sanitizeErrorForClient
};
