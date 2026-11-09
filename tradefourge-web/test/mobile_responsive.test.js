/**
 * TradeFourge - Complete Mobile UI/UX Responsive Redesign Test Suite
 *
 * Verifies:
 * 1. Breakpoints (320-767px mobile, 768-1023px tablet, >=1024px desktop) & CSS isolation (PDF/print untouched)
 * 2. Native-app mobile navigation: stationary header, Escape/resize/backdrop drawer close, exact 5 bottom nav items
 * 3. Mobile dashboard toolbar actions & bidirectional date range sync
 * 4. Shared-logic card rendering in Recent Trade Executions & Trade Log (items, empty state, modal drilldown)
 * 5. Virtual keyboard detection (mobile-keyboard-open + --mobile-vv-height), Fourge AI focus guard, & calendar touch tooltip suppression
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function createClassList(holder) {
  return {
    add(...cls) {
      const set = new Set(String(holder.className || '').split(/\s+/).filter(Boolean));
      cls.forEach((c) => set.add(c));
      holder.className = Array.from(set).join(' ');
    },
    remove(...cls) {
      const rm = new Set(cls);
      holder.className = String(holder.className || '').split(/\s+/).filter((c) => c && !rm.has(c)).join(' ');
    },
    toggle(c, force) {
      const has = this.contains(c);
      const next = force !== undefined ? Boolean(force) : !has;
      if (next) this.add(c);
      else this.remove(c);
      return next;
    },
    contains(c) {
      return String(holder.className || '').split(/\s+/).includes(c);
    }
  };
}

function createMockNode(id = '', tagName = 'DIV') {
  const node = {
    id,
    tagName: String(tagName).toUpperCase(),
    className: '',
    style: {
      setProperty(k, v) {
        this[k] = v;
      }
    },
    attrs: {},
    listeners: {},
    innerText: '',
    textContent: '',
    _innerHTML: '',
    value: '',
    type: '',
    children: [],
    focusCalled: false,
    set innerHTML(val) {
      this._innerHTML = String(val);
      if (val === '') this.children = [];
    },
    get innerHTML() {
      return this._innerHTML;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
    },
    addEventListener(type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    },
    dispatchEvent(ev) {
      const list = this.listeners[ev.type] || [];
      list.forEach((fn) => fn(ev));
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} });
    },
    contains(other) {
      return other === this || this.children.includes(other);
    },
    focus() {
      this.focusCalled = true;
    },
    querySelector(sel) {
      if (this._queryMap && this._queryMap[sel]) return this._queryMap[sel];
      return this.children.find((ch) => ch.attrs && ch.attrs.value && sel.includes(ch.attrs.value)) || null;
    },
    getBoundingClientRect() {
      return { left: 10, top: 80, right: 110, bottom: 160, width: 100, height: 80 };
    }
  };
  node.classList = createClassList(node);
  return node;
}

function createAppHarness({ innerWidth = 375, innerHeight = 812, hoverFine = false } = {}) {
  const byId = {};
  const register = (id, tag = 'DIV') => {
    const node = createMockNode(id, tag);
    byId[id] = node;
    return node;
  };

  const toggleBtn = register('sidebarToggleBtn', 'BUTTON');
  toggleBtn.setAttribute('aria-expanded', 'true');
  const headerBrandLogo = register('headerBrandLogo', 'DIV');
  const sidebarCloseBtn = register('sidebarCloseBtn', 'BUTTON');
  const sidebarBackdrop = register('sidebarBackdrop', 'DIV');
  const sidebar = register('sidebar', 'ASIDE');
  const pageTitle = register('pageTitle', 'H1');
  const addTradeModal = register('addTradeModal', 'DIV');
  addTradeModal.className = 'modal-overlay';
  const uploadModal = register('uploadModal', 'DIV');
  uploadModal.className = 'modal-overlay';
  const btnAddTradeMobileQuick = register('btnAddTradeMobileQuick', 'BUTTON');
  const btnImportCsvMobileQuick = register('btnImportCsvMobileQuick', 'BUTTON');
  const customDatePopover = register('customDatePopover', 'DIV');
  customDatePopover.style.display = 'none';

  const makeDateSelect = (id) => {
    const sel = register(id, 'SELECT');
    sel.value = 'all';
    const customOpt = createMockNode('', 'OPTION');
    customOpt.setAttribute('value', 'custom');
    customOpt.innerText = 'Custom';
    sel.appendChild(customOpt);
    sel._queryMap = { 'option[value="custom"]': customOpt };
    return sel;
  };

  const headerDateRangeSelect = makeDateSelect('headerDateRangeSelect');
  const mobileDateRangeSelect = makeDateSelect('mobileDateRangeSelect');

  const recentTradesTableBody = register('recentTradesTableBody', 'TBODY');
  const recentTradesMobileList = register('recentTradesMobileList', 'DIV');
  const tradeLogTableBody = register('tradeLogTableBody', 'TBODY');
  const tradeLogMobileList = register('tradeLogMobileList', 'DIV');
  const tradeLogPageInfo = register('tradeLogPageInfo', 'SPAN');

  const dateFilterWrapper = createMockNode('', 'DIV');
  dateFilterWrapper.className = 'date-filter-wrapper';
  const mobileDateFilterWrap = createMockNode('', 'DIV');
  mobileDateFilterWrap.className = 'mobile-date-filter';
  const contentScroll = createMockNode('', 'DIV');
  contentScroll.className = 'content-scroll';
  contentScroll.scrollTop = 320;

  const botChatInput = register('botChatInput', 'TEXTAREA');

  const docListeners = {};
  const winListeners = {};
  const vvListeners = {};

  const body = createMockNode('body', 'BODY');
  body.contains = () => true;
  const documentElement = createMockNode('html', 'HTML');
  const activeModals = () => [addTradeModal, uploadModal].filter((m) => m.classList.contains('active'));

  const doc = {
    body,
    documentElement,
    activeElement: body,
    createElement(tag) {
      return createMockNode('', tag);
    },
    getElementById(id) {
      return byId[id] || null;
    },
    querySelector(sel) {
      if (sel === '.date-filter-wrapper') return dateFilterWrapper;
      if (sel === '.mobile-date-filter') return mobileDateFilterWrap;
      if (sel === '.content-scroll') return contentScroll;
      if (sel === '#sidebar .sidebar-nav') return createMockNode('', 'NAV');
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.modal-overlay.active') return activeModals();
      if (sel === '.modal-overlay') return [addTradeModal, uploadModal];
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    dispatchEvent(ev) {
      (docListeners[ev.type] || []).forEach((fn) => fn(ev));
    }
  };

  const sandbox = {
    window: null,
    document: doc,
    localStorage: {
      _map: new Map(),
      getItem(k) { return this._map.has(k) ? this._map.get(k) : null; },
      setItem(k, v) { this._map.set(String(k), String(v)); },
      removeItem(k) { this._map.delete(String(k)); }
    },
    history: { replaceState() {} },
    location: { hash: '' },
    innerWidth,
    innerHeight,
    visualViewport: {
      height: innerHeight,
      addEventListener(type, fn) {
        if (!vvListeners[type]) vvListeners[type] = [];
        vvListeners[type].push(fn);
      },
      dispatch(type) {
        (vvListeners[type] || []).forEach((fn) => fn({ type }));
      }
    },
    matchMedia(query) {
      if (query.includes('hover: hover')) {
        return { matches: hoverFine };
      }
      return { matches: false };
    },
    addEventListener(type, fn) {
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push(fn);
    },
    dispatchEvent(ev) {
      (winListeners[ev.type] || []).forEach((fn) => fn(ev));
    },
    Event: function Event(type) { this.type = type; },
    TradeAnalytics: {
      formatCurrency(val, withPlus = true) {
        const n = Number(val) || 0;
        const prefix = n > 0 ? (withPlus ? '+$' : '$') : (n < 0 ? '-$' : '$');
        return `${prefix}${Math.abs(n).toFixed(2)}`;
      },
      getTradeDate(t) {
        return (t.closeTime || t.openTime || '').slice(0, 10);
      },
      formatDateIst(d) {
        return new Date(d).toISOString().slice(0, 10);
      },
      calculateMetrics() {
        return { dailyMap: {} };
      }
    },
    ChartManager: {
      updateDashboardCharts() {},
      renderReportsView() {},
      renderAnalyticsView() {}
    },
    setTimeout(fn, ms) {
      if (ms <= 200) fn();
      return 1;
    },
    clearTimeout() {},
    console
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  const calendarSrc = fs.readFileSync(path.join(ROOT, 'js/calendar.js'), 'utf8');
  const botSrc = fs.readFileSync(path.join(ROOT, 'js/strategy-bot.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

  vm.runInContext(calendarSrc, context, { filename: 'js/calendar.js' });
  vm.runInContext(botSrc, context, { filename: 'js/strategy-bot.js' });
  vm.runInContext(appSrc, context, { filename: 'js/app.js' });

  // Neutralize heavyweight render hooks during targeted unit tests
  context.App.updateHeaderInfo = () => {};
  context.App.updateCustomDateBounds = () => {};
  context.App.updateKPICards = () => {};
  context.App.renderWeeklyPerformance = () => {};
  context.App.renderPnLPerformance = () => {};
  context.App.renderProfitSource = () => {};
  context.App.renderExitBreakdown = () => {};
  context.App.renderReportsView = () => {};
  context.App.renderAnalyticsView = () => {};
  context.App.renderInsightsView = () => {};
  context.App.renderStrategiesView = () => {};
  context.App.updateStorageIndicator = () => {};
  context.App.initWeeklyPerformance = () => {};
  context.App.initPnLPerformance = () => {};
  context.App.initTradeLogControls = () => {};
  context.App.initCalendar = () => {};
  context.App.initExitBreakdownControls = () => {};
  context.App.initReportsControls = () => {};
  context.App.initReportListeners = () => {};
  context.App.initAnalyticsControls = () => {};
  context.App.initAddTradeModal = () => {};
  context.App.initStartingCapitalModal = () => {};
  context.App.initTradeDetailModal = () => {};
  context.App.initWindowDragAndDrop = () => {};
  context.App.updateCloudSyncUI = () => {};
  context.App.showToast = () => {};

  return {
    sandbox,
    App: context.App,
    CalendarManager: context.CalendarManager,
    StrategyBotManager: context.StrategyBotManager,
    doc,
    byId,
    contentScroll
  };
}

function runTests() {
  console.log('================================================================');
  console.log('STARTING MOBILE UI/UX RESPONSIVE REDESIGN VERIFICATION SUITE');
  console.log('================================================================\n');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');
  const authCss = fs.readFileSync(path.join(ROOT, 'css/auth.css'), 'utf8');
  const legalCss = fs.readFileSync(path.join(ROOT, 'css/legal.css'), 'utf8');

  // 1. HTML Structure & Bottom Nav Exact 5 Items
  const bottomNavStart = html.indexOf('id="mobileBottomNav"');
  const bottomNavEnd = html.indexOf('</nav>', bottomNavStart);
  assert.ok(bottomNavStart > 0 && bottomNavEnd > bottomNavStart, '#mobileBottomNav must exist in index.html');
  const bottomNavHtml = html.slice(bottomNavStart, bottomNavEnd);
  const bottomNavViews = [...bottomNavHtml.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(
    bottomNavViews,
    ['dashboard', 'analytics', 'tradelog', 'reports', 'strategy-bot'],
    'Mobile bottom navigation must display exact 5 destinations'
  );
  assert.ok(html.includes('id="mobileDashboardToolbar"'), 'Dashboard must contain #mobileDashboardToolbar');
  assert.ok(html.includes('id="mobileDateRangeSelect"'), 'Dashboard mobile toolbar must contain #mobileDateRangeSelect');
  assert.ok(html.includes('id="btnAddTradeMobileQuick"'), 'Dashboard mobile toolbar must contain #btnAddTradeMobileQuick');
  assert.ok(html.includes('id="btnImportCsvMobileQuick"'), 'Dashboard mobile toolbar must contain #btnImportCsvMobileQuick');
  assert.ok(html.includes('id="recentTradesMobileList"'), 'Recent trades card must contain #recentTradesMobileList');
  assert.ok(html.includes('id="tradeLogMobileList"'), 'Trade log view must contain #tradeLogMobileList');
  assert.ok(!html.includes("getElementById('btnAddTradeSidebar')"), 'Dead #btnAddTradeSidebar button onclick reference must be removed');
  assert.ok(html.includes('App.openAddTradeModal()'), 'Playbooks CTA must invoke App.openAddTradeModal()');
  console.log('PASS: 1. HTML mobile toolbar, card containers, Playbooks CTA & exact 5 bottom-nav destinations verified');

  // 2. CSS Breakpoints, Keyboard Hide, Touch Tooltip & PDF/Print Protection
  assert.ok(!styleCss.includes('max-width: 768px') && !styleCss.includes('min-width: 769px'), 'style.css must align consistently at 767px/768px');
  assert.ok(!compCss.includes('max-width: 768px'), 'components.css must align consistently at <= 767px');
  assert.ok(!authCss.includes('max-width: 768px'), 'auth.css must align consistently at <= 767px');
  assert.ok(styleCss.includes('@media (max-width: 1023px)'), 'style.css must support tablet breakpoint <= 1023px');
  assert.ok(styleCss.includes('@media (max-width: 429px)'), 'style.css must support narrow phone breakpoint <= 429px');
  assert.ok(styleCss.includes('html:has(body.sidebar-mobile-open)'), 'Drawer open must lock background scrolling');
  assert.ok(styleCss.includes('body.mobile-keyboard-open .mobile-bottom-nav'), 'Virtual keyboard open must hide bottom nav');
  assert.ok(compCss.includes('.trading-report-sheet:not(.rep-pdf-single-page)'), 'Responsive report rules must preserve .rep-pdf-single-page layout');
  assert.ok(compCss.includes('@media (hover: none), (pointer: coarse)'), 'Calendar tooltips must be disabled on touch devices via CSS');
  assert.ok(compCss.includes('box-shadow: none !important'), 'Calendar heatmap mobile cells must suppress heavy glow shadows');
  assert.ok(legalCss.includes('@media (max-width: 960px)') && legalCss.includes('@media (max-width: 680px)'), 'legal.css responsive breakpoints preserved');
  console.log('PASS: 2. Responsive breakpoints, scroll lock, keyboard hiding, touch suppression & PDF print isolation verified');

  // 3. Viewport Breakpoint, Escape Drawer Close & Resize Recovery
  const h = createAppHarness({ innerWidth: 375, innerHeight: 812, hoverFine: false });
  h.App.initSidebarState();
  h.App.initMobileViewportHandling();
  h.App.bindEvents();

  assert.strictEqual(h.App.isMobileViewport(), true, '375px is mobile');
  h.sandbox.innerWidth = 767;
  assert.strictEqual(h.App.isMobileViewport(), true, '767px is mobile');
  h.sandbox.innerWidth = 768;
  assert.strictEqual(h.App.isMobileViewport(), false, '768px is tablet/desktop boundary');
  h.sandbox.innerWidth = 375;

  // Open mobile drawer and test Escape closes it + updates ARIA
  h.App.toggleSidebar();
  assert.strictEqual(h.doc.body.classList.contains('sidebar-mobile-open'), true);
  assert.strictEqual(h.byId.sidebarToggleBtn.getAttribute('aria-expanded'), 'true');
  h.doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.strictEqual(h.doc.body.classList.contains('sidebar-mobile-open'), false, 'Escape key closes mobile drawer');
  assert.strictEqual(h.byId.sidebarToggleBtn.getAttribute('aria-expanded'), 'false');

  // Reopen drawer and resize to tablet 768px
  h.App.toggleSidebar();
  assert.strictEqual(h.doc.body.classList.contains('sidebar-mobile-open'), true);
  h.sandbox.innerWidth = 768;
  h.sandbox.dispatchEvent({ type: 'resize' });
  assert.strictEqual(h.doc.body.classList.contains('sidebar-mobile-open'), false, 'Resizing to >=768px closes mobile drawer');
  h.sandbox.innerWidth = 375;

  // Clicking header brand logo switches to dashboard and resets mobile scrollTop
  h.contentScroll.scrollTop = 450;
  h.byId.headerBrandLogo.click();
  assert.strictEqual(h.App.activeView, 'dashboard');
  assert.strictEqual(h.contentScroll.scrollTop, 0, 'Mobile view switch resets scroll position cleanly');
  console.log('PASS: 3. Breakpoint detection, Escape drawer close, resize cleanup & header logo nav verified');

  // 4. Mobile Toolbar Quick Actions & Bidirectional Date Range Sync
  h.byId.btnAddTradeMobileQuick.click();
  assert.strictEqual(h.byId.addTradeModal.classList.contains('active'), true, 'Mobile Add Trade button opens #addTradeModal');
  h.doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.strictEqual(h.byId.addTradeModal.classList.contains('active'), false, 'Escape closes modal');

  h.byId.btnImportCsvMobileQuick.click();
  assert.strictEqual(h.byId.uploadModal.classList.contains('active'), true, 'Mobile Upload CSV button opens #uploadModal');
  h.byId.uploadModal.classList.remove('active');

  h.byId.mobileDateRangeSelect.value = 'last30';
  h.byId.mobileDateRangeSelect.dispatchEvent({ type: 'change', target: h.byId.mobileDateRangeSelect });
  assert.strictEqual(h.App.dateFilter, 'last30');
  assert.strictEqual(h.byId.headerDateRangeSelect.value, 'last30', 'Mobile filter change syncs to desktop header selector');

  h.byId.headerDateRangeSelect.value = 'all';
  h.byId.headerDateRangeSelect.dispatchEvent({ type: 'change', target: h.byId.headerDateRangeSelect });
  assert.strictEqual(h.App.dateFilter, 'all');
  assert.strictEqual(h.byId.mobileDateRangeSelect.value, 'all', 'Desktop filter change syncs back to mobile selector');

  h.App.applyCustomDateRange('2026-10-01', '2026-10-15');
  assert.strictEqual(h.byId.headerDateRangeSelect.value, 'custom');
  assert.strictEqual(h.byId.mobileDateRangeSelect.value, 'custom', 'Custom range updates mobile selector too');
  assert.ok(
    h.byId.mobileDateRangeSelect.querySelector('option[value="custom"]').innerText.includes('Custom ('),
    'Custom option label synced on mobile selector'
  );
  console.log('PASS: 4. Mobile quick toolbar buttons & bidirectional date filter sync verified');

  // 5. Shared Data Card Rendering & Detail Modal Opening
  const openedTrades = [];
  h.App.openTradeDetailModal = (t) => openedTrades.push(t);
  const sampleTrades = [
    { ticket: '1001', symbol: 'XAUUSD', type: 'buy', lots: 0.25, openPrice: 2650, closePrice: 2662, openTime: '2026-10-10T08:00:00Z', closeTime: '2026-10-10T09:30:00Z', closeReason: 'tp', profit: 300 },
    { ticket: '1002', symbol: 'EURUSD', type: 'sell', lots: 0.5, openPrice: 1.09, closePrice: 1.092, openTime: '2026-10-11T10:00:00Z', closeTime: '2026-10-11T11:15:00Z', closeReason: 'sl', profit: -100 }
  ];
  h.App.trades = [...sampleTrades];
  h.App.filteredTrades = [...sampleTrades];

  h.App.renderRecentTradesTable();
  assert.strictEqual(h.byId.recentTradesTableBody.children.length, 2, 'Desktop recent table renders 2 rows');
  assert.strictEqual(h.byId.recentTradesMobileList.children.length, 2, 'Mobile recent card list renders 2 cards');
  h.byId.recentTradesMobileList.children[0].click();
  assert.strictEqual(openedTrades[0].ticket, '1002', 'Tapping recent mobile card opens matching newest trade modal');

  h.App.renderTradeLogTable();
  assert.strictEqual(h.byId.tradeLogTableBody.children.length, 2, 'Desktop trade log renders 2 rows');
  assert.strictEqual(h.byId.tradeLogMobileList.children.length, 2, 'Mobile trade log card list renders 2 cards');
  h.byId.tradeLogMobileList.children[1].click();
  assert.strictEqual(openedTrades[1].ticket, '1001', 'Tapping trade log mobile card opens matching trade modal');

  // Empty state renders in both table and mobile list
  h.App.filteredTrades = [];
  h.App.renderRecentTradesTable();
  assert.ok(h.byId.recentTradesMobileList.innerHTML.includes('mobile-trade-empty'), 'Recent empty state renders mobile card placeholder');
  h.App.renderTradeLogTable();
  assert.ok(h.byId.tradeLogMobileList.innerHTML.includes('mobile-trade-empty'), 'Trade log empty state renders mobile card placeholder');
  console.log('PASS: 5. Shared-data mobile trade cards, modal clicks & empty states verified');

  // 6. Virtual Keyboard Detection, Fourge AI Focus Guard & Touch Calendar Tooltip Suppression
  // Input focusin sets mobile-keyboard-open
  const textInput = createMockNode('searchInput', 'INPUT');
  textInput.type = 'search';
  h.doc.activeElement = textInput;
  h.doc.dispatchEvent({ type: 'focusin', target: textInput });
  assert.strictEqual(h.doc.body.classList.contains('mobile-keyboard-open'), true, 'Focusing mobile input toggles mobile-keyboard-open');

  // Simulated visualViewport shrink sets --mobile-vv-height and maintains keyboard open state
  h.sandbox.visualViewport.height = 430;
  h.sandbox.visualViewport.dispatch('resize');
  assert.strictEqual(h.doc.documentElement.style['--mobile-vv-height'], '430px', '--mobile-vv-height tracks visualViewport height');
  assert.strictEqual(h.doc.body.classList.contains('mobile-keyboard-open'), true);

  // Blurring and restoring full viewport removes mobile-keyboard-open
  h.doc.activeElement = h.doc.body;
  h.sandbox.visualViewport.height = 812;
  h.doc.dispatchEvent({ type: 'focusout', target: textInput });
  assert.strictEqual(h.doc.body.classList.contains('mobile-keyboard-open'), false, 'Dismissing mobile keyboard removes mobile-keyboard-open');

  // Fourge AI does NOT auto-focus input on mobile
  h.byId.botChatInput.focusCalled = false;
  h.StrategyBotManager.onViewActivated();
  assert.strictEqual(h.byId.botChatInput.focusCalled, false, 'Fourge AI must not auto-focus chat input on mobile viewport');

  // On desktop (>=768px), Fourge AI DOES focus input cleanly
  h.sandbox.innerWidth = 1366;
  h.StrategyBotManager.onViewActivated();
  assert.strictEqual(h.byId.botChatInput.focusCalled, true, 'Fourge AI auto-focuses chat input on desktop viewport');
  h.sandbox.innerWidth = 375;

  // Calendar hover tooltip suppressed on touch / mobile viewports
  assert.strictEqual(h.CalendarManager.supportsHoverTooltip(), false, 'Touch/mobile viewport suppresses calendar hover tooltip');
  h.CalendarManager.showTooltipForCell(createMockNode('', 'DIV'), { dateDisplay: 'Oct 10', trades: 1, wins: 1, losses: 0, pnl: 100 });
  assert.strictEqual(h.byId.calHeatmapTooltip || h.CalendarManager._tooltipEl, null, 'showTooltipForCell must not create tooltip on touch/mobile');

  let hideCalled = false;
  h.CalendarManager.hideTooltip = () => { hideCalled = true; };
  h.App.switchView('analytics');
  assert.strictEqual(hideCalled, true, 'Switching views hides any open calendar tooltip');
  console.log('PASS: 6. Keyboard detection, Fourge AI focus guard & touch calendar suppression verified');

  console.log('\nSummary: 6 passed, 0 failed (6 total).');
}

runTests();
