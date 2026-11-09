/**
 * TradeFourge - Full-Stack Google OAuth + Server Session + Google Drive Cloud Sync Suite
 *
 * Exercises REAL frontend modules (`TradeFourgeConfig`, `StorageManager`, `GoogleAuthManager`,
 * `GoogleDriveStorage`, `CloudSyncManager`, `TradeAnalytics`, `MT5Manager`) wired directly over HTTP
 * to REAL `/api/*` Vercel serverless endpoints (`scripts/dev-server.js`) and an in-process
 * Mock Google OAuth 2.0 + Drive v3 HTTP server (`TF_ALLOW_TEST_ENDPOINTS=1`).
 */

'use strict';

const path = require('path');
const {
  createMockGoogleServer,
  CookieJar,
  rawRequest,
  performFullOAuthLogin
} = require('./backend_oauth_drive.test.js');
const { createAppServer } = require(path.resolve(__dirname, '../scripts/dev-server'));

const ROOT_PREFIX = path.resolve(__dirname, '..') + '/';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== Minimal Assertion Helper ====================
const assert = {
  ok(val, msg = 'Expected truthy value') {
    if (!val) throw new Error(`Assertion failed: ${msg} (got ${val})`);
  },
  strictEqual(actual, expected, msg = '') {
    if (actual !== expected) {
      throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  notStrictEqual(actual, unexpected, msg = '') {
    if (actual === unexpected) {
      throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — did not expect ${JSON.stringify(unexpected)}`);
    }
  },
  async rejects(fnOrPromise, codeOrMsg, msg = '') {
    let threw = null;
    try {
      await (typeof fnOrPromise === 'function' ? fnOrPromise() : fnOrPromise);
    } catch (err) {
      threw = err;
    }
    if (!threw) {
      throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected promise to reject`);
    }
    if (codeOrMsg && threw.code !== codeOrMsg && !String(threw.message || '').includes(codeOrMsg)) {
      throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected error code/message "${codeOrMsg}", got "${threw.code || threw.message}"`);
    }
    return threw;
  }
};

// ==================== Browser Globals Harness ====================
const _lsMap = new Map();
global.localStorage = {
  getItem(k) {
    return _lsMap.has(String(k)) ? _lsMap.get(String(k)) : null;
  },
  setItem(k, v) {
    _lsMap.set(String(k), String(v));
  },
  removeItem(k) {
    _lsMap.delete(String(k));
  },
  clear() {
    _lsMap.clear();
  },
  key(i) {
    return Array.from(_lsMap.keys())[i] ?? null;
  },
  get length() {
    return _lsMap.size;
  }
};

const _ssMap = new Map();
global.sessionStorage = {
  getItem(k) {
    return _ssMap.has(String(k)) ? _ssMap.get(String(k)) : null;
  },
  setItem(k, v) {
    _ssMap.set(String(k), String(v));
  },
  removeItem(k) {
    _ssMap.delete(String(k));
  },
  clear() {
    _ssMap.clear();
  },
  key(i) {
    return Array.from(_ssMap.keys())[i] ?? null;
  },
  get length() {
    return _ssMap.size;
  }
};

const _windowListeners = {};
global.window = global;
global.addEventListener = function (type, handler) {
  if (!_windowListeners[type]) _windowListeners[type] = [];
  _windowListeners[type].push(handler);
};
function dispatchWindowEvent(type, payload = {}) {
  const handlers = _windowListeners[type] || [];
  return Promise.all(handlers.map((h) => h(payload)));
}

let _isOnline = true;
Object.defineProperty(global, 'navigator', {
  value: {
    get onLine() {
      return _isOnline;
    }
  },
  configurable: true
});

global.location = {
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: ''
};
global.history = {
  replaceState(_state, _title, nextUrl) {
    const str = String(nextUrl || '/');
    const qIdx = str.indexOf('?');
    global.location.pathname = qIdx >= 0 ? str.slice(0, qIdx) : str;
    global.location.search = qIdx >= 0 ? str.slice(qIdx) : '';
  }
};

const _docAttrs = {};
global.document = {
  documentElement: {
    setAttribute(k, v) { _docAttrs[k] = String(v); },
    getAttribute(k) { return _docAttrs[k] ?? null; }
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; }
};

// Load frontend modules under Node harness
global.TRADEFOURGE_CONFIG = {};
require(ROOT_PREFIX + 'js/config.js');
require(ROOT_PREFIX + 'js/storage.js');
require(ROOT_PREFIX + 'js/theme.js');
require(ROOT_PREFIX + 'js/google-auth.js');
require(ROOT_PREFIX + 'js/google-drive.js');
require(ROOT_PREFIX + 'js/cloud-sync.js');
require(ROOT_PREFIX + 'js/parser.js');
require(ROOT_PREFIX + 'js/analytics.js');
require(ROOT_PREFIX + 'js/mt5.js');

// ==================== Main Test Suite ====================
async function runAllTests() {
  console.log('================================================================');
  console.log('STARTING FULL-STACK GOOGLE OAUTH + DRIVE CLOUD SYNC SUITE');
  console.log('================================================================\n');

  const mockGoogle = createMockGoogleServer();
  await new Promise((resolve) => mockGoogle.server.listen(0, '127.0.0.1', resolve));
  const gPort = mockGoogle.server.address().port;
  const googleUrl = `http://127.0.0.1:${gPort}`;

  const CLIENT_ID = '1234567890-testwebclient.apps.googleusercontent.com';
  const CLIENT_SECRET = 'GOCSPX-test-server-secret-value-9988';
  const SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
  process.env.GOOGLE_REDIRECT_URI = '';

  const appServer = createAppServer({ reloadEnv: false });
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  const aPort = appServer.address().port;
  const appUrl = `http://127.0.0.1:${aPort}`;
  process.env.GOOGLE_REDIRECT_URI = `${appUrl}/api/auth/callback`;

  let browserJar = new CookieJar();
  let lastNavigatedUrl = '';
  let forceNextClientNetworkError = false;
  const requestLog = [];

  async function browserFetchBridge(url, init = {}) {
    const method = String(init.method || 'GET').toUpperCase();
    requestLog.push(`${method} ${url}`);

    if (url.startsWith('/api/drive/') && forceNextClientNetworkError) {
      forceNextClientNetworkError = false;
      throw new Error('Simulated browser network failure');
    }

    const res = await rawRequest(appUrl, url, {
      method,
      jar: browserJar,
      headers: Object.assign(
        { Origin: appUrl },
        init.headers || {}
      ),
      body: init.body
    });

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      async text() {
        return res.text;
      },
      async json() {
        if (res.json !== null) return res.json;
        return JSON.parse(res.text);
      }
    };
  }

  GoogleAuthManager._customFetch = browserFetchBridge;
  GoogleDriveStorage._customFetch = browserFetchBridge;
  GoogleAuthManager._customNavigate = (url) => {
    lastNavigatedUrl = url;
    return true;
  };

  async function performBrowserOAuthRedirectFlow(startUrl) {
    const start = await rawRequest(appUrl, startUrl, { jar: browserJar });
    assert.strictEqual(start.status, 302, 'Server OAuth start must return 302 redirect');
    assert.ok(start.location.startsWith(googleUrl + '/o/oauth2/v2/auth'), 'Must redirect to Google Authorization URL');

    const gRes = await rawRequest(googleUrl, start.location);
    assert.strictEqual(gRes.status, 302, 'Google consent must redirect back to callback');
    assert.ok(gRes.location.startsWith(appUrl + '/api/auth/callback'), 'Must return to server callback');

    const cbRes = await rawRequest(appUrl, gRes.location, { jar: browserJar });
    assert.strictEqual(cbRes.status, 302, 'Callback must redirect back to app root');
    const qIdx = cbRes.location.indexOf('?');
    global.location.search = qIdx >= 0 ? cbRes.location.slice(qIdx) : '';
    return cbRes;
  }

  async function signInViaOAuth(options = {}, { reconnect = false } = {}) {
    lastNavigatedUrl = '';
    if (reconnect) {
      await GoogleAuthManager.reconnect(options);
    } else {
      await GoogleAuthManager.signIn(options);
    }
    assert.ok(lastNavigatedUrl, 'OAuth navigation URL must be generated');
    await performBrowserOAuthRedirectFlow(lastNavigatedUrl);
    const cb = GoogleAuthManager.consumeCallbackParams();
    if (cb && cb.ok === false) {
      const err = new Error(cb.message);
      err.code = String(cb.errorCode || 'AUTH_FAILED').toUpperCase();
      throw err;
    }
    const state = await GoogleAuthManager.checkSession();
    return { callback: cb, state };
  }

  function simulateBrowserReload({ preserveCookieJar = true } = {}) {
    if (!preserveCookieJar) {
      browserJar = new CookieJar();
    }
    global.location.search = '';
    GoogleAuthManager.account = null;
    GoogleAuthManager.status = 'signed_out';
    GoogleAuthManager.driveConnected = false;
    GoogleAuthManager.driveScopeGranted = false;
    GoogleAuthManager.expiresAt = 0;
    GoogleAuthManager.lastError = null;
    GoogleAuthManager._listeners = [];
    GoogleAuthManager._checkSessionPromise = null;

    CloudSyncManager._initialized = false;
    CloudSyncManager._listeners = [];
    CloudSyncManager.status = 'local_only';
    CloudSyncManager.folderIds = null;
    CloudSyncManager.pendingMigration = null;
    CloudSyncManager.lastSyncedAt = null;
    CloudSyncManager.lastConflicts = [];
    CloudSyncManager.lastError = null;
    CloudSyncManager._clearTimers();

    StorageManager._listeners = [];
    StorageManager.activeNamespace = 'anonymous';
    StorageManager.loadFromStorage();
  }

  function resetAllTestState() {
    _lsMap.clear();
    _ssMap.clear();
    _isOnline = true;
    forceNextClientNetworkError = false;
    requestLog.length = 0;
    mockGoogle.state.drivesBySub.clear();
    mockGoogle.state.accessTokens.clear();
    mockGoogle.state.refreshTokens.clear();
    mockGoogle.state.authCodes.clear();
    mockGoogle.state.revokedTokens.length = 0;
    mockGoogle.state.tokenRequests.length = 0;
    mockGoogle.state.forceNextDriveResponse = null;
    mockGoogle.state.forceRefreshResponse = null;
    mockGoogle.state.nextUser = {
      sub: 'sub_alice_1001',
      email: 'alice.trader@gmail.com',
      name: 'Alice Trader',
      picture: 'https://example.com/alice.png',
      email_verified: true
    };
    mockGoogle.state.nextOAuthBehavior = {
      error: null,
      grantDriveScope: true,
      issueRefreshToken: true,
      idTokenAudienceOverride: null,
      expiresIn: 3600
    };
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
    GoogleAuthManager.serverConfigured = true;
    TradeFourgeConfig.setServerOAuthConfigured(true);
    simulateBrowserReload({ preserveCookieJar: false });
  }

  try {
    // ------------------------------------------------------------------
    // TEST 1: LocalStorage Trade CRUD, Fingerprints, Deduplication & Tombstones
    // ------------------------------------------------------------------
    console.log('[1/10] Testing StorageManager CRUD, Fingerprints, Dedup & Tombstones...');
    resetAllTestState();
    await CloudSyncManager.init();

    const tExness = {
      ticket: 'EX_101',
      symbol: 'XAUUSD',
      type: 'buy',
      lots: 0.1,
      openPrice: 2650.0,
      closePrice: 2660.0,
      openTime: '2026-10-10T09:00:00Z',
      closeTime: '2026-10-10T10:00:00Z',
      profit: 100.0,
      broker: 'exness'
    };
    const tZup1 = {
      ticket: 'Not provided',
      symbol: 'EURUSD',
      type: 'sell',
      lots: 0.2,
      openPrice: 1.095,
      closePrice: 1.092,
      openTime: '2026-10-11T09:00:00Z',
      closeTime: '2026-10-11T10:00:00Z',
      profit: 60.0,
      broker: 'zuperior'
    };
    const tZup2 = {
      ticket: 'Not provided',
      symbol: 'GBPUSD',
      type: 'buy',
      lots: 0.15,
      openPrice: 1.28,
      closePrice: 1.278,
      openTime: '2026-10-11T11:00:00Z',
      closeTime: '2026-10-11T12:00:00Z',
      profit: -30.0,
      broker: 'zuperior'
    };

    StorageManager.saveTrades([tExness, tZup1, tZup2], 'initial.csv');
    assert.strictEqual(StorageManager.getTrades().length, 3, 'Should store 3 initial trades');

    const dupMergeRes = StorageManager.mergeTrades([tExness, tZup1], 'reimport.csv');
    assert.strictEqual(dupMergeRes.addedCount, 0, 'Duplicate CSV rows must be skipped');
    assert.strictEqual(dupMergeRes.total, 3);

    const origSyncKey = StorageManager.getTradeSyncKey(StorageManager.getTrades()[0]);
    StorageManager.updateTrade(StorageManager.getTrades()[0], { profit: 145.5, closeReason: 'tp' });
    const edited = StorageManager.getTrades()[0];
    assert.strictEqual(edited.profit, 145.5);
    assert.strictEqual(edited.syncId, origSyncKey, 'updateTrade must preserve immutable syncId');

    const zup1Stored = StorageManager.getTrades().find((t) => t.symbol === 'EURUSD');
    StorageManager.deleteTrade(zup1Stored);
    const afterDelete = StorageManager.getTrades();
    assert.strictEqual(afterDelete.length, 2, 'Only one Zuperior trade should be deleted');
    assert.ok(afterDelete.some((t) => t.symbol === 'GBPUSD'), 'Sibling Not provided trade must survive');
    assert.strictEqual(StorageManager.getDeletedUids().length, 1, 'Delete must record tombstone');
    console.log('✓ Test 1 passed\n');

    // ------------------------------------------------------------------
    // TEST 2: Server OAuth Security, Scope Checks, 401 Expiry & Zero Browser Secrets
    // ------------------------------------------------------------------
    console.log('[2/10] Testing Server OAuth Security, Scope Guard, 401 & Zero Token Exposure...');
    resetAllTestState();
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    await CloudSyncManager.init();
    assert.strictEqual(GoogleAuthManager.isConfigured(), false, '/api/auth/me reports unconfigured server');
    await assert.rejects(() => GoogleAuthManager.signIn(), 'SERVER_NOT_CONFIGURED');

    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
    await GoogleAuthManager.checkSession();
    assert.strictEqual(GoogleAuthManager.isConfigured(), true);

    // Scope denied -> callback rejects with DRIVE_SCOPE_DENIED and server revokes under-privileged token
    mockGoogle.state.nextOAuthBehavior.grantDriveScope = false;
    await assert.rejects(() => signInViaOAuth(), 'DRIVE_SCOPE_DENIED');
    assert.strictEqual(mockGoogle.state.revokedTokens.length, 1, 'Under-privileged token must be revoked');
    assert.strictEqual(browserJar.cookies.has('tf_sess'), false, 'No session cookie set on denied scope');
    assert.strictEqual(GoogleAuthManager.status, 'signed_out');

    // Valid sign-in via real OAuth -> HttpOnly cookie + /api/auth/me + Drive initialized
    mockGoogle.state.nextOAuthBehavior.grantDriveScope = true;
    await signInViaOAuth();
    assert.strictEqual(GoogleAuthManager.account.email, 'alice.trader@gmail.com');
    assert.strictEqual(GoogleAuthManager.hasValidToken(), true);
    assert.ok(browserJar.cookies.get('tf_sess').httpOnly, 'Session stored in HttpOnly cookie');

    // Ensure ZERO OAuth tokens or secrets ever appear in localStorage, sessionStorage, or GoogleAuthManager state
    const authStateJson = JSON.stringify(GoogleAuthManager.getState());
    assert.ok(!authStateJson.includes('ya29.') && !authStateJson.includes('mock_rt_') && !authStateJson.includes(CLIENT_SECRET));
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i));
      assert.ok(!val.includes('ya29.') && !val.includes('mock_rt_') && !val.includes(CLIENT_SECRET), 'No secrets in localStorage');
    }

    // Re-signing same Google sub updates profile without duplicating account index
    mockGoogle.state.nextUser.name = 'Alice Pro Trader';
    await signInViaOAuth();
    assert.strictEqual(GoogleAuthManager.getKnownAccounts().length, 1, 'Same sub must deduplicate cleanly');
    assert.strictEqual(GoogleAuthManager.getKnownAccounts()[0].name, 'Alice Pro Trader');

    // Simulated 401 from Drive + failed refresh -> backend returns 401 AUTH_EXPIRED -> GoogleAuthManager marks expired cleanly
    mockGoogle.state.forceNextDriveResponse = { status: 401, body: { error: { message: 'Invalid Credentials' } } };
    mockGoogle.state.forceRefreshResponse = { status: 400, body: { error: 'invalid_grant' } };
    await assert.rejects(() => GoogleDriveStorage.listBackups(null, 5), 'AUTH_EXPIRED');
    assert.strictEqual(GoogleAuthManager.status, 'expired');

    await GoogleAuthManager.signOut();
    assert.strictEqual(GoogleAuthManager.status, 'signed_out');
    assert.strictEqual(GoogleAuthManager.account, null);
    assert.strictEqual(browserJar.cookies.has('tf_sess'), false);
    console.log('✓ Test 2 passed\n');

    // ------------------------------------------------------------------
    // TEST 3: GoogleDriveStorage Idempotent Folder Hierarchy & 404 Self-Healing
    // ------------------------------------------------------------------
    console.log('[3/10] Testing GoogleDriveStorage Idempotent Folders & 404 Self-Healing...');
    resetAllTestState();
    await CloudSyncManager.init();
    await signInViaOAuth();
    await sleep(30);

    // Concurrent calls share the same root / User Data / Backups / Exports folders
    const [f1, f2] = await Promise.all([
      GoogleDriveStorage.ensureFolderStructure('sub_alice_1001'),
      GoogleDriveStorage.ensureFolderStructure('sub_alice_1001')
    ]);
    assert.strictEqual(f1.root, f2.root, 'Concurrent folder calls must share root folder ID');
    assert.strictEqual(f1.userData, f2.userData);
    assert.strictEqual(f1.backups, f2.backups);
    assert.strictEqual(f1.exports, f2.exports);

    // Fresh request without cached IDs discovers and reuses exact same folders
    const f3 = await GoogleDriveStorage.ensureFolderStructure('sub_alice_1001', {});
    assert.strictEqual(f3.root, f1.root, 'Subsequent discovery must reuse existing TradeFourge folder');

    const aliceDrive = mockGoogle.getDriveStore('sub_alice_1001');
    const rootFolders = Array.from(aliceDrive.values()).filter((x) => x.name === 'TradeFourge');
    assert.strictEqual(rootFolders.length, 1, 'Zero duplicate TradeFourge folders allowed');

    // Push initial data into User Data/ -> verifies trades.json ID reused in place
    const pushFirst = await GoogleDriveStorage.pushSnapshot({
      snapshot: { trades: [{ ticket: '1', symbol: 'XAUUSD', profit: 10 }], deletedUids: [], currency: 'USD' },
      forceAllDomains: true,
      force: true
    });
    const firstTradesId = pushFirst.fileIds.trades;
    assert.ok(firstTradesId);

    const pushSecond = await GoogleDriveStorage.pushSnapshot({
      snapshot: { trades: [{ ticket: '1', symbol: 'XAUUSD', profit: 10 }, { ticket: '2', symbol: 'EURUSD', profit: 20 }], deletedUids: [], currency: 'USD' },
      expectedRevisions: pushFirst.metadata.revisions,
      dirtyDomains: { trades: true, journal: false, settings: false }
    });
    assert.strictEqual(pushSecond.fileIds.trades, firstTradesId, 'Update must modify existing trades.json in place');

    // Simulate external deletion of trades.json from Drive -> push recovers cleanly by recreating file
    aliceDrive.delete(firstTradesId);
    const pushRecovered = await GoogleDriveStorage.pushSnapshot({
      snapshot: { trades: [{ ticket: '3', symbol: 'GBPUSD', profit: 30 }], deletedUids: [], currency: 'USD' },
      force: true
    });
    assert.notStrictEqual(pushRecovered.fileIds.trades, firstTradesId, 'Recovers from deleted remote file cleanly');
    console.log('✓ Test 3 passed\n');

    // ------------------------------------------------------------------
    // TEST 4: First Login Safe Migration (MIGRATE_LOCAL), Verification & Anonymous Preservation
    // ------------------------------------------------------------------
    console.log('[4/10] Testing First Login Migration (MIGRATE_LOCAL) & Anonymous Preservation...');
    resetAllTestState();
    await CloudSyncManager.init();

    const anonTrade1 = {
      ticket: 'ANON_1',
      symbol: 'XAUUSD',
      type: 'buy',
      lots: 0.1,
      openTime: '2026-10-12T08:00:00Z',
      closeTime: '2026-10-12T09:00:00Z',
      profit: 120.5,
      broker: 'exness'
    };
    const anonTrade2 = {
      ticket: 'ANON_2',
      symbol: 'BTCUSD',
      type: 'sell',
      lots: 0.05,
      openTime: '2026-10-12T10:00:00Z',
      closeTime: '2026-10-12T11:00:00Z',
      profit: -40.0,
      broker: 'exness'
    };
    StorageManager.saveTrades([anonTrade1, anonTrade2], 'anon.csv');
    StorageManager.saveNotes('Never trade NFP news spikes');
    TradeAnalytics.setCurrency('INR');
    TradeAnalytics.setStartingCapital(50000);
    MT5Manager.isConnected = true;
    MT5Manager.accountData = { server: 'Exness-MT5Real', login: '991122', balance: 50080.5 };
    MT5Manager.saveSession();

    let migEvent = null;
    CloudSyncManager.subscribe((ev) => {
      if (ev.eventType === 'migration_required') migEvent = ev.detail;
    });
    await signInViaOAuth();
    await sleep(40);

    assert.strictEqual(CloudSyncManager.status, 'migration_pending', 'Must wait for user migration choice');
    assert.ok(migEvent && migEvent.scenario === 'MIGRATE_LOCAL', 'Must detect MIGRATE_LOCAL scenario');
    assert.strictEqual(CloudSyncManager.pendingMigration.stats.localTradeCount, 2);

    const migResult = await CloudSyncManager.resolveMigration('migrate_local');
    assert.strictEqual(migResult.verified, true, 'Migration must verify uploaded count from Drive');
    assert.strictEqual(migResult.tradeCount, 2);
    assert.strictEqual(CloudSyncManager.status, 'synced');

    // Verify physical User Data/ files exist inside Alice's Google Drive
    const aliceStoreT4 = mockGoogle.getDriveStore('sub_alice_1001');
    const udFilesT4 = Array.from(aliceStoreT4.values())
      .filter((f) => f.parents && f.parents.includes(CloudSyncManager.folderIds.userData))
      .map((f) => f.name)
      .sort();
    assert.strictEqual(JSON.stringify(udFilesT4), JSON.stringify(['journal.json', 'metadata.json', 'settings.json', 'trades.json']));

    // Anonymous local data MUST remain 100% untouched!
    const anonAfterMig = StorageManager.getAnonymousSnapshot();
    assert.strictEqual(anonAfterMig.trades.length, 2, 'Anonymous trades must never be deleted after migration');
    assert.strictEqual(anonAfterMig.notes, 'Never trade NFP news spikes');
    assert.strictEqual(anonAfterMig.currency, 'INR');
    console.log('✓ Test 4 passed\n');

    // ------------------------------------------------------------------
    // TEST 5: Multi-Device Load, Edit, Delete Tombstones, Auto-Sync Debounce & CSV Dedup
    // ------------------------------------------------------------------
    console.log('[5/10] Testing Edits, Deletions, Debounced Auto-Sync & Cross-Device Restore...');
    const activeAliceTrades = StorageManager.getTrades();
    const targetEdit = activeAliceTrades.find((t) => t.ticket === 'ANON_1');
    const targetDel = activeAliceTrades.find((t) => t.ticket === 'ANON_2');
    StorageManager.updateTrade(targetEdit, { profit: 250.75 });
    StorageManager.deleteTrade(targetDel);
    StorageManager.mergeTrades([{
      ticket: 'NEW_3',
      symbol: 'ETHUSD',
      type: 'buy',
      lots: 0.25,
      openTime: '2026-10-13T08:00:00Z',
      closeTime: '2026-10-13T09:00:00Z',
      profit: 85.0,
      broker: 'exness'
    }], 'device1_add.csv');
    StorageManager.saveNotes('Updated journal rule: wait 15m candle close');

    await sleep(1450);
    assert.strictEqual(CloudSyncManager.status, 'synced', 'Debounced auto-sync must complete cleanly');
    assert.strictEqual(CloudSyncManager.getState().hasDirtyChanges, false);

    // Simulate clean Device 2 (empty localStorage + new CookieJar, same Google Drive!)
    _lsMap.clear();
    _ssMap.clear();
    simulateBrowserReload({ preserveCookieJar: false });
    await CloudSyncManager.init();
    assert.strictEqual(StorageManager.getTrades().length, 0, 'Device 2 starts completely empty');

    await signInViaOAuth();
    await sleep(50);
    assert.strictEqual(CloudSyncManager.status, 'synced', 'Device 2 auto-loads remote User Data/');

    const device2Trades = StorageManager.getTrades();
    assert.strictEqual(device2Trades.length, 2, 'Device 2 must have 2 active trades (edited ANON_1 + NEW_3, NOT deleted ANON_2)');
    assert.strictEqual(device2Trades.find((t) => t.ticket === 'ANON_1').profit, 250.75, 'Device 2 must receive edited profit');
    assert.ok(!device2Trades.some((t) => t.ticket === 'ANON_2'), 'Deleted trade must stay deleted across devices');
    assert.strictEqual(StorageManager.getNotes(), 'Updated journal rule: wait 15m candle close');
    assert.strictEqual(StorageManager.getCurrency(), 'INR');
    assert.strictEqual(StorageManager.getStartingCapital(), 50000);
    assert.strictEqual(StorageManager.getMt5Session().isConnected, true);
    assert.strictEqual(StorageManager.getMt5Session().accountData.login, '991122');

    const reimportOnD2 = StorageManager.mergeTrades([{
      ticket: 'NEW_3',
      symbol: 'ETHUSD',
      type: 'buy',
      lots: 0.25,
      openTime: '2026-10-13T08:00:00Z',
      closeTime: '2026-10-13T09:00:00Z',
      profit: 85.0,
      broker: 'exness'
    }], 'reimport_d2.csv');
    assert.strictEqual(reimportOnD2.addedCount, 0, 'Duplicate prevention works on restored cloud trades');
    console.log('✓ Test 5 passed\n');

    // ------------------------------------------------------------------
    // TEST 6: Offline Queueing, Concurrent Multi-Device Conflict & Pre-Overwrite Backup
    // ------------------------------------------------------------------
    console.log('[6/10] Testing Offline Mode, Concurrent Multi-Device Conflict & Safety Backups...');
    _isOnline = false;
    await dispatchWindowEvent('offline');
    assert.strictEqual(CloudSyncManager.status, 'offline');

    StorageManager.addTrade({
      ticket: 'OFFLINE_D2',
      symbol: 'USDJPY',
      type: 'buy',
      lots: 0.1,
      openTime: '2026-10-14T01:00:00Z',
      closeTime: '2026-10-14T02:00:00Z',
      profit: 44.0,
      broker: 'exness',
      updatedAt: '2026-11-09T10:00:05.000Z'
    });
    const anon1Local = StorageManager.getTrades().find((t) => t.ticket === 'ANON_1');
    StorageManager.updateTrade(anon1Local, { profit: 999.0 });
    assert.strictEqual(CloudSyncManager.getState().hasDirtyChanges, true);

    // Mutate Alice's remote User Data/ directly (simulating another device pushing while Device 2 was offline)
    const aliceFolderIds = CloudSyncManager.folderIds;
    const aliceStoreT6 = mockGoogle.getDriveStore('sub_alice_1001');
    const filesT6 = Array.from(aliceStoreT6.values());
    const metaRec = filesT6.find((f) => f.name === 'metadata.json' && f.parents.includes(aliceFolderIds.userData));
    const tradesRec = filesT6.find((f) => f.name === 'trades.json' && f.parents.includes(aliceFolderIds.userData));

    const remoteMetaObj = JSON.parse(metaRec._content);
    const remoteTradesObj = JSON.parse(tradesRec._content);
    const rAnon1 = remoteTradesObj.trades.find((t) => t.ticket === 'ANON_1');
    rAnon1.profit = 777.0;
    rAnon1.updatedAt = '2020-01-01T00:00:00.000Z';
    remoteTradesObj.trades.push({
      ticket: 'REMOTE_D1',
      symbol: 'NAS100',
      type: 'sell',
      lots: 0.3,
      openTime: '2026-10-14T03:00:00Z',
      closeTime: '2026-10-14T04:00:00Z',
      profit: 310.0,
      broker: 'exness',
      syncId: 'EXNESS_REMOTE_D1_2026-10-14T04:00:00Z_0.3_310',
      updatedAt: new Date().toISOString()
    });
    tradesRec._content = JSON.stringify(remoteTradesObj, null, 2);
    remoteMetaObj.revisions.trades = (remoteMetaObj.revisions.trades || 1) + 1;
    metaRec._content = JSON.stringify(remoteMetaObj, null, 2);

    _isOnline = true;
    await dispatchWindowEvent('online');
    await sleep(80);

    assert.strictEqual(CloudSyncManager.status, 'synced', 'Conflict must merge and sync cleanly');
    const mergedTrades = StorageManager.getTrades();
    assert.strictEqual(mergedTrades.length, 4, 'Merged must preserve ANON_1, NEW_3, OFFLINE_D2, and REMOTE_D1');
    assert.strictEqual(mergedTrades.find((t) => t.ticket === 'ANON_1').profit, 999.0, 'Newer local edit wins conflict deterministically');
    assert.strictEqual(CloudSyncManager.lastConflicts.length, 1, 'Conflict event recorded');

    const conflictBackups = await CloudSyncManager.listCloudBackups(10);
    assert.ok(conflictBackups.some((b) => b.name.includes('conflict-backup')), 'Pre-conflict backup must exist in Backups/');
    console.log('✓ Test 6 passed\n');

    // ------------------------------------------------------------------
    // TEST 7: Manual Cloud Backup, Page Reload Auth Expiry, Reconnect & Backup Restore
    // ------------------------------------------------------------------
    console.log('[7/10] Testing Manual Backups, Reload Auth Expiry & Backup Restore...');
    const manualBk = await CloudSyncManager.createManualBackup('before-experiment');
    assert.ok(manualBk && manualBk.name.includes('before-experiment'));

    StorageManager.addTrade({
      ticket: 'TEMP_MISTAKE',
      symbol: 'XAGUSD',
      type: 'buy',
      lots: 0.5,
      openTime: '2026-10-15T08:00:00Z',
      closeTime: '2026-10-15T09:00:00Z',
      profit: -500.0,
      broker: 'exness'
    });
    await CloudSyncManager.syncNow({ reason: 'push_mistake' });
    assert.strictEqual(StorageManager.getTrades().length, 5);

    // Issue a short-lived cookie entering the refresh window (expires_in=60 -> expiresAt=now), then revoke refresh grant before reload
    mockGoogle.state.nextOAuthBehavior.expiresIn = 60;
    await performBrowserOAuthRedirectFlow('/api/auth/google?remember=1');
    mockGoogle.state.nextOAuthBehavior.expiresIn = 3600;
    mockGoogle.state.forceRefreshResponse = { status: 400, body: { error: 'invalid_grant' } };

    // Simulate reload: /api/auth/me detects expired token & invalid_grant -> returns status: 'expired' with expiredUser
    simulateBrowserReload({ preserveCookieJar: true });
    await CloudSyncManager.init();
    assert.strictEqual(CloudSyncManager.status, 'auth_expired', 'Reload keeps isolated account in auth_expired until reconnect');
    assert.strictEqual(StorageManager.getTrades().length, 5, 'Reload preserves isolated offline cache');

    // Reconnect through /api/drive/authorize and restore from `before-experiment` backup
    await signInViaOAuth({ selectAccount: false }, { reconnect: true });
    await sleep(60);
    assert.strictEqual(CloudSyncManager.status, 'synced');

    const restoreRes = await CloudSyncManager.restoreFromBackupFileId(manualBk.id);
    assert.strictEqual(restoreRes.restoredTrades, 4, 'Restore from backup must bring back 4 pre-mistake trades');
    assert.strictEqual(StorageManager.getTrades().length, 4);

    const updatedBackups = await CloudSyncManager.listCloudBackups(10);
    assert.ok(updatedBackups.some((b) => b.name.includes('pre-backup-restore')), 'Restore must create safety backup first');
    console.log('✓ Test 7 passed\n');

    // ------------------------------------------------------------------
    // TEST 8: Strict Multi-Account Isolation (Alice vs Bob vs Anonymous) & Exports/
    // ------------------------------------------------------------------
    console.log('[8/10] Testing Strict Multi-Account Isolation & Exports/ Storage...');
    // Test saveCloudExport writes into Alice's TradeFourge / Exports/
    const exportSave = await CloudSyncManager.saveCloudExport({
      fileName: 'alice-oct-trades.json',
      content: JSON.stringify(StorageManager.getTrades()),
      mimeType: 'application/json'
    });
    assert.strictEqual(exportSave.ok, true);
    assert.strictEqual(exportSave.file.name, 'alice-oct-trades.json');

    // Switch directly to Bob via server OAuth
    mockGoogle.state.nextUser = {
      sub: 'sub_bob_2002',
      email: 'bob.fx@gmail.com',
      name: 'Bob FX',
      picture: 'https://example.com/bob.png',
      email_verified: true
    };
    await signInViaOAuth({ selectAccount: true });
    await sleep(50);

    assert.strictEqual(CloudSyncManager.status, 'synced', 'Bob initializes empty isolated workspace');
    assert.strictEqual(StorageManager.getTrades().length, 0, 'Bob must NEVER see Alice trades!');
    assert.notStrictEqual(CloudSyncManager.folderIds.root, aliceFolderIds.root, 'Bob has separate Drive folder tree');

    StorageManager.addTrade({
      ticket: 'BOB_1',
      symbol: 'US30',
      type: 'sell',
      lots: 0.2,
      openTime: '2026-10-16T08:00:00Z',
      closeTime: '2026-10-16T09:00:00Z',
      profit: 620.0,
      broker: 'exness'
    });
    await CloudSyncManager.syncNow({ reason: 'bob_trade' });
    assert.strictEqual(StorageManager.getTrades().length, 1);

    await GoogleAuthManager.signOut();
    await sleep(30);
    assert.strictEqual(CloudSyncManager.status, 'local_only');
    assert.strictEqual(StorageManager.getActiveNamespace(), 'anonymous');
    assert.strictEqual(StorageManager.getTrades().length, 0, 'Sign out must not leak Bob trades into anonymous');

    // Switch back to Alice -> sees Alice's exact 4 trades and zero Bob trades!
    mockGoogle.state.nextUser = {
      sub: 'sub_alice_1001',
      email: 'alice.trader@gmail.com',
      name: 'Alice Trader',
      picture: 'https://example.com/alice.png',
      email_verified: true
    };
    await signInViaOAuth({ selectAccount: true });
    await sleep(60);
    assert.strictEqual(StorageManager.getTrades().length, 4, 'Alice restores her own 4 trades cleanly');
    assert.ok(!StorageManager.getTrades().some((t) => t.symbol === 'US30'), 'Alice must NEVER see Bob trades');
    console.log('✓ Test 8 passed\n');

    // ------------------------------------------------------------------
    // TEST 9: MERGE_OR_CHOOSE Scenario + Duplicate-Free Merge + Safety Backup
    // ------------------------------------------------------------------
    console.log('[9/10] Testing MERGE_OR_CHOOSE Duplicate-Free Merge & Pre-Merge Safety Backup...');
    await GoogleAuthManager.signOut();
    await sleep(30);

    StorageManager.saveTrades([
      {
        ticket: 'NEW_3',
        symbol: 'ETHUSD',
        type: 'buy',
        lots: 0.25,
        openTime: '2026-10-13T08:00:00Z',
        closeTime: '2026-10-13T09:00:00Z',
        profit: 85.0,
        broker: 'exness'
      },
      {
        ticket: 'ANON_EXTRA_9',
        symbol: 'DAX40',
        type: 'sell',
        lots: 0.1,
        openTime: '2026-10-17T08:00:00Z',
        closeTime: '2026-10-17T09:00:00Z',
        profit: 115.0,
        broker: 'exness'
      }
    ], 'offline_anon.csv');

    await signInViaOAuth({ selectAccount: true });
    await sleep(60);
    assert.strictEqual(CloudSyncManager.status, 'migration_pending', 'Must prompt MERGE_OR_CHOOSE when unmigrated anon trades exist');
    assert.strictEqual(CloudSyncManager.pendingMigration.scenario, 'MERGE_OR_CHOOSE');
    assert.strictEqual(CloudSyncManager.pendingMigration.stats.duplicateCount, 1, 'Must detect 1 overlapping duplicate');
    assert.strictEqual(CloudSyncManager.pendingMigration.stats.newFromLocalCount, 1, 'Must detect 1 unique new trade');

    const mergeRes = await CloudSyncManager.resolveMigration('merge');
    assert.strictEqual(mergeRes.verified, true);
    assert.strictEqual(mergeRes.tradeCount, 5, 'Alice 4 cloud trades + 1 unique anon trade = 5');
    assert.ok(mergeRes.backupFile && mergeRes.backupFile.name.includes('pre-merge'), 'Must create pre-merge safety backup');
    assert.strictEqual(StorageManager.getAnonymousSnapshot().trades.length, 2, 'Anonymous local trades still preserved untouched');
    console.log('✓ Test 9 passed\n');

    // ------------------------------------------------------------------
    // TEST 10: Retry Backoff Recovery on Transient Network Error & Restore from Cloud
    // ------------------------------------------------------------------
    console.log('[10/10] Testing Transient Error Retry Backoff Recovery & restoreFromCloud...');
    StorageManager.addTrade({
      ticket: 'RETRY_T10',
      symbol: 'SPX500',
      type: 'buy',
      lots: 0.1,
      openTime: '2026-10-18T08:00:00Z',
      closeTime: '2026-10-18T09:00:00Z',
      profit: 95.0,
      broker: 'exness'
    });

    forceNextClientNetworkError = true;
    await assert.rejects(() => CloudSyncManager.syncNow({ reason: 'test_retry' }), 'NETWORK_ERROR');
    assert.strictEqual(CloudSyncManager.status, 'sync_failed', 'Failed sync enters sync_failed with retry timer');

    // Automatic retry fires after 2000ms backoff and pushes queued RETRY_T10 cleanly
    await sleep(2300);
    assert.strictEqual(CloudSyncManager.status, 'synced', 'Retry backoff must automatically recover to synced');
    assert.strictEqual(CloudSyncManager.getState().hasDirtyChanges, false);

    StorageManager.addTrade({
      ticket: 'TEMP_DISCARD',
      symbol: 'EURGBP',
      type: 'sell',
      lots: 0.1,
      openTime: '2026-10-19T08:00:00Z',
      closeTime: '2026-10-19T09:00:00Z',
      profit: -10.0,
      broker: 'exness'
    }, { silentSync: true });
    assert.strictEqual(StorageManager.getTrades().length, 7);

    const cloudRestored = await CloudSyncManager.restoreFromCloud({ createSafetyBackupFirst: true });
    assert.strictEqual(cloudRestored.restoredTrades, 6, 'restoreFromCloud discards unsynced local trade cleanly');
    assert.strictEqual(StorageManager.getTrades().length, 6);
    const allBackups = await CloudSyncManager.listCloudBackups(15);
    assert.ok(allBackups.some((b) => b.name.includes('pre-restore')), 'restoreFromCloud must save pre-restore safety backup');
    console.log('✓ Test 10 passed\n');

    // ------------------------------------------------------------------
    // TEST 11: Theme Switching Isolation (Zero Reload / Zero Sync) & Cloud Backup Deletion
    // ------------------------------------------------------------------
    console.log('[11/11] Testing Theme Switch Isolation & CloudSyncManager.deleteCloudBackup...');
    ThemeManager.init();
    let workspaceReloadedCount = 0;
    let backupDeletedEvents = 0;
    const unsubThemeIsolation = CloudSyncManager.subscribe((ev) => {
      if (ev.eventType === 'workspace_reloaded') workspaceReloadedCount++;
      if (ev.eventType === 'backup_deleted') backupDeletedEvents++;
    });

    const reqCountBeforeTheme = requestLog.length;
    const tradesBeforeTheme = StorageManager.getTrades().length;
    ThemeManager.setTheme('midnight');
    ThemeManager.setTheme('light');
    ThemeManager.setTheme('classic');
    ThemeManager.setTheme('midnight');
    await sleep(1500);

    const driveRequestsDuringTheme = requestLog
      .slice(reqCountBeforeTheme)
      .filter((entry) => entry.includes('/api/drive/'));
    assert.strictEqual(driveRequestsDuringTheme.length, 0, 'Theme switching must trigger ZERO Drive API sync requests');
    assert.strictEqual(CloudSyncManager.getState().hasDirtyChanges, false, 'Theme switching must not mark cloud dirty');
    assert.strictEqual(workspaceReloadedCount, 0, 'Theme switching must trigger ZERO workspace reloads');
    assert.strictEqual(StorageManager.getTrades().length, tradesBeforeTheme, 'Theme switching must preserve active trades');
    assert.strictEqual(ThemeManager.hasStoredThemePreference(), true);
    assert.strictEqual(ThemeManager.getStoredTheme(), 'midnight');

    // Stored local theme survives Drive sync even when remote settings carry another theme
    await CloudSyncManager.syncNow({ fullCheck: true, reason: 'post_theme_sync_check' });
    assert.strictEqual(ThemeManager.getStoredTheme(), 'midnight', 'Local theme preference must not be overwritten by Drive sync');

    // CloudSyncManager.deleteCloudBackup deletes ONLY targeted backup and leaves siblings intact
    const bkToDelete = await CloudSyncManager.createManualBackup('delete-target');
    const backupsBeforeDelete = await CloudSyncManager.listCloudBackups(15);
    assert.ok(backupsBeforeDelete.some((b) => b.id === bkToDelete.id));
    await CloudSyncManager.deleteCloudBackup(bkToDelete.id);
    assert.strictEqual(backupDeletedEvents, 1, 'backup_deleted event must fire');

    const backupsAfterDelete = await CloudSyncManager.listCloudBackups(15);
    assert.strictEqual(backupsAfterDelete.length, backupsBeforeDelete.length - 1);
    assert.ok(!backupsAfterDelete.some((b) => b.id === bkToDelete.id), 'Deleted backup must be removed');

    // 401 AUTH_EXPIRED during deleteCloudBackup updates state cleanly without crashing
    if (backupsAfterDelete.length > 0) {
      mockGoogle.state.forceNextDriveResponse = { status: 401, body: { error: { message: 'Expired token' } } };
      mockGoogle.state.forceRefreshResponse = { status: 400, body: { error: 'invalid_grant' } };
      await assert.rejects(() => CloudSyncManager.deleteCloudBackup(backupsAfterDelete[0].id), 'AUTH_EXPIRED');
      assert.strictEqual(CloudSyncManager.status, 'auth_expired');
    }
    unsubThemeIsolation();
    console.log('✓ Test 11 passed\n');

    console.log('================================================================');
    console.log('ALL 11 FULL-STACK GOOGLE OAUTH & DRIVE SYNC TESTS PASSED!');
    console.log('================================================================');
  } finally {
    await new Promise((r) => appServer.close(r));
    await new Promise((r) => mockGoogle.server.close(r));
  }
}

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILURE:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
