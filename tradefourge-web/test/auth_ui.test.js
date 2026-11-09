/**
 * TradeFourge - Authentication UI, Validation, Adapter & Session Verification Suite
 *
 * Compatible with macOS JavaScriptCore (`jsc test/auth_ui.test.js`) and Node.js.
 */

(function (global) {
  'use strict';

  const isNode = typeof require === 'function' && typeof process !== 'undefined' && process.versions && process.versions.node;
  const ROOT_PREFIX = isNode ? require('path').resolve(__dirname, '..') + '/' : '';

  // ==================== Portable Polyfills (for JSC) ====================
  if (typeof global.console === 'undefined') {
    const _print = typeof print === 'function' ? print : () => {};
    global.console = {
      log: (...args) => _print(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')),
      warn: (...args) => _print('[WARN]', ...args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))),
      error: (...args) => _print('[ERROR]', ...args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))))
    };
  }

  const _origSetTimeout = global.setTimeout;
  const _cancelledTimers = new Set();
  let _nextTimerId = 1;
  global.setTimeout = function (fn, delay = 0, ...args) {
    const id = _nextTimerId++;
    _origSetTimeout(() => {
      if (!_cancelledTimers.has(id)) {
        fn(...args);
      }
    }, Math.max(0, Number(delay) || 0));
    return id;
  };
  global.clearTimeout = function (id) {
    if (id !== undefined && id !== null) {
      _cancelledTimers.add(id);
    }
  };

  const assert = {
    ok(val, msg = 'Expected truthy value') {
      if (!val) throw new Error(`Assertion failed: ${msg} (got ${val})`);
    },
    strictEqual(actual, expected, msg = '') {
      if (actual !== expected) {
        throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }
  };

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem(k) { return map.has(k) ? map.get(k) : null; },
      setItem(k, v) { map.set(String(k), String(v)); },
      removeItem(k) { map.delete(String(k)); },
      clear() { map.clear(); },
      get length() { return map.size; },
      key(i) { return Array.from(map.keys())[i] || null; },
      dumpAll() {
        const out = {};
        for (const [k, v] of map.entries()) out[k] = v;
        return out;
      }
    };
  }

  if (typeof global.URLSearchParams === 'undefined') {
    global.URLSearchParams = class URLSearchParams {
      constructor(init = '') {
        this._pairs = [];
        const clean = String(init || '').replace(/^\?/, '');
        if (clean) {
          clean.split('&').forEach((part) => {
            if (!part) return;
            const eq = part.indexOf('=');
            const k = decodeURIComponent((eq >= 0 ? part.slice(0, eq) : part).replace(/\+/g, ' '));
            const v = decodeURIComponent((eq >= 0 ? part.slice(eq + 1) : '').replace(/\+/g, ' '));
            this._pairs.push([k, v]);
          });
        }
      }
      get(name) {
        const hit = this._pairs.find(([k]) => k === name);
        return hit ? hit[1] : null;
      }
      set(name, value) {
        const idx = this._pairs.findIndex(([k]) => k === name);
        if (idx >= 0) this._pairs[idx][1] = String(value);
        else this._pairs.push([String(name), String(value)]);
      }
      delete(name) {
        this._pairs = this._pairs.filter(([k]) => k !== name);
      }
      toString() {
        return this._pairs
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
      }
    };
  }

  global.localStorage = createMemoryStorage();
  global.sessionStorage = createMemoryStorage();
  Object.defineProperty(global, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true
  });
  global.location = { origin: 'http://localhost:3000', pathname: '/', search: '', hash: '' };
  global.history = {
    replaceState(_state, _title, nextUrl) {
      const str = String(nextUrl || '/');
      const hashIdx = str.indexOf('#');
      const beforeHash = hashIdx >= 0 ? str.slice(0, hashIdx) : str;
      const qIdx = beforeHash.indexOf('?');
      global.location.pathname = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
      global.location.search = qIdx >= 0 ? beforeHash.slice(qIdx) : '';
      global.location.hash = hashIdx >= 0 ? str.slice(hashIdx) : '';
    }
  };

  function loadModule(relPath) {
    if (isNode) {
      return require(ROOT_PREFIX + relPath);
    }
    if (typeof load === 'function') {
      load(relPath);
      return null;
    }
    throw new Error('Cannot load module in this runtime: ' + relPath);
  }

  loadModule('js/config.js');
  loadModule('js/storage.js');
  loadModule('js/google-auth.js');
  loadModule('js/auth.js');

  function resetAll() {
    global.localStorage.clear();
    global.sessionStorage.clear();
    global.navigator.onLine = true;
    global.location = { origin: 'http://localhost:3000', pathname: '/', search: '', hash: '' };
    global.TRADEFOURGE_CONFIG = {};
    global.TRADEFOURGE_LOCAL_CONFIG = {};
    TradeFourgeConfig.setServerOAuthConfigured(true);

    GoogleAuthManager._customFetch = null;
    GoogleAuthManager._customNavigate = null;
    GoogleAuthManager._checkSessionPromise = null;
    GoogleAuthManager.account = null;
    GoogleAuthManager.status = 'signed_out';
    GoogleAuthManager.driveConnected = false;
    GoogleAuthManager.driveScopeGranted = false;
    GoogleAuthManager.serverConfigured = true;
    GoogleAuthManager.rememberMe = true;
    GoogleAuthManager.expiresAt = 0;
    GoogleAuthManager.lastError = null;
    GoogleAuthManager._listeners = [];

    AuthServiceAdapter._customConfig = null;
    AuthServiceAdapter._customFetch = null;
    AuthServiceAdapter._simulatedDelayMs = 0;

    AuthSessionManager.user = null;
    AuthSessionManager.status = 'unauthenticated';
    AuthSessionManager.rememberMe = false;
    AuthSessionManager._listeners = [];
    AuthSessionManager._inFlightGooglePromise = null;
    if (AuthSessionManager._unsubGoogle) {
      AuthSessionManager._unsubGoogle();
      AuthSessionManager._unsubGoogle = null;
    }
  }

  function assertNoSecretsStored(forbiddenStrings = []) {
    const dumps = [
      JSON.stringify(global.localStorage.dumpAll()),
      JSON.stringify(global.sessionStorage.dumpAll())
    ];
    dumps.forEach((blob) => {
      assert.ok(!blob.includes('ya29.'), 'No OAuth access token should exist in web storage');
      assert.ok(!blob.includes('1//'), 'No OAuth refresh token should exist in web storage');
      assert.ok(!blob.includes('GOCSPX'), 'No OAuth client_secret should exist in web storage');
      forbiddenStrings.forEach((secret) => {
        if (secret) {
          assert.ok(!blob.includes(secret), `Secret value (${secret}) must NEVER be persisted in web storage`);
        }
      });
    });
  }

  const tests = [];
  function test(name, fn) {
    tests.push({ name, fn });
  }

  // -------------------- TEST CASES --------------------

  test('1. Login validation enforces email format and min 8-char password', () => {
    resetAll();
    const empty = AuthValidators.validateLoginForm({ email: '', password: '' });
    assert.strictEqual(empty.valid, false);
    assert.ok(empty.errors.email);
    assert.ok(empty.errors.password);

    const badEmails = ['plain', 'a@', 'a@b', 'a b@c.com', '.a@b.com', 'a..b@c.com', 'a@b.c'];
    badEmails.forEach((e) => {
      const r = AuthValidators.validateEmail(e);
      assert.strictEqual(r.valid, false, `Expected invalid email for ${e}`);
    });

    const shortPwd = AuthValidators.validateLoginForm({ email: 'trader@domain.com', password: '1234567' });
    assert.strictEqual(shortPwd.valid, false);
    assert.ok(shortPwd.errors.password.includes('8'));

    const valid = AuthValidators.validateLoginForm({ email: '  trader@domain.com ', password: 'StrongPassword9' });
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.values.email, 'trader@domain.com');
  });

  test('2. Register validation enforces name, email, >=8 pwd, matching confirm, and Terms checkbox', () => {
    resetAll();
    const missingAll = AuthValidators.validateRegisterForm({});
    assert.strictEqual(missingAll.valid, false);
    assert.ok(missingAll.errors.fullName);
    assert.ok(missingAll.errors.email);
    assert.ok(missingAll.errors.password);
    assert.ok(missingAll.errors.confirmPassword);
    assert.ok(missingAll.errors.acceptTerms);

    const mismatch = AuthValidators.validateRegisterForm({
      fullName: 'Alex Mercer',
      email: 'alex@trade.io',
      password: 'Password123',
      confirmPassword: 'Password124',
      acceptTerms: true
    });
    assert.strictEqual(mismatch.valid, false);
    assert.strictEqual(mismatch.errors.confirmPassword, 'Passwords do not match.');

    const noTerms = AuthValidators.validateRegisterForm({
      fullName: 'Alex Mercer',
      email: 'alex@trade.io',
      password: 'Password123',
      confirmPassword: 'Password123',
      acceptTerms: false
    });
    assert.strictEqual(noTerms.valid, false);
    assert.ok(noTerms.errors.acceptTerms);

    const ok = AuthValidators.validateRegisterForm({
      fullName: '  Alex Mercer  ',
      email: 'alex@trade.io',
      password: 'Password123',
      confirmPassword: 'Password123',
      acceptTerms: true
    });
    assert.strictEqual(ok.valid, true);
    assert.strictEqual(ok.values.fullName, 'Alex Mercer');
  });

  test('3. Unconfigured backend returns honest AUTH_BACKEND_REQUIRED and never stores passwords', async () => {
    resetAll();
    const secretPass = 'SuperSecretPass#99';

    const loginRes = await AuthServiceAdapter.loginWithEmail({
      email: 'alex@trade.io',
      password: secretPass,
      rememberMe: true
    });
    assert.strictEqual(loginRes.ok, false);
    assert.strictEqual(loginRes.code, 'AUTH_BACKEND_REQUIRED');
    assert.strictEqual(AuthSessionManager.isAuthenticated(), false);

    const regRes = await AuthServiceAdapter.registerWithEmail({
      fullName: 'Alex Mercer',
      email: 'alex@trade.io',
      password: secretPass,
      confirmPassword: secretPass,
      acceptTerms: true
    });
    assert.strictEqual(regRes.ok, false);
    assert.strictEqual(regRes.code, 'AUTH_BACKEND_REQUIRED');

    const forgotRes = await AuthServiceAdapter.requestPasswordReset({ email: 'alex@trade.io' });
    assert.strictEqual(forgotRes.ok, false);
    assert.strictEqual(forgotRes.code, 'AUTH_BACKEND_REQUIRED');

    assertNoSecretsStored([secretPass]);
  });

  test('4. Configured backend adapter posts JSON cleanly and handles 401 + 200 responses', async () => {
    resetAll();
    const calls = [];
    AuthServiceAdapter._customConfig = {
      enabled: true,
      baseUrl: '',
      endpoints: { login: '/api/auth/login', register: '/api/auth/register', forgotPassword: '/api/auth/forgot-password', logout: '/api/auth/logout' }
    };
    AuthServiceAdapter._customFetch = async (url, init) => {
      calls.push({ url, init });
      const body = JSON.parse(init.body);
      if (body.password === 'WrongPass123') {
        return {
          ok: false,
          status: 401,
          async json() { return { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }; }
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { user: { id: 'usr_101', name: 'Alex Mercer', email: body.email } };
        }
      };
    };

    const failRes = await AuthServiceAdapter.loginWithEmail({
      email: 'alex@trade.io',
      password: 'WrongPass123',
      rememberMe: false
    });
    assert.strictEqual(failRes.ok, false);
    assert.strictEqual(failRes.status === undefined, true);
    assert.strictEqual(failRes.code, 'INVALID_CREDENTIALS');

    const okRes = await AuthServiceAdapter.loginWithEmail({
      email: 'alex@trade.io',
      password: 'ValidPassword123',
      rememberMe: true
    });
    assert.strictEqual(okRes.ok, true);
    assert.strictEqual(okRes.user.provider, 'email');
    assert.strictEqual(okRes.user.email, 'alex@trade.io');
    assert.strictEqual(calls[0].init.credentials, 'include');
    assertNoSecretsStored(['WrongPass123', 'ValidPassword123']);
  });

  test('5. Server OAuth redirect flow, callback parsing, Remember Me persistence & Sign Out re-locking', async () => {
    resetAll();
    const navigatedUrls = [];
    const fetchLog = [];
    let serverSession = {
      configured: true,
      authenticated: false,
      status: 'unauthenticated',
      driveConnected: false,
      driveScopeGranted: false,
      rememberMe: false,
      user: null
    };

    GoogleAuthManager._customNavigate = (url) => {
      navigatedUrls.push(url);
      return true;
    };
    GoogleAuthManager._customFetch = async (url, init = {}) => {
      fetchLog.push({ url, method: init.method || 'GET', credentials: init.credentials });
      if (url.includes('/api/auth/logout')) {
        serverSession = {
          configured: true,
          authenticated: false,
          status: 'unauthenticated',
          driveConnected: false,
          driveScopeGranted: false,
          rememberMe: false,
          user: null
        };
        return {
          ok: true,
          status: 200,
          async json() { return { ok: true }; }
        };
      }
      return {
        ok: true,
        status: 200,
        async json() { return { ok: true, ...serverSession }; }
      };
    };

    const events = [];
    AuthSessionManager.subscribe((e) => events.push(e.eventType));
    AuthSessionManager.init();
    assert.strictEqual(AuthSessionManager.isAuthenticated(), false);

    // Trigger redirect OAuth flow with rememberMe = false (double call returns safely with redirected: true)
    const p1 = AuthSessionManager.signInWithGoogle({ selectAccount: true, rememberMe: false });
    const p2 = AuthSessionManager.signInWithGoogle({ selectAccount: true, rememberMe: false });
    assert.strictEqual(p1, p2, 'Double Google clicks must share the single in-flight promise');
    const r1 = await p1;
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.redirected, true);
    assert.strictEqual(navigatedUrls.length, 1);
    assert.ok(navigatedUrls[0].startsWith('/api/auth/google?'));
    assert.ok(navigatedUrls[0].includes('prompt=select_account'));
    assert.ok(navigatedUrls[0].includes('remember=0'));

    // Simulate returning from Google OAuth callback with ?auth=success
    global.location.search = '?auth=success';
    const cbOk = GoogleAuthManager.consumeCallbackParams();
    assert.strictEqual(cbOk.ok, true);
    assert.strictEqual(cbOk.callbackSuccess, true);
    assert.strictEqual(global.location.search, '', 'Callback query params must be stripped cleanly');

    // Simulate server returning authenticated cookie session (rememberMe: false -> sessionStorage only)
    serverSession = {
      configured: true,
      authenticated: true,
      status: 'authenticated',
      driveConnected: true,
      driveScopeGranted: true,
      rememberMe: false,
      expiresAt: Date.now() + 3600000,
      user: {
        sub: 'google-sub-777',
        email: 'trader.alex@gmail.com',
        name: 'Alex Mercer',
        picture: 'https://example.com/alex.png',
        emailVerified: true
      }
    };

    await AuthSessionManager.syncWithServerSession();
    assert.strictEqual(AuthSessionManager.isAuthenticated(), true);
    assert.strictEqual(AuthSessionManager.user.email, 'trader.alex@gmail.com');
    assert.ok(global.sessionStorage.getItem(AuthSessionManager.TEMP_SESSION_KEY));
    assert.strictEqual(global.localStorage.getItem(AuthSessionManager.SESSION_STORAGE_KEY), null);
    assert.ok(events.includes('session_unlocked'));
    assertNoSecretsStored();

    // Sign out -> calls /api/auth/logout, clears both storages and locks
    await AuthSessionManager.signOut({ clearGoogle: true });
    assert.ok(fetchLog.some((c) => c.url === '/api/auth/logout' && c.method === 'POST' && c.credentials === 'include'));
    assert.strictEqual(AuthSessionManager.isAuthenticated(), false);
    assert.strictEqual(global.sessionStorage.getItem(AuthSessionManager.TEMP_SESSION_KEY), null);
    assert.strictEqual(global.localStorage.getItem(AuthSessionManager.SESSION_STORAGE_KEY), null);
    assert.strictEqual(GoogleAuthManager.account, null);
    assert.ok(events.includes('session_locked'));

    // Simulate OAuth callback redirect with ?auth=success and rememberMe = true -> localStorage persistence
    serverSession = {
      configured: true,
      authenticated: true,
      status: 'authenticated',
      driveConnected: true,
      driveScopeGranted: true,
      rememberMe: true,
      expiresAt: Date.now() + 3600000,
      user: {
        sub: 'google-sub-777',
        email: 'trader.alex@gmail.com',
        name: 'Alex Mercer',
        picture: 'https://example.com/alex.png',
        emailVerified: true
      }
    };
    await AuthSessionManager.syncWithServerSession();
    assert.ok(global.localStorage.getItem(AuthSessionManager.SESSION_STORAGE_KEY));
    assert.strictEqual(global.sessionStorage.getItem(AuthSessionManager.TEMP_SESSION_KEY), null);
    assertNoSecretsStored();

    // Simulate cold reload before /api/auth/me resolves -> cached profile stays non-valid until verified
    GoogleAuthManager.account = null;
    GoogleAuthManager.status = 'signed_out';
    GoogleAuthManager.driveConnected = false;
    GoogleAuthManager.driveScopeGranted = false;
    const gState = GoogleAuthManager.init();
    assert.strictEqual(gState.hasValidToken, false, 'Authenticated server cookie flag must start false until verified');
    assert.strictEqual(gState.isSignedIn, true, 'Public Google profile preserved for offline banner / Drive namespace');

    AuthSessionManager.user = null;
    AuthSessionManager.status = 'unauthenticated';
    const reloadedState = AuthSessionManager.init();
    assert.strictEqual(reloadedState.isAuthenticated, true, 'Remembered user stays unlocked while offline');
    assert.strictEqual(reloadedState.user.email, 'trader.alex@gmail.com');

    // If server reports session cookie invalidated/revoked -> syncWithServerSession re-locks app cleanly
    serverSession = {
      configured: true,
      authenticated: false,
      status: 'unauthenticated',
      driveConnected: false,
      driveScopeGranted: false,
      rememberMe: false,
      user: null
    };
    const lockedState = await AuthSessionManager.syncWithServerSession();
    assert.strictEqual(lockedState.isAuthenticated, false, 'Revoked server cookie must re-lock Google session');
  });

  test('6. Returning Google profile without app session stays gated behind login screen and exposes shortcut', () => {
    resetAll();
    global.localStorage.setItem(
      GoogleAuthManager.ACCOUNT_STORAGE_KEY,
      JSON.stringify({
        sub: 'google-sub-999',
        email: 'returning@gmail.com',
        name: 'Returning Trader',
        picture: ''
      })
    );

    GoogleAuthManager.init();
    const state = AuthSessionManager.init();
    assert.strictEqual(state.isAuthenticated, false, 'App must remain gated until user signs in');
    assert.ok(state.returningGoogleAccount);
    assert.strictEqual(state.returningGoogleAccount.email, 'returning@gmail.com');
  });

  test('7. Callback error sanitization & unconfigured server rejection work safely', async () => {
    resetAll();
    global.location.search = '?auth_error=access_denied&foo=bar';
    const errCb = GoogleAuthManager.consumeCallbackParams();
    assert.strictEqual(errCb.ok, false);
    assert.strictEqual(errCb.errorCode, 'access_denied');
    assert.ok(errCb.message.toLowerCase().includes('cancelled'));
    assert.strictEqual(global.location.search, '?foo=bar', 'Unrelated query parameters preserved after cleanup');

    GoogleAuthManager._customFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { ok: true, configured: false, authenticated: false, status: 'unauthenticated', user: null };
      }
    });
    const st = await GoogleAuthManager.checkSession();
    assert.strictEqual(st.isConfigured, false);
    assert.strictEqual(TradeFourgeConfig.isGoogleAuthConfigured(), false);

    let thrown = null;
    try {
      await GoogleAuthManager.signIn();
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown && thrown.code === 'SERVER_NOT_CONFIGURED');
  });

  test('8. Failed /api/auth/logout rejects cleanly and preserves active session until logout succeeds', async () => {
    resetAll();
    let serverAuthenticated = true;
    let logoutBehavior = 'http_error';

    GoogleAuthManager._customFetch = async (url) => {
      if (url.includes('/api/auth/logout')) {
        if (logoutBehavior === 'network_error') {
          throw new Error('Network unreachable');
        }
        if (logoutBehavior === 'http_error') {
          return {
            ok: false,
            status: 500,
            async json() { return { ok: false, message: 'Failed to revoke server session.' }; }
          };
        }
        serverAuthenticated = false;
        return {
          ok: true,
          status: 200,
          async json() { return { ok: true }; }
        };
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            configured: true,
            authenticated: serverAuthenticated,
            status: serverAuthenticated ? 'authenticated' : 'unauthenticated',
            driveConnected: serverAuthenticated,
            driveScopeGranted: serverAuthenticated,
            rememberMe: true,
            expiresAt: Date.now() + 3600000,
            user: serverAuthenticated ? {
              sub: 'google-sub-888',
              email: 'trader.ops@gmail.com',
              name: 'Ops Trader',
              picture: 'https://example.com/ops.png',
              emailVerified: true
            } : null
          };
        }
      };
    };

    AuthSessionManager.init();
    await AuthSessionManager.syncWithServerSession();
    assert.strictEqual(AuthSessionManager.isAuthenticated(), true);
    assert.strictEqual(GoogleAuthManager.account.email, 'trader.ops@gmail.com');

    // HTTP 500 on logout must NOT clear client session or lock gate
    let err500 = null;
    try {
      await AuthSessionManager.signOut({ clearGoogle: true });
    } catch (err) {
      err500 = err;
    }
    assert.ok(err500 && err500.code === 'LOGOUT_FAILED');
    assert.strictEqual(AuthSessionManager.isAuthenticated(), true, 'Failed 500 logout must keep active session');
    assert.strictEqual(GoogleAuthManager.account.email, 'trader.ops@gmail.com');

    // Network rejection on logout must NOT clear client session
    logoutBehavior = 'network_error';
    let errNet = null;
    try {
      await AuthSessionManager.signOut({ clearGoogle: true });
    } catch (err) {
      errNet = err;
    }
    assert.ok(errNet && errNet.code === 'LOGOUT_FAILED');
    assert.strictEqual(AuthSessionManager.isAuthenticated(), true, 'Failed network logout must keep active session');

    // Succeeding logout cleans session and locks gate cleanly
    logoutBehavior = 'ok';
    await AuthSessionManager.signOut({ clearGoogle: true });
    assert.strictEqual(AuthSessionManager.isAuthenticated(), false);
    assert.strictEqual(GoogleAuthManager.account, null);
    assert.strictEqual(global.localStorage.getItem(AuthSessionManager.SESSION_STORAGE_KEY), null);
    assert.strictEqual(global.sessionStorage.getItem(AuthSessionManager.TEMP_SESSION_KEY), null);
  });

  // -------------------- RUNNER --------------------
  async function runAll() {
    let passed = 0;
    let failed = 0;
    for (const t of tests) {
      try {
        await t.fn();
        passed++;
        console.log(`PASS: ${t.name}`);
      } catch (err) {
        failed++;
        console.error(`FAIL: ${t.name} -> ${err && err.stack ? err.stack : err}`);
      }
    }
    console.log(`\nSummary: ${passed} passed, ${failed} failed (${tests.length} total).`);
    if (failed > 0) {
      if (isNode) {
        process.exitCode = 1;
      } else {
        setTimeout(() => {
          throw new Error(`${failed} test(s) failed`);
        }, 0);
      }
    }
  }

  runAll();
})(typeof globalThis !== 'undefined' ? globalThis : window);
