/**
 * TradeForge Local Development Server
 *
 * Serves static frontend assets AND Vercel-compatible `/api/*` serverless functions
 * on http://localhost:3000 (matching OAuth redirect URI http://localhost:3000/api/auth/callback).
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { loadLocalEnv, getOAuthConfig } = require('../api/_lib/env');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function augmentResponseForVercel(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    if (!res.headersSent) {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function (payload) {
    if (Buffer.isBuffer(payload) || typeof payload === 'string') {
      res.end(payload);
    } else if (payload === undefined || payload === null) {
      res.end();
    } else {
      if (!res.headersSent && !res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
    }
    return res;
  };
  return res;
}

function attachQueryObject(req, urlObj) {
  const q = {};
  for (const [k, v] of urlObj.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(q, k)) {
      if (Array.isArray(q[k])) q[k].push(v);
      else q[k] = [q[k], v];
    } else {
      q[k] = v;
    }
  }
  req.query = q;
}

function isProtectedPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return false;
  const parts = normalized.split('/');
  const first = parts[0];
  if (first === 'api' || first === 'scripts' || first === 'test' || first === 'node_modules' || first === 'scratch' || first === '.git' || first === '.vercel' || first === 'tradefourge-web') {
    return true;
  }
  return parts.some((p) => (
    p.startsWith('.env') ||
    p === 'package.json' ||
    p === 'package-lock.json' ||
    p.endsWith('.sh') ||
    p.endsWith('.command')
  ));
}

function resolveStaticFile(rootDir, pathname) {
  let cleanPath = '/';
  try {
    cleanPath = decodeURIComponent(pathname);
  } catch (e) {
    return null;
  }

  const rel = cleanPath.replace(/^\/+/, '');
  if (isProtectedPath(rel)) return null;

  const candidates = [];
  if (!rel || cleanPath.endsWith('/')) {
    candidates.push(path.join(rootDir, rel, 'index.html'));
  } else {
    const exact = path.resolve(rootDir, rel);
    candidates.push(exact);
    if (!path.extname(exact)) {
      candidates.push(exact + '.html');
      candidates.push(path.join(exact, 'index.html'));
    }
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
      continue;
    }
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        return resolved;
      }
    } catch (e) {
      // Check next candidate
    }
  }
  return null;
}

function createAppServer({ rootDir = path.resolve(__dirname, '..'), reloadEnv = true } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  if (reloadEnv) {
    loadLocalEnv();
  }

  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || 'localhost:3000';
      const urlObj = new URL(req.url || '/', `http://${host}`);
      const pathname = urlObj.pathname;

      if (pathname.startsWith('/api/')) {
        const apiRel = pathname.slice('/api/'.length).replace(/\/+$/, '');
        if (!apiRel || apiRel.startsWith('_') || apiRel.includes('..')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, code: 'NOT_FOUND', message: 'API route not found.' }));
          return;
        }

        const segments = apiRel.split('/').filter(Boolean);
        if (segments.some((s) => s.startsWith('_') || s.includes('..'))) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, code: 'NOT_FOUND', message: 'API route not found.' }));
          return;
        }

        const apiRoot = path.resolve(resolvedRoot, 'api');
        const directPath = path.resolve(resolvedRoot, 'api', ...segments) + '.js';
        let handlerPath = directPath;
        let rewrittenRoute = null;

        if (!directPath.startsWith(apiRoot + path.sep) || !fs.existsSync(directPath)) {
          if (segments.length === 2 && (segments[0] === 'auth' || segments[0] === 'drive')) {
            const routerPath = path.resolve(resolvedRoot, 'api', `${segments[0]}.js`);
            if (routerPath.startsWith(apiRoot + path.sep) && fs.existsSync(routerPath)) {
              handlerPath = routerPath;
              rewrittenRoute = segments[1];
            }
          }
        }

        if (!handlerPath.startsWith(apiRoot + path.sep) || !fs.existsSync(handlerPath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, code: 'NOT_FOUND', message: 'API route not found.' }));
          return;
        }

        attachQueryObject(req, urlObj);
        if (rewrittenRoute !== null) {
          req.query.__route = rewrittenRoute;
        }
        augmentResponseForVercel(res);

        const handler = require(handlerPath);
        await handler(req, res);
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Method Not Allowed');
        return;
      }

      const filePath = resolveStaticFile(resolvedRoot, pathname);
      if (!filePath) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (ext === '.html' || ext === '.js' || ext === '.css') {
        res.setHeader('Cache-Control', 'no-cache');
      }

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, code: 'SERVER_ERROR', message: 'Internal server error.' }));
      } else {
        res.end();
      }
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createAppServer({ reloadEnv: true });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n[TradeForge] Port ${port} is already in use.`);
      console.error(`Another local server may already be running at http://localhost:${port}`);
      console.error('Stop the other terminal window (Ctrl + C) and try again.\n');
      process.exit(1);
    }
    console.error('[TradeForge] Server failed to start:', err && err.message ? err.message : err);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const cfg = getOAuthConfig({ headers: { host: `localhost:${port}` } });
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim());

    console.log('\n==============================================================');
    console.log('  TradeForge Local Development Server');
    console.log('==============================================================');
    console.log(`  Open this URL in Chrome : http://localhost:${port}`);
    console.log(`  OAuth Callback URI      : http://localhost:${port}/api/auth/callback`);
    console.log('');
    console.log('  Google Cloud Console -> OAuth 2.0 Client ("TradeForge Web Client"):');
    console.log(`    Authorized JavaScript origin : http://localhost:${port}`);
    console.log(`    Authorized redirect URI      : http://localhost:${port}/api/auth/callback`);
    console.log('');
    console.log('  Local Config Status (.env.local):');
    console.log(`    SESSION_SECRET       : ${cfg.isSessionSecretValid ? 'Configured' : 'Missing or < 32 chars'}`);
    console.log(`    GOOGLE_CLIENT_ID     : ${cfg.clientId ? 'Configured' : 'Not set yet'}`);
    console.log(`    GOOGLE_CLIENT_SECRET : ${cfg.clientSecret ? 'Configured' : 'Not set yet'}`);
    console.log(`    GEMINI_API_KEY       : ${hasGemini ? 'Configured' : 'Not set (Offline AI still works)'}`);
    if (!cfg.isOAuthConfigured) {
      console.log('');
      console.log('  Tip: Add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET to .env.local');
      console.log('       to enable live Google Sign-In & Google Drive sync.');
    }
    console.log('');
    console.log('  Press Ctrl + C anytime to stop the server.');
    console.log('==============================================================\n');
  });

  const shutdown = (signal) => {
    console.log(`\n[TradeForge] Shutting down local server (${signal})...`);
    server.close(() => {
      console.log('[TradeForge] Local server stopped.');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = {
  createAppServer
};
