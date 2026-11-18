/**
 * TradeFourge - Multi-Account Detection & Global Filtering Test Suite
 * Covers Phases 2–7:
 *  - Primary symbol naming convention (trailing lowercase 'c' + USTEC edge case)
 *  - Secondary ticket length verification (7-digit vs 8-digit), fallback & conflict flagging
 *  - Mixed-account CSVs, stable account IDs & zero duplicate accounts
 *  - Safe legacy trade migration without data loss
 *  - Real Exness CSV exports (07_10_2026-18_11_2026.csv & 01_01_2007-18_11_2026.csv)
 *  - Header HTML replacement (no LIVE JOURNAL ENGINE, Account Selector after Dashboard)
 *  - Global account filtering across Dashboard, Calendar, Charts, Trade Log, Reports & Fourge AI
 *  - Composed Account + Date Range filtering (Last 30 Days & Custom)
 *  - Non-destructive switching & reload/cloud-sync persistence
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function createStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    _store: store,
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(i) {
      return Array.from(store.keys())[i] || null;
    }
  };
}

function createElementStub(id = '', tagName = 'DIV') {
  const attrs = {};
  const listeners = {};
  const classes = new Set();
  let _innerHTML = '';
  const el = {
    id,
    tagName: String(tagName || 'DIV').toUpperCase(),
    value: '',
    innerText: '',
    textContent: '',
    get innerHTML() { return _innerHTML; },
    set innerHTML(v) {
      _innerHTML = String(v || '');
      this.children = [];
      this.options = [];
    },
    title: '',
    style: {},
    children: [],
    options: [],
    className: '',
    classList: {
      add(...cls) { cls.forEach((c) => classes.add(c)); el.className = Array.from(classes).join(' '); },
      remove(...cls) { cls.forEach((c) => classes.delete(c)); el.className = Array.from(classes).join(' '); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        const shouldAdd = force === undefined ? !classes.has(c) : Boolean(force);
        if (shouldAdd) classes.add(c); else classes.delete(c);
        el.className = Array.from(classes).join(' ');
        return shouldAdd;
      }
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    dispatchEvent(evt) {
      const list = listeners[evt.type] || [];
      list.forEach((fn) => fn(evt));
    },
    click() {
      this.dispatchEvent({ type: 'click', stopPropagation() {}, preventDefault() {} });
    },
    appendChild(child) {
      this.children.push(child);
      if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
        this.options.push(child);
      }
      return child;
    },
    querySelector(sel) {
      if (sel === 'option[value="custom"]') {
        return this.options.find((o) => o.value === 'custom') || null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    remove() {}
  };
  return el;
}

function createSandbox(sharedStorage = null) {
  const localStorage = sharedStorage || createStorageMock();
  const elements = new Map();

  const registerEl = (id, tag = 'DIV') => {
    const el = createElementStub(id, tag);
    elements.set(id, el);
    return el;
  };

  // Register essential UI DOM nodes used across App, Calendar, Trade Log, Reports & Fourge AI
  [
    ['pageTitle', 'H1'],
    ['headerAccountSelectorWrap', 'DIV'],
    ['headerAccountSelectorBtn', 'BUTTON'],
    ['headerAccountSelectorLabel', 'SPAN'],
    ['headerAccountSelectorMenu', 'DIV'],
    ['headerDateRangeSelect', 'SELECT'],
    ['mobileDateRangeSelect', 'SELECT'],
    ['customStartDate', 'INPUT'],
    ['customEndDate', 'INPUT'],
    ['kpiTotalPnL', 'DIV'],
    ['kpiNetPnL', 'DIV'],
    ['kpiTotalTrades', 'DIV'],
    ['kpiWinRate', 'DIV'],
    ['kpiProfitFactor', 'DIV'],
    ['tradeLogBody', 'TBODY'],
    ['tradeLogMobileList', 'DIV'],
    ['tradeLogSymbolFilter', 'SELECT'],
    ['tradeLogPageInfo', 'DIV'],
    ['tradeLogStatCount', 'DIV'],
    ['tradeLogStatNetPnl', 'DIV'],
    ['reportRangePresetSelect', 'SELECT'],
    ['reportInstrumentSelect', 'SELECT'],
    ['reportStartDate', 'INPUT'],
    ['reportEndDate', 'INPUT'],
    ['repMainTitle', 'H2'],
    ['repTotalTrades', 'DIV'],
    ['repNetPnL', 'DIV'],
    ['repHeaderInstrument', 'SPAN'],
    ['repInstrument', 'SPAN'],
    ['repPeriod', 'SPAN'],
    ['weeklyPerfModeLabel', 'SPAN'],
    ['pnlPerfTotalEarned', 'DIV'],
    ['pnlPerfTotalLost', 'DIV'],
    ['pnlPerfNetPnL', 'DIV'],
    ['storageStatusText', 'DIV'],
    ['sidebarStorageTitle', 'DIV'],
    ['sidebarStorageDot', 'SPAN'],
    ['botContextText', 'DIV'],
    ['botContextBadge', 'SPAN'],
    ['calendarMonthTitle', 'DIV'],
    ['calendarGrid', 'DIV']
  ].forEach(([id, tag]) => registerEl(id, tag));

  const docListeners = {};
  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return createElementStub('', tag);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    body: createElementStub('body', 'BODY'),
    documentElement: createElementStub('html', 'HTML')
  };

  const chartCalls = {
    dashboardMetrics: null,
    analyticsMetrics: null,
    weeklyTrades: null,
    pnlTrades: null
  };

  const calendarCalls = {
    initMetrics: null,
    updateMetrics: null
  };

  const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: () => 0,
    clearTimeout: () => {},
    localStorage,
    document,
    navigator: { onLine: true },
    ChartManager: {
      updateDashboardCharts(metrics) { chartCalls.dashboardMetrics = metrics; },
      updateAnalyticsCharts(metrics) { chartCalls.analyticsMetrics = metrics; },
      renderWeeklyPerformanceChart(trades) { chartCalls.weeklyTrades = trades; },
      renderPnLPerformanceChart(trades) { chartCalls.pnlTrades = trades; },
      refreshTheme() {}
    },
    CalendarManager: {
      _initialized: false,
      init(metrics) { this._initialized = true; calendarCalls.initMetrics = metrics; },
      update(metrics) { calendarCalls.updateMetrics = metrics; }
    },
    _chartCalls: chartCalls,
    _calendarCalls: calendarCalls,
    _elements: elements
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  const loadScript = (relPath) => {
    const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  };

  loadScript('js/parser.js');
  loadScript('js/storage.js');
  loadScript('js/analytics.js');
  loadScript('js/cloud-sync.js');
  loadScript('js/strategy-bot.js');
  loadScript('js/app.js');

  return sandbox;
}

const SAMPLE_EXNESS_CSV = [
  'ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason',
  '2541001,2026-10-15T09:00:00Z,2026-10-15T10:00:00Z,buy,0.10,0.10,XAUUSD,2650.00,2660.00,2640.00,2670.00,0,0,100.00,1100,500,tp',
  '2541002,2026-10-20T09:00:00Z,2026-10-20T10:00:00Z,sell,0.10,0.10,USTEC,20500.00,20450.00,20550.00,20400.00,0,0,50.00,1150,500,user',
  '2541003,2026-11-12T09:00:00Z,2026-11-12T10:00:00Z,buy,0.05,0.05,BTCUSD,90000.00,89500.00,89000.00,91000.00,0,0,-25.00,1125,500,sl'
].join('\n');

const SAMPLE_CENTS_CSV = [
  'ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason',
  '29079881,2026-09-10T09:00:00Z,2026-09-10T10:00:00Z,buy,0.10,0.20,XAUUSDc,2600.00,2610.00,2590.00,2620.00,0,0,40.00,1040,500,user',
  '29079881,2026-09-10T09:00:00Z,2026-09-10T10:30:00Z,buy,0.10,0.20,XAUUSDc,2600.00,2615.00,2590.00,2620.00,0,0,60.00,1100,500,tp',
  '36097596,2026-11-14T09:00:00Z,2026-11-14T10:00:00Z,sell,0.05,0.05,BTCUSDc,88000.00,87500.00,88500.00,87000.00,0,0,200.00,1300,500,tp',
  '36097597,2026-11-16T09:00:00Z,2026-11-16T10:00:00Z,buy,0.05,0.05,USOILc,70.00,69.50,69.00,71.00,0,0,-50.00,1250,500,sl'
].join('\n');

const SAMPLE_MIXED_CSV = [
  'ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason',
  '3100001,2026-11-10T09:00:00Z,2026-11-10T10:00:00Z,buy,0.10,0.10,GBPUSD,1.2500,1.2550,1.2450,1.2600,0,0,75.00,1075,500,tp',
  '41000001,2026-11-10T11:00:00Z,2026-11-10T12:00:00Z,buy,0.10,0.10,XAUUSDc,2600.00,2605.00,2595.00,2610.00,0,0,30.00,1105,500,tp'
].join('\n');

function runTests() {
  let passed = 0;
  const run = (name, fn) => {
    try {
      fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      process.exitCode = 1;
      throw err;
    }
  };

  console.log('================================================================');
  console.log('STARTING MULTI-ACCOUNT DETECTION & GLOBAL FILTERING TEST SUITE');
  console.log('================================================================\n');

  // TEST 1: Symbol primary identifier & USTEC edge case
  run('1. Primary symbol naming convention (trailing c = Cents, USTEC = Exness Standard)', () => {
    const sb = createSandbox();
    const { TradeParser } = sb;

    // Cents symbols
    ['XAUUSDc', 'BTCUSDc', 'USOILc', 'USTECc', 'GBPUSDc', 'xauusdc'].forEach((sym) => {
      const norm = TradeParser.normalizeSymbol(sym);
      assert.ok(norm.endsWith('c'), `Expected normalized cent symbol to end in lowercase c, got ${norm}`);
      const res = TradeParser.identifyTradeAccount({ symbol: sym, ticket: '36097596' });
      assert.strictEqual(res.accountId, 'exness_cents', `${sym} should map to exness_cents`);
      assert.strictEqual(res.accountName, 'Cents Account');
      assert.strictEqual(res.needsReview, false);
    });

    // Standard symbols (including USTEC & USDC which end in uppercase C!)
    ['XAUUSD', 'BTCUSD', 'GBPUSD', 'USTEC', 'ETHUSD', 'GBPCAD', 'USOIL', 'USDC'].forEach((sym) => {
      const norm = TradeParser.normalizeSymbol(sym);
      assert.strictEqual(norm, sym.toUpperCase(), `Standard symbol ${sym} should normalize to uppercase`);
      const res = TradeParser.identifyTradeAccount({ symbol: sym, ticket: '2541001' });
      assert.strictEqual(res.accountId, 'exness_standard', `${sym} should map to exness_standard`);
      assert.strictEqual(res.accountName, 'Exness Account');
      assert.strictEqual(res.needsReview, false);
    });
  });

  // TEST 2: Secondary ticket verification, fallback & conflict flagging
  run('2. Secondary ticket length corroboration, missing-symbol fallback & conflict flagging', () => {
    const sb = createSandbox();
    const { TradeParser } = sb;

    // Missing symbol falls back to ticket length
    const fb7 = TradeParser.identifyTradeAccount({ symbol: '', ticket: '2541001' });
    assert.strictEqual(fb7.accountId, 'exness_standard');
    assert.strictEqual(fb7.detectionSource, 'ticket_fallback');
    assert.strictEqual(fb7.needsReview, false);

    const fb8 = TradeParser.identifyTradeAccount({ symbol: '', ticket: '29079881' });
    assert.strictEqual(fb8.accountId, 'exness_cents');
    assert.strictEqual(fb8.detectionSource, 'ticket_fallback');
    assert.strictEqual(fb8.needsReview, false);

    // Conflict: symbol says Cents (XAUUSDc), ticket is 7 digits -> symbol wins + flagged for review
    const conflict1 = TradeParser.identifyTradeAccount({ symbol: 'XAUUSDc', ticket: '2541001' });
    assert.strictEqual(conflict1.accountId, 'exness_cents', 'Symbol must win over ticket on conflict');
    assert.strictEqual(conflict1.needsReview, true, 'Conflict must be flagged for review');
    assert.ok(conflict1.reviewReason.includes('7-digit'), 'Review reason should explain ticket mismatch');

    // Conflict: symbol says Standard (XAUUSD), ticket is 8 digits -> symbol wins + flagged for review
    const conflict2 = TradeParser.identifyTradeAccount({ symbol: 'XAUUSD', ticket: '29079881' });
    assert.strictEqual(conflict2.accountId, 'exness_standard', 'Symbol must win over ticket on conflict');
    assert.strictEqual(conflict2.needsReview, true, 'Conflict must be flagged for review');

    // Annotated trade records carry accountNeedsReview & accountReviewReason
    const annotated = TradeParser.annotateTradesWithAccounts([{ symbol: 'XAUUSDc', ticket: '2541001' }]);
    assert.strictEqual(annotated[0].accountId, 'exness_cents');
    assert.strictEqual(annotated[0].accountNeedsReview, true);
    assert.ok(annotated[0].accountReviewReason.includes('7-digit'));

    // Future ticket length (e.g., 9 digits) should NOT override symbol or trigger false conflict
    const future9 = TradeParser.identifyTradeAccount({ symbol: 'XAUUSDc', ticket: '123456789' });
    assert.strictEqual(future9.accountId, 'exness_cents');
    assert.strictEqual(future9.detectionSource, 'symbol');
    assert.strictEqual(future9.needsReview, false);
  });

  // TEST 3: Mixed-account CSV per-record assignment & zero duplicate account creation
  run('3. Mixed-account CSV assigns accounts per trade and repeated imports never duplicate accounts', () => {
    const sb = createSandbox();
    const { TradeParser, StorageManager } = sb;

    const parsed = TradeParser.parseExness(SAMPLE_MIXED_CSV);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].accountId, 'exness_standard');
    assert.strictEqual(parsed[1].accountId, 'exness_cents');

    StorageManager.mergeTrades(parsed, 'mixed_1.csv');
    StorageManager.mergeTrades(parsed, 'mixed_2.csv'); // duplicate re-import

    const accounts = StorageManager.getAccounts();
    assert.strictEqual(accounts.length, 2, 'Should have exactly 2 unique accounts');
    assert.deepStrictEqual(Array.from(accounts, (a) => a.id), ['exness_standard', 'exness_cents']);
    assert.strictEqual(StorageManager.getTrades().length, 2, 'Duplicate trades must not be added');
  });

  // TEST 4: Safe legacy migration for trades missing accountId
  run('4. Safe automatic migration of legacy trades lacking accountId (including legacy XAUUSDC vs USTEC)', () => {
    const legacyTrades = [
      { id: 'EX_1', ticket: '2541001', symbol: 'XAUUSD', type: 'buy', lots: 0.1, profit: 50, openTime: '2026-10-10T10:00:00Z', closeTime: '2026-10-10T11:00:00Z' },
      { id: 'EX_2', ticket: '2541002', symbol: 'USTEC', type: 'sell', lots: 0.1, profit: 25, openTime: '2026-10-11T10:00:00Z', closeTime: '2026-10-11T11:00:00Z' },
      { id: 'EX_3', ticket: '29079881', symbol: 'XAUUSDC', type: 'buy', lots: 0.1, profit: 100, openTime: '2026-10-12T10:00:00Z', closeTime: '2026-10-12T11:00:00Z' },
      { id: 'EX_4', ticket: '29079882', symbol: 'USOILC', type: 'buy', lots: 0.1, profit: -15, openTime: '2026-10-12T12:00:00Z', closeTime: '2026-10-12T13:00:00Z' }
    ];
    const sharedStorage = createStorageMock({
      tradefourge_trades: JSON.stringify(legacyTrades)
    });
    const sb = createSandbox(sharedStorage);
    const trades = sb.StorageManager.getTrades();

    assert.strictEqual(trades.length, 4, 'All 4 historical trades must be preserved');
    assert.strictEqual(trades[0].accountId, 'exness_standard');
    assert.strictEqual(trades[1].accountId, 'exness_standard', 'Legacy USTEC must stay Exness Account');
    assert.strictEqual(trades[2].accountId, 'exness_cents', 'Legacy uppercased XAUUSDC must migrate to Cents Account');
    assert.strictEqual(trades[3].accountId, 'exness_cents', 'Legacy uppercased USOILC must migrate to Cents Account');

    const persisted = JSON.parse(sharedStorage.getItem('tradefourge_trades'));
    assert.strictEqual(persisted[2].accountId, 'exness_cents', 'Migration must persist to storage');
    assert.strictEqual(sb.StorageManager.getAccounts().length, 2);
  });

  // TEST 5: Header HTML structure verification (Phase 3)
  run('5. Dashboard header replaces LIVE JOURNAL ENGINE with Account Selector immediately after Dashboard', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.strictEqual(html.includes('LIVE JOURNAL ENGINE'), false, 'LIVE JOURNAL ENGINE must be completely removed');
    assert.strictEqual(html.includes('headerTerminalPill'), false, 'headerTerminalPill must be completely removed');

    const titleIdx = html.indexOf('id="pageTitle">Dashboard</h1>');
    const selectorIdx = html.indexOf('id="headerAccountSelectorWrap"');
    const dateIdx = html.indexOf('id="headerDateRangeSelect"');
    assert.ok(titleIdx > 0, 'Dashboard title must exist');
    assert.ok(selectorIdx > titleIdx && selectorIdx < dateIdx, 'Account Selector must appear immediately after Dashboard and before Date Range selector');
    assert.ok(html.includes('id="headerAccountSelectorLabel">All Accounts</span>'), 'Default label must be All Accounts');
  });

  // TEST 6: Full global filtering, date composition, partial closes & persistence with fixtures
  run('6. Global account filtering, All Accounts aggregation, date composition, partial closes & reload persistence', () => {
    const sharedStorage = createStorageMock();
    const sb = createSandbox(sharedStorage);
    const { TradeParser, StorageManager, App, StrategyBotManager, TradeAnalytics } = sb;

    // Before any CSV: only All Accounts option exists
    App.initAccountSelector();
    App.processTrades();
    let opts = App.getAvailableAccountOptions();
    assert.deepStrictEqual(Array.from(opts, (o) => o.id), ['all'], 'Before imports, only All Accounts should appear');
    assert.strictEqual(App.selectedAccount, 'all');

    // Import Exness Standard CSV (3 trades: +100, +50, -25 => +125)
    const exTrades = TradeParser.parseExness(SAMPLE_EXNESS_CSV);
    StorageManager.mergeTrades(exTrades, 'exness.csv');
    App.trades = StorageManager.getTrades();
    App.processTrades();

    opts = App.getAvailableAccountOptions();
    assert.deepStrictEqual(Array.from(opts, (o) => o.id), ['exness_standard', 'all']);
    assert.strictEqual(App.selectedAccount, 'all', 'Default must remain All Accounts');
    assert.strictEqual(App.currentMetrics.totalTrades, 3);
    assert.strictEqual(App.currentMetrics.totalPnL, 125);

    // Import Cents CSV (4 trades including 2 partial closes on ticket 29079881: +40, +60, +200, -50 => +250)
    const centsTrades = TradeParser.parseExness(SAMPLE_CENTS_CSV);
    StorageManager.mergeTrades(centsTrades, 'cents.csv');
    App.trades = StorageManager.getTrades();
    App.processTrades();

    opts = App.getAvailableAccountOptions();
    assert.deepStrictEqual(Array.from(opts, (o) => o.id), ['exness_standard', 'exness_cents', 'all'], 'Exact 3 options in required order');
    assert.deepStrictEqual(Array.from(opts, (o) => o.name), ['Exness Account', 'Cents Account', 'All Accounts']);

    // All Accounts aggregation: 3 + 4 = 7 trades, 125 + 250 = 375
    assert.strictEqual(App.currentMetrics.totalTrades, 7);
    assert.strictEqual(App.currentMetrics.totalPnL, 375);
    assert.strictEqual(sb._chartCalls.dashboardMetrics.totalPnL, 375);
    assert.strictEqual(sb._chartCalls.weeklyTrades.length, 7);
    assert.strictEqual(sb._chartCalls.pnlTrades.length, 7);
    assert.strictEqual(StrategyBotManager.getTrades().length, 7);
    assert.strictEqual(TradeAnalytics.getActiveTrades().length, 7);

    // Switch to Exness Account -> ONLY 3 trades, P&L = 125
    App.setSelectedAccount('exness_standard');
    assert.strictEqual(sb._elements.get('headerAccountSelectorLabel').innerText, 'Exness Account');
    assert.strictEqual(App.filteredTrades.length, 3);
    assert.strictEqual(App.currentMetrics.totalTrades, 3);
    assert.strictEqual(App.currentMetrics.totalPnL, 125);
    assert.strictEqual(sb._chartCalls.dashboardMetrics.totalTrades, 3);
    assert.strictEqual(sb._chartCalls.weeklyTrades.length, 3);
    assert.strictEqual(sb._chartCalls.pnlTrades.length, 3);
    assert.strictEqual(sb._calendarCalls.initMetrics.totalTrades, 3);
    assert.strictEqual(StrategyBotManager.getTrades().length, 3);
    assert.strictEqual(TradeAnalytics.getActiveTrades().length, 3);
    assert.strictEqual(StorageManager.getTrades().length, 7, 'Switching accounts must NEVER delete or mutate stored trades');

    // Trade Log symbol dropdown should only list Exness Account symbols
    const exLogSymbols = Array.from(sb._elements.get('tradeLogSymbolFilter').options, (o) => o.value);
    assert.deepStrictEqual(exLogSymbols, ['BTCUSD', 'USTEC', 'XAUUSD']);

    // Switch to Cents Account -> ONLY 4 trades (both partial closes preserved), P&L = 250
    App.setSelectedAccount('exness_cents');
    assert.strictEqual(sb._elements.get('headerAccountSelectorLabel').innerText, 'Cents Account');
    assert.strictEqual(App.filteredTrades.length, 4);
    assert.strictEqual(App.currentMetrics.totalTrades, 4);
    assert.strictEqual(App.currentMetrics.totalPnL, 250);
    assert.strictEqual(sb._chartCalls.weeklyTrades.length, 4);
    assert.strictEqual(sb._chartCalls.pnlTrades.length, 4);
    assert.strictEqual(StrategyBotManager.getTrades().length, 4);
    assert.strictEqual(StorageManager.getTrades().length, 7);

    const centsLogSymbols = Array.from(sb._elements.get('tradeLogSymbolFilter').options, (o) => o.value);
    assert.deepStrictEqual(centsLogSymbols, ['BTCUSDc', 'USOILc', 'XAUUSDc']);

    // Reports view must only show Cents Account instruments
    const repInsts = Array.from(sb._elements.get('reportInstrumentSelect').options, (o) => o.value);
    assert.deepStrictEqual(repInsts, ['BTCUSDc', 'USOILc', 'XAUUSDc']);

    // Compose Cents Account + Last 30 Days (latest Cents trade is 2026-11-16 -> excludes 2026-09-10 trades!)
    App.dateFilter = 'last30';
    App.processTrades();
    assert.strictEqual(App.filteredTrades.length, 2, 'Cents + Last 30 Days must return only the 2 Nov Cents trades');
    assert.strictEqual(App.currentMetrics.totalPnL, 150, '200 + (-50) = 150');
    assert.strictEqual(sb._chartCalls.weeklyTrades.length, 2);
    assert.strictEqual(sb._chartCalls.pnlTrades.length, 2);

    // Compose Cents Account + Custom date range with 0 trades -> weekly/PnL must NOT fall back to all trades!
    App.applyCustomDateRange('2025-01-01', '2025-01-31');
    assert.strictEqual(App.filteredTrades.length, 0);
    assert.strictEqual(sb._chartCalls.weeklyTrades.length, 0, 'Empty filtered view must NOT leak all trades into Weekly chart');
    assert.strictEqual(sb._chartCalls.pnlTrades.length, 0, 'Empty filtered view must NOT leak all trades into P&L chart');

    // Reload persistence across browser session
    const sbReload = createSandbox(sharedStorage);
    sbReload.App.initAccountSelector();
    sbReload.App.trades = sbReload.StorageManager.getTrades();
    sbReload.App.processTrades();

    assert.strictEqual(sbReload.App.selectedAccount, 'exness_cents', 'Selected account must persist across reload');
    assert.strictEqual(sbReload.StorageManager.getTrades().length, 7, 'All 7 trades must persist across reload');
    assert.strictEqual(sbReload.App.filteredTrades.length, 4, 'Reloaded view must apply persisted Cents Account filter');
    assert.strictEqual(sbReload.App.currentMetrics.totalPnL, 250);

    // CloudSync payload compatibility: preserves trade accountId + settings.tradingAccounts
    const snap = sbReload.StorageManager.exportActiveSnapshot();
    const tradesPayload = sbReload.CloudSyncUtils.buildTradesPayload(snap);
    const settingsPayload = sbReload.CloudSyncUtils.buildSettingsPayload(snap, { sub: 'u1' });
    assert.strictEqual(tradesPayload.trades.every((t) => Boolean(t.accountId)), true);
    assert.strictEqual(Array.isArray(settingsPayload.tradingAccounts), true);
    assert.strictEqual(settingsPayload.tradingAccounts.length, 2);

    const extracted = sbReload.CloudSyncUtils.extractSnapshotFromRemoteDb({
      trades: tradesPayload,
      settings: settingsPayload,
      journal: sbReload.CloudSyncUtils.buildJournalPayload(snap)
    });
    assert.strictEqual(extracted.accounts.length, 2);
  });

  // TEST 7: Real supplied Exness CSV files (if present in /Users/surajkoley/Downloads)
  const csv1Path = '/Users/surajkoley/Downloads/07_10_2026-18_11_2026.csv';
  const csv2Path = '/Users/surajkoley/Downloads/01_01_2007-18_11_2026.csv';
  if (fs.existsSync(csv1Path) && fs.existsSync(csv2Path)) {
    run('7. Real Exness CSVs (07_10_2026-18_11_2026.csv & 01_01_2007-18_11_2026.csv) end-to-end validation', () => {
      const sb = createSandbox();
      const { TradeParser, StorageManager, App } = sb;

      const csv1Text = fs.readFileSync(csv1Path, 'utf8');
      const csv2Text = fs.readFileSync(csv2Path, 'utf8');

      // Import CSV 1 -> Exness Account
      const parsed1 = TradeParser.parseReport(csv1Text, '07_10_2026-18_11_2026.csv');
      assert.strictEqual(parsed1.trades.length, 148, 'CSV 1 should parse 148 closed trades');
      assert.strictEqual(parsed1.metadata.account, 'Exness Account');
      assert.strictEqual(parsed1.metadata.reviewCount, 0, 'CSV 1 should have zero symbol/ticket conflicts');
      assert.ok(parsed1.trades.every((t) => t.accountId === 'exness_standard'), 'Every CSV 1 trade must belong to exness_standard');
      assert.ok(parsed1.trades.some((t) => t.symbol === 'USTEC'), 'CSV 1 must contain USTEC assigned to Exness Account');

      StorageManager.mergeTrades(parsed1.trades, '07_10_2026-18_11_2026.csv');
      App.trades = StorageManager.getTrades();
      App.initAccountSelector();
      App.processTrades();

      const exnessPnl = App.currentMetrics.totalPnL;
      assert.strictEqual(exnessPnl, -307.48, 'CSV 1 Exness Account P&L must be -307.48');

      // Import CSV 2 -> Cents Account
      const parsed2 = TradeParser.parseReport(csv2Text, '01_01_2007-18_11_2026.csv');
      assert.strictEqual(parsed2.trades.length, 155, 'CSV 2 should parse all 155 closed trades (including partial closes)');
      assert.strictEqual(parsed2.metadata.account, 'Cents Account');
      assert.strictEqual(parsed2.metadata.reviewCount, 0, 'CSV 2 should have zero symbol/ticket conflicts');
      assert.ok(parsed2.trades.every((t) => t.accountId === 'exness_cents'), 'Every CSV 2 trade must belong to exness_cents');
      assert.ok(parsed2.trades.every((t) => t.symbol.endsWith('c')), 'Every CSV 2 symbol must preserve trailing c');

      // Verify partial closes (tickets 29079881 & 36097596) are preserved
      assert.strictEqual(parsed2.trades.filter((t) => t.ticket === '29079881').length, 2);
      assert.strictEqual(parsed2.trades.filter((t) => t.ticket === '36097596').length, 2);

      StorageManager.mergeTrades(parsed2.trades, '01_01_2007-18_11_2026.csv');
      App.trades = StorageManager.getTrades();
      App.processTrades();

      // Default All Accounts combines both exactly
      assert.strictEqual(App.selectedAccount, 'all');
      assert.strictEqual(App.currentMetrics.totalTrades, 303);
      assert.strictEqual(App.currentMetrics.totalPnL, -1012.44, 'Combined All Accounts P&L must equal -307.48 + -704.96 = -1012.44');

      // Switch to Exness Account
      App.setSelectedAccount('exness_standard');
      assert.strictEqual(App.currentMetrics.totalTrades, 148);
      assert.strictEqual(App.currentMetrics.totalPnL, -307.48);

      // Switch to Cents Account
      App.setSelectedAccount('exness_cents');
      assert.strictEqual(App.currentMetrics.totalTrades, 155);
      assert.strictEqual(App.currentMetrics.totalPnL, -704.96);

      // Switch back to All Accounts
      App.setSelectedAccount('all');
      assert.strictEqual(App.currentMetrics.totalTrades, 303);
      assert.strictEqual(App.currentMetrics.totalPnL, -1012.44);

      // Re-importing both CSVs must create zero duplicate trades and zero duplicate accounts
      StorageManager.mergeTrades(parsed1.trades, '07_10_2026-18_11_2026.csv');
      StorageManager.mergeTrades(parsed2.trades, '01_01_2007-18_11_2026.csv');
      assert.strictEqual(StorageManager.getTrades().length, 303);
      assert.strictEqual(StorageManager.getAccounts().length, 2);
    });
  } else {
    console.log('SKIP: Real Downloads CSVs not found on this machine (fixture suite already ran).');
  }

  console.log(`\nSummary: ${passed} passed, 0 failed (${passed} total).`);
}

runTests();
