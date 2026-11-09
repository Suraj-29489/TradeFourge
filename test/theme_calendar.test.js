/**
 * TradeForge - Global Theme System & Dynamic P&L Calendar Heatmap Test Suite
 *
 * Compatible with macOS JavaScriptCore (`jsc test/theme_calendar.test.js`)
 * and Node.js (`node test/theme_calendar.test.js`).
 */

(function (global) {
  'use strict';

  const isNode = typeof require === 'function' && typeof process !== 'undefined' && process.versions && process.versions.node;
  const ROOT_PREFIX = isNode ? require('path').resolve(__dirname, '..') + '/' : '';

  if (typeof global.console === 'undefined') {
    const _print = typeof print === 'function' ? print : () => {};
    global.console = {
      log: (...args) => _print(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')),
      warn: (...args) => _print('[WARN]', ...args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))),
      error: (...args) => _print('[ERROR]', ...args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))))
    };
  }

  const assert = {
    ok(val, msg = 'Expected truthy value') {
      if (!val) throw new Error(`Assertion failed: ${msg} (got ${val})`);
    },
    strictEqual(actual, expected, msg = '') {
      if (!Object.is(actual, expected) && actual !== expected) {
        throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    closeTo(actual, expected, delta = 1e-9, msg = '') {
      if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - expected) > delta) {
        throw new Error(`Assertion failed${msg ? ': ' + msg : ''} — expected ~${expected} (±${delta}), got ${actual}`);
      }
    }
  };

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
      setItem(k, v) { map.set(String(k), String(v)); },
      removeItem(k) { map.delete(String(k)); },
      clear() { map.clear(); },
      get length() { return map.size; },
      key(i) { return Array.from(map.keys())[i] ?? null; }
    };
  }

  // Minimal DOM Element mock sufficient for ThemeManager and CalendarManager
  class MockElement {
    constructor(tag = 'div', ownerDoc = null) {
      this.tagName = String(tag).toUpperCase();
      this._ownerDoc = ownerDoc;
      this.id = '';
      this.className = '';
      this._attrs = {};
      this._listeners = {};
      this.children = [];
      this._innerHTML = '';
      this._innerText = '';
      this._textContent = '';
      this.style = {};
      this.parentNode = null;
      this.classList = {
        add: (...cls) => {
          const set = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
          cls.forEach((c) => set.add(c));
          this.className = Array.from(set).join(' ');
        },
        remove: (...cls) => {
          const rm = new Set(cls);
          this.className = String(this.className || '').split(/\s+/).filter((c) => c && !rm.has(c)).join(' ');
        },
        toggle: (c, force) => {
          const has = this.classList.contains(c);
          const next = force !== undefined ? Boolean(force) : !has;
          if (next) this.classList.add(c);
          else this.classList.remove(c);
          return next;
        },
        contains: (c) => String(this.className || '').split(/\s+/).includes(c)
      };
    }
    setAttribute(k, v) {
      this._attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
      if (k === 'class') this.className = String(v);
    }
    getAttribute(k) {
      if (k === 'id') return this.id || null;
      if (k === 'class') return this.className || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    addEventListener(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      const m = selector.match(/^\.([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)\]$/);
      const out = [];
      const walk = (el) => {
        for (const ch of el.children) {
          if (m) {
            if (ch.classList.contains(m[1]) && ch.getAttribute(m[2]) !== null) {
              out.push(ch);
            }
          } else if (selector.startsWith('.')) {
            if (ch.classList.contains(selector.slice(1))) out.push(ch);
          }
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
    getBoundingClientRect() {
      return { left: 100, top: 100, right: 200, bottom: 180, width: 100, height: 80 };
    }
    focus() {}
    set innerHTML(val) {
      this._innerHTML = String(val);
      if (val === '') this.children = [];
    }
    get innerHTML() { return this._innerHTML; }
    set innerText(val) { this._innerText = String(val); }
    get innerText() { return this._innerText; }
    set textContent(val) { this._textContent = String(val); }
    get textContent() { return this._textContent; }
  }

  function setupMockDom() {
    const elementsById = new Map();
    const doc = {
      _docListeners: {},
      documentElement: null,
      body: null,
      metaThemeColor: null,
      createElement(tag) {
        return new MockElement(tag, doc);
      },
      getElementById(id) {
        return elementsById.get(id) || null;
      },
      registerById(id, el) {
        el.id = id;
        elementsById.set(id, el);
        return el;
      },
      querySelector(selector) {
        if (selector === 'meta[name="theme-color"]') return doc.metaThemeColor;
        return doc.body ? doc.body.querySelector(selector) : null;
      },
      querySelectorAll(selector) {
        return doc.body ? doc.body.querySelectorAll(selector) : [];
      },
      addEventListener(type, fn) {
        if (!doc._docListeners[type]) doc._docListeners[type] = [];
        doc._docListeners[type].push(fn);
      }
    };
    doc.documentElement = new MockElement('html', doc);
    doc.body = new MockElement('body', doc);
    doc.body.contains = () => true;
    doc.metaThemeColor = new MockElement('meta', doc);
    doc.metaThemeColor.setAttribute('name', 'theme-color');
    doc.metaThemeColor.setAttribute('content', '#141D21');

    // Theme selector UI mock
    const themeLabel = doc.registerById('settingsActiveThemeLabel', new MockElement('span', doc));
    doc.body.appendChild(themeLabel);
    const themeGrid = doc.registerById('appearanceThemeGrid', new MockElement('div', doc));
    ['classic', 'midnight', 'light'].forEach((t) => {
      const btn = new MockElement('button', doc);
      btn.className = 'appearance-theme-card';
      btn.setAttribute('data-theme-choice', t);
      themeGrid.appendChild(btn);
    });
    doc.body.appendChild(themeGrid);

    // Calendar UI mock
    const calGrid = doc.registerById('calendarGrid', new MockElement('div', doc));
    const calTitle = doc.registerById('calendarTitle', new MockElement('span', doc));
    const calPnl = doc.registerById('calMonthlyPnl', new MockElement('span', doc));
    const calDays = doc.registerById('calMonthlyDays', new MockElement('span', doc));
    const calNote = doc.registerById('calendarHeatmapLegendNote', new MockElement('span', doc));
    doc.body.appendChild(calGrid);
    doc.body.appendChild(calTitle);
    doc.body.appendChild(calPnl);
    doc.body.appendChild(calDays);
    doc.body.appendChild(calNote);

    global.document = doc;
    return doc;
  }

  global.window = global;
  global.localStorage = createMemoryStorage();
  global.sessionStorage = createMemoryStorage();
  global.addEventListener = function () {};
  global.innerWidth = 1440;
  global.innerHeight = 900;
  setupMockDom();

  function loadModule(relPath) {
    if (isNode) {
      return require(ROOT_PREFIX + relPath);
    }
    if (typeof load === 'function') {
      load(relPath);
      return null;
    }
    throw new Error('Cannot load module in runtime: ' + relPath);
  }

  loadModule('js/storage.js');
  loadModule('js/analytics.js');
  loadModule('js/theme.js');
  loadModule('js/calendar.js');

  function resetEnv() {
    global.localStorage.clear();
    global.sessionStorage.clear();
    setupMockDom();

    ThemeManager.currentTheme = 'classic';
    ThemeManager._listeners = [];
    ThemeManager._selectorBound = false;

    CalendarManager.metricsData = null;
    CalendarManager._listenersAttached = false;
    CalendarManager._scrollHideAttached = false;
    CalendarManager._initialized = false;
    CalendarManager._tooltipEl = null;

    StorageManager.activeNamespace = 'anonymous';
    StorageManager.loadFromStorage();
  }

  const tests = [];
  function test(name, fn) {
    tests.push({ name, fn });
  }

  // ==================== THEME MANAGER TESTS ====================

  test('1. ThemeManager defaults safely to Classic when storage is empty or corrupt', () => {
    resetEnv();
    const initial = ThemeManager.init();
    assert.strictEqual(initial, 'classic');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'classic');
    assert.strictEqual(document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#141D21');

    // Invalid theme inputs normalize back to classic
    global.localStorage.setItem(ThemeManager.STORAGE_KEY, 'unknown_theme');
    global.localStorage.setItem(ThemeManager.SETTINGS_KEY, '{bad-json');
    assert.strictEqual(ThemeManager.getStoredTheme(), 'classic');
    assert.strictEqual(ThemeManager.normalizeTheme('  MIDNIGHT '), 'midnight');
    assert.strictEqual(ThemeManager.normalizeTheme('solarized'), 'classic');
  });

  test('2. ThemeManager switches themes live, persists without losing settings/trades, and survives reload', () => {
    resetEnv();
    const sampleTrades = [
      { ticket: 'T1', symbol: 'XAUUSD', type: 'buy', lots: 0.1, openTime: '2026-10-08T09:00:00Z', closeTime: '2026-10-08T10:00:00Z', profit: 150, broker: 'exness' }
    ];
    StorageManager.saveTrades(sampleTrades, 'seed.csv');
    TradeAnalytics.setStartingCapital(10000);
    StorageManager.saveNotes('Strict risk management rule');
    global.localStorage.setItem(ThemeManager.SETTINGS_KEY, JSON.stringify({ currency: 'INR', compactMode: true }));

    ThemeManager.init();
    const events = [];
    const unsub = ThemeManager.subscribe((payload) => events.push(payload));

    // Switch Classic -> Midnight
    ThemeManager.setTheme('midnight');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'midnight');
    assert.strictEqual(document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#0B1218');
    assert.strictEqual(global.localStorage.getItem(ThemeManager.STORAGE_KEY), 'midnight');

    const settingsAfterMidnight = JSON.parse(global.localStorage.getItem(ThemeManager.SETTINGS_KEY));
    assert.strictEqual(settingsAfterMidnight.theme, 'midnight');
    assert.strictEqual(settingsAfterMidnight.currency, 'INR', 'Existing settings must be preserved');
    assert.strictEqual(settingsAfterMidnight.compactMode, true);

    // Switch Midnight -> Light (mixed whitespace/casing normalized)
    ThemeManager.setTheme('  LIGHT ');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');
    assert.strictEqual(document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#F1F5F9');

    // Verify radio UI reflects Light active
    const cards = document.querySelectorAll('.appearance-theme-card[data-theme-choice]');
    assert.strictEqual(cards.find((c) => c.getAttribute('data-theme-choice') === 'light').getAttribute('aria-checked'), 'true');
    assert.strictEqual(cards.find((c) => c.getAttribute('data-theme-choice') === 'classic').getAttribute('aria-checked'), 'false');
    assert.strictEqual(document.getElementById('settingsActiveThemeLabel').textContent, 'Light (Crisp Daylight Terminal)');

    // Verify listener events and unsubscribe
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].previousTheme, 'classic');
    assert.strictEqual(events[0].theme, 'midnight');
    assert.strictEqual(events[1].previousTheme, 'midnight');
    assert.strictEqual(events[1].theme, 'light');
    unsub();

    // Simulate reload: reset in-memory theme + DOM attr, keep localStorage
    ThemeManager.currentTheme = 'classic';
    document.documentElement.setAttribute('data-theme', '');
    const reloaded = ThemeManager.init();
    assert.strictEqual(reloaded, 'light');
    assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');

    // Switch back to Classic & verify trades/notes/capital untouched
    ThemeManager.setTheme('classic');
    assert.strictEqual(events.length, 2, 'Unsubscribed listener must not fire');
    assert.strictEqual(StorageManager.getTrades().length, 1);
    assert.strictEqual(StorageManager.getStartingCapital(), 10000);
    assert.strictEqual(StorageManager.getNotes(), 'Strict risk management rule');
  });

  // ==================== CALENDAR HEATMAP MATH & TIERS ====================

  test('3. computeDailyReturnPercent handles capital math, near-zero noise, and invalid inputs safely', () => {
    resetEnv();
    assert.closeTo(CalendarManager.computeDailyReturnPercent(250, 10000), 2.5);
    assert.closeTo(CalendarManager.computeDailyReturnPercent(-50, 10000), -0.5);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(0, 10000), 0);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(1e-7, 10000), 0);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(-1e-7, 10000), 0);

    // Invalid/missing capital -> null (no NaN or Infinity)
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(100, null), null);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(100, 0), null);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(100, -1000), null);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(100, NaN), null);
    assert.strictEqual(CalendarManager.computeDailyReturnPercent(Infinity, 10000), null);
  });

  test('4. getHeatmapIntensityTier enforces exact 5-tier positive and negative boundaries', () => {
    resetEnv();
    const cap = 10000;

    // Neutral / break-even
    const flat = CalendarManager.getHeatmapIntensityTier(0, 0);
    assert.strictEqual(flat.direction, 'neutral');
    assert.strictEqual(flat.tier, 0);
    assert.strictEqual(flat.className, '');

    const floatNoise = CalendarManager.getHeatmapIntensityTier(1e-9, CalendarManager.computeDailyReturnPercent(1e-9, cap));
    assert.strictEqual(floatNoise.direction, 'neutral');
    assert.strictEqual(floatNoise.tier, 0);

    // Positive tier cases (<0.25, [0.25,0.5), [0.5,1.0), [1.0,2.0), >=2.0)
    const posCases = [
      { pnl: 1, expectedTier: 1 },        // +0.01%
      { pnl: 24.99, expectedTier: 1 },    // +0.2499%
      { pnl: 25, expectedTier: 2 },       // +0.25% exact boundary
      { pnl: 49.99, expectedTier: 2 },    // +0.4999%
      { pnl: 50, expectedTier: 3 },       // +0.50% exact boundary
      { pnl: 99.99, expectedTier: 3 },    // +0.9999%
      { pnl: 100, expectedTier: 4 },      // +1.00% exact boundary
      { pnl: 199.99, expectedTier: 4 },   // +1.9999%
      { pnl: 200, expectedTier: 5 },      // +2.00% exact boundary
      { pnl: 5000, expectedTier: 5 }      // +50.00% extreme outlier clamped to tier 5
    ];
    posCases.forEach(({ pnl, expectedTier }) => {
      const pct = CalendarManager.computeDailyReturnPercent(pnl, cap);
      const res = CalendarManager.getHeatmapIntensityTier(pnl, pct);
      assert.strictEqual(res.direction, 'pos', `pos pnl=${pnl}`);
      assert.strictEqual(res.tier, expectedTier, `pos tier mismatch for pnl=${pnl} (${pct}%)`);
      assert.strictEqual(res.className, `pnl-tier-pos-${expectedTier}`);
      assert.strictEqual(res.hasPercentage, true);
      assert.strictEqual(res.isFallback, false);
    });

    // Negative tier cases
    const negCases = [
      { pnl: -1, expectedTier: 1 },
      { pnl: -24.99, expectedTier: 1 },
      { pnl: -25, expectedTier: 2 },
      { pnl: -49.99, expectedTier: 2 },
      { pnl: -50, expectedTier: 3 },
      { pnl: -99.99, expectedTier: 3 },
      { pnl: -100, expectedTier: 4 },
      { pnl: -199.99, expectedTier: 4 },
      { pnl: -200, expectedTier: 5 },
      { pnl: -4500, expectedTier: 5 }
    ];
    negCases.forEach(({ pnl, expectedTier }) => {
      const pct = CalendarManager.computeDailyReturnPercent(pnl, cap);
      const res = CalendarManager.getHeatmapIntensityTier(pnl, pct);
      assert.strictEqual(res.direction, 'neg', `neg pnl=${pnl}`);
      assert.strictEqual(res.tier, expectedTier, `neg tier mismatch for pnl=${pnl} (${pct}%)`);
      assert.strictEqual(res.className, `pnl-tier-neg-${expectedTier}`);
      assert.strictEqual(res.hasPercentage, true);
      assert.strictEqual(res.isFallback, false);
    });

    // Missing starting capital fallback -> tier 2 with isFallback: true
    const fbPos = CalendarManager.getHeatmapIntensityTier(350, null);
    assert.strictEqual(fbPos.direction, 'pos');
    assert.strictEqual(fbPos.tier, 2);
    assert.strictEqual(fbPos.className, 'pnl-tier-pos-2');
    assert.strictEqual(fbPos.hasPercentage, false);
    assert.strictEqual(fbPos.isFallback, true);

    const fbNeg = CalendarManager.getHeatmapIntensityTier(-350, null);
    assert.strictEqual(fbNeg.direction, 'neg');
    assert.strictEqual(fbNeg.tier, 2);
    assert.strictEqual(fbNeg.className, 'pnl-tier-neg-2');
    assert.strictEqual(fbNeg.hasPercentage, false);
    assert.strictEqual(fbNeg.isFallback, true);
  });

  test('5. formatPercent, formatDateDisplay, escapeHtml & DOM Calendar render produce accurate output', () => {
    resetEnv();
    assert.strictEqual(CalendarManager.formatPercent(null), 'N/A');
    assert.strictEqual(CalendarManager.formatPercent(undefined), 'N/A');
    assert.strictEqual(CalendarManager.formatPercent(0), '0.00%');
    assert.strictEqual(CalendarManager.formatPercent(1.425), '+1.43%');
    assert.strictEqual(CalendarManager.formatPercent(-0.85), '-0.85%');
    assert.strictEqual(CalendarManager.formatDateDisplay('2026-10-08'), 'Thu, Oct 8, 2026');
    assert.strictEqual(CalendarManager.escapeHtml('<script>"\'&'), '&lt;script&gt;&quot;&#039;&amp;');

    // Full render test on October 2026 with $10,000 capital
    TradeAnalytics.setCurrency('USD', { silentSync: true, suppressEvent: true });
    TradeAnalytics.setStartingCapital(10000);
    const trades = [
      { ticket: 'D1', symbol: 'XAUUSD', type: 'buy', lots: 0.1, openTime: '2026-10-05T08:00:00Z', closeTime: '2026-10-05T09:00:00Z', profit: 15, broker: 'exness' },   // +0.15% -> pos-1
      { ticket: 'D2', symbol: 'EURUSD', type: 'buy', lots: 0.2, openTime: '2026-10-06T08:00:00Z', closeTime: '2026-10-06T09:00:00Z', profit: 300, broker: 'exness' },  // +3.00% -> pos-5
      { ticket: 'D3', symbol: 'GBPUSD', type: 'sell', lots: 0.1, openTime: '2026-10-07T08:00:00Z', closeTime: '2026-10-07T09:00:00Z', profit: -80, broker: 'exness' }, // -0.80% -> neg-3
      { ticket: 'D4', symbol: 'USDJPY', type: 'buy', lots: 0.1, openTime: '2026-10-08T08:00:00Z', closeTime: '2026-10-08T09:00:00Z', profit: 0, broker: 'exness' }     // 0.00%  -> breakeven
    ];
    const metrics = TradeAnalytics.calculateMetrics(trades, 10000);
    CalendarManager.init(metrics, true);

    assert.strictEqual(document.getElementById('calendarTitle').innerText, 'October 2026');
    assert.ok(document.getElementById('calendarHeatmapLegendNote').textContent.includes('10,000'));

    // Collect rendered active cells from mock DOM
    const cells = document.getElementById('calendarGrid').querySelectorAll('.calendar-day-cell');
    const byDate = {};
    cells.forEach((c) => {
      const k = c.getAttribute('data-date-key');
      if (k) byDate[k] = c;
    });

    assert.strictEqual(byDate['2026-10-05'].getAttribute('data-pnl-tier'), 'pnl-tier-pos-1');
    assert.ok(byDate['2026-10-05'].classList.contains('profit-day'));
    assert.ok(byDate['2026-10-05'].getAttribute('aria-label').includes('+0.15%'));

    assert.strictEqual(byDate['2026-10-06'].getAttribute('data-pnl-tier'), 'pnl-tier-pos-5');
    assert.ok(byDate['2026-10-06'].classList.contains('pnl-tier-pos-5'));

    assert.strictEqual(byDate['2026-10-07'].getAttribute('data-pnl-tier'), 'pnl-tier-neg-3');
    assert.ok(byDate['2026-10-07'].classList.contains('loss-day'));
    assert.ok(byDate['2026-10-07'].getAttribute('aria-label').includes('-0.80%'));

    assert.strictEqual(byDate['2026-10-08'].getAttribute('data-pnl-tier'), 'neutral');
    assert.ok(byDate['2026-10-08'].classList.contains('breakeven-day'));
    assert.strictEqual(byDate['2026-10-08'].getAttribute('tabindex'), '0');
    assert.strictEqual(byDate['2026-10-08'].getAttribute('role'), 'button');
  });

  // ==================== RUNNER ====================
  async function runAll() {
    console.log('================================================================');
    console.log('STARTING THEME MANAGER & CALENDAR HEATMAP VERIFICATION SUITE');
    console.log('================================================================\n');

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
      if (isNode) process.exit(1);
      else if (typeof quit === 'function') quit(1);
    } else {
      if (isNode) process.exit(0);
      else if (typeof quit === 'function') quit(0);
    }
  }

  runAll();
})(typeof globalThis !== 'undefined' ? globalThis : this);
