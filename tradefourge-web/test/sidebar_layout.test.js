/**
 * TradeFourge - YouTube-Style Collapsible Sidebar Regression Test Suite
 *
 * Verifies HTML layout structure, CSS collapsed rail rules, tooltip attributes,
 * desktop toggle & persistence, view navigation state preservation, and mobile separation.
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
    tagName,
    className: '',
    style: {},
    attrs: {},
    listeners: {},
    innerText: '',
    textContent: '',
    children: [],
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
    getBoundingClientRect() {
      return { left: 12, top: 80, right: 60, bottom: 122, width: 48, height: 42 };
    }
  };
  node.classList = createClassList(node);
  return node;
}

function loadAppController({ initialCollapsed = null, innerWidth = 1440 } = {}) {
  const store = new Map();
  if (initialCollapsed !== null) {
    store.set('tradefourge_sidebar_collapsed', String(initialCollapsed));
  }

  const toggleBtn = createMockNode('sidebarToggleBtn', 'BUTTON');
  toggleBtn.setAttribute('aria-expanded', 'true');
  const tooltipEl = createMockNode('sidebarRailTooltip', 'DIV');
  const pageTitleEl = createMockNode('pageTitle', 'H1');
  const sidebarEl = createMockNode('sidebar', 'ASIDE');
  sidebarEl.getBoundingClientRect = () => ({ left: 0, top: 62, right: 72, bottom: 900, width: 72, height: 838 });

  const views = ['dashboard', 'analytics', 'tradelog', 'reports', 'strategy-bot', 'mt5', 'strategies', 'settings'];
  const navItems = views.map((v) => {
    const el = createMockNode('', 'DIV');
    el.className = v === 'dashboard' ? 'nav-item active' : 'nav-item';
    el.setAttribute('data-view', v);
    if (['dashboard', 'analytics', 'tradelog', 'reports', 'strategy-bot', 'settings'].includes(v)) {
      el.setAttribute('data-tooltip', v);
    }
    return el;
  });
  const viewSections = views.map((v) => {
    const el = createMockNode(`view-${v}`, 'SECTION');
    el.className = v === 'dashboard' ? 'view-section active' : 'view-section';
    return el;
  });

  const byId = {
    sidebarToggleBtn: toggleBtn,
    sidebarRailTooltip: tooltipEl,
    pageTitle: pageTitleEl,
    sidebar: sidebarEl
  };
  viewSections.forEach((el) => { byId[el.id] = el; });

  const body = createMockNode('body', 'BODY');
  body.className = 'auth-locked';
  if (initialCollapsed === 'true') {
    body.classList.add('sidebar-collapsed');
  }

  const emittedEvents = [];
  const doc = {
    body,
    createElement(tag) {
      return createMockNode('', tag.toUpperCase());
    },
    getElementById(id) {
      return byId[id] || null;
    },
    querySelector(sel) {
      if (sel === '#sidebar .sidebar-nav') return createMockNode('', 'NAV');
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '#sidebar .nav-item[data-tooltip]') return navItems.filter((n) => n.getAttribute('data-tooltip'));
      if (sel === '.nav-item, .mobile-nav-item') return navItems;
      if (sel === '.view-section') return viewSections;
      return [];
    },
    addEventListener() {}
  };

  const sandbox = {
    window: null,
    document: doc,
    localStorage: {
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { store.set(String(k), String(v)); },
      removeItem(k) { store.delete(String(k)); }
    },
    history: { replaceState() {} },
    innerWidth,
    innerHeight: 900,
    Event: function Event(type) { this.type = type; },
    setTimeout,
    clearTimeout,
    console
  };
  sandbox.window = sandbox;
  sandbox.dispatchEvent = (ev) => emittedEvents.push(ev.type);
  sandbox.addEventListener = () => {};

  const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const context = vm.createContext(sandbox);
  vm.runInContext(appSource, context, { filename: 'js/app.js' });
  context.App.renderReportsView = () => {};
  context.App.renderAnalyticsView = () => {};
  context.App.updateCloudSyncUI = () => {};

  return {
    App: context.App,
    document: doc,
    localStorage: sandbox.localStorage,
    toggleBtn,
    tooltipEl,
    navItems,
    viewSections,
    emittedEvents,
    setInnerWidth(w) { sandbox.innerWidth = w; }
  };
}

function runAll() {
  console.log('================================================================');
  console.log('STARTING SIDEBAR LAYOUT & PERSISTENCE REGRESSION SUITE');
  console.log('================================================================\n');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

  // 1. HTML Structural Checks
  const headerStart = html.indexOf('<header class="top-header">');
  const appBodyStart = html.indexOf('<div class="app-body">');
  const asideStart = html.indexOf('<aside class="sidebar" id="sidebar"');
  const asideEnd = html.indexOf('</aside>', asideStart);
  assert.ok(headerStart > 0 && appBodyStart > headerStart, '.top-header must precede .app-body in .app-layout');
  assert.ok(asideStart > appBodyStart && asideEnd > asideStart, '<aside id="sidebar"> must live inside .app-body');

  const sidebarHtml = html.slice(asideStart, asideEnd);
  assert.ok(!sidebarHtml.includes('brand-logo'), 'Brand logo must NEVER live inside width-changing sidebar container');
  assert.ok(!sidebarHtml.includes('TRADE<span class="brand-name-accent">FOURGE</span>'), 'Wordmark must NEVER live inside width-changing sidebar container');

  const headerHtml = html.slice(headerStart, appBodyStart);
  assert.ok(headerHtml.includes('id="sidebarToggleBtn"'), 'Hamburger toggle button #sidebarToggleBtn must be in fixed top header');
  assert.ok(headerHtml.includes('id="headerBrandLogo"'), 'Stationary #headerBrandLogo must be in fixed top header');
  assert.ok(headerHtml.includes('TRADE<span class="brand-name-accent">FOURGE</span>'), 'TRADEFOURGE wordmark must be in fixed top header');
  assert.ok(html.includes("localStorage.getItem('tradefourge_sidebar_collapsed')"), 'Pre-paint sidebar state loader must exist in HTML');

  // Exact 6 collapsed icons vs 3 expanded-only nav items
  const collapsedAllowed = ['dashboard', 'analytics', 'tradelog', 'reports', 'strategy-bot', 'settings'];
  const expandedOnlyViews = ['mt5', 'strategies'];
  collapsedAllowed.forEach((v) => {
    const m = sidebarHtml.match(new RegExp(`<div class="([^"]*)" data-view="${v}"([^>]*)>`));
    assert.ok(m, `Missing nav item ${v} in sidebar`);
    assert.ok(!m[1].includes('sidebar-expanded-only'), `Nav item ${v} must remain visible in collapsed rail`);
    assert.ok(m[2].includes('data-tooltip='), `Collapsed rail item ${v} must define data-tooltip`);
  });
  expandedOnlyViews.forEach((v) => {
    const m = sidebarHtml.match(new RegExp(`<div class="([^"]*)" data-view="${v}"`));
    assert.ok(m && m[1].includes('sidebar-expanded-only'), `Nav item ${v} must be marked sidebar-expanded-only`);
  });
  assert.ok(
    /class="nav-item install-nav-item sidebar-expanded-only" id="sidebarInstallBtn"/.test(sidebarHtml),
    'Install App item must be marked sidebar-expanded-only'
  );
  console.log('PASS: 1. HTML structure enforces stationary header, 6 collapsed items, and pre-paint restore');

  // 2. CSS Scoping & Dimensions Checks
  assert.ok(css.includes('--sidebar-width: 248px;'), 'Expanded sidebar width must be fixed at 248px');
  assert.ok(css.includes('--sidebar-collapsed-width: 72px;'), 'Collapsed sidebar width must be fixed at 72px');
  assert.ok(/@media \(min-width: 768px\)\s*\{[\s\S]*body\.sidebar-collapsed \.sidebar\s*\{[\s\S]*width:\s*var\(--sidebar-collapsed-width\);/.test(css), 'Desktop collapsed width rule must apply cleanly on >=768px');
  assert.ok(css.includes('.sidebar-rail-tooltip.visible'), 'Collapsed hover tooltip styles must be defined');
  console.log('PASS: 2. CSS defines 248px/72px widths, scoped desktop collapse, and tooltip styling');

  // 3. Runtime Toggle, Persistence, View Navigation & Tooltip Checks
  const env1 = loadAppController({ initialCollapsed: null, innerWidth: 1440 });
  env1.App.initSidebarState();
  assert.strictEqual(env1.document.body.classList.contains('sidebar-collapsed'), false, 'Default initial state is expanded');
  assert.strictEqual(env1.toggleBtn.getAttribute('aria-expanded'), 'true');

  env1.App.toggleSidebar();
  assert.strictEqual(env1.document.body.classList.contains('sidebar-collapsed'), true, 'Hamburger click collapses sidebar');
  assert.strictEqual(env1.localStorage.getItem('tradefourge_sidebar_collapsed'), 'true', 'Collapsed preference saved');
  assert.strictEqual(env1.toggleBtn.getAttribute('aria-expanded'), 'false');

  // Navigating across all 6 collapsed views MUST keep sidebar collapsed
  ['analytics', 'tradelog', 'reports', 'strategy-bot', 'settings', 'dashboard'].forEach((v) => {
    env1.App.switchView(v);
    assert.strictEqual(env1.document.body.classList.contains('sidebar-collapsed'), true, `Navigating to ${v} must not expand sidebar`);
  });

  // Hovering a collapsed icon displays floating tooltip cleanly to the right of 72px sidebar
  env1.App._showSidebarTooltip(env1.navItems[1]); // analytics
  assert.strictEqual(env1.tooltipEl.classList.contains('visible'), true, 'Hover tooltip activates when collapsed');
  assert.strictEqual(env1.tooltipEl.textContent, 'analytics');
  assert.strictEqual(env1.tooltipEl.style.left, '82px', 'Tooltip renders cleanly outside 72px sidebar rail');
  env1.App._hideSidebarTooltip();
  assert.strictEqual(env1.tooltipEl.classList.contains('visible'), false);
  console.log('PASS: 3. Toggle, navigation state preservation, and hover tooltips behave accurately');

  // 4. Reload Persistence & Mobile Drawer Independence
  const envReload = loadAppController({ initialCollapsed: 'true', innerWidth: 1440 });
  envReload.App.initSidebarState();
  assert.strictEqual(envReload.document.body.classList.contains('sidebar-collapsed'), true, 'Collapsed state restores on reload');
  assert.strictEqual(envReload.toggleBtn.getAttribute('aria-expanded'), 'false');

  // Switching to mobile toggles mobile drawer without clobbering saved desktop preference
  envReload.setInnerWidth(390);
  envReload.App.toggleSidebar();
  assert.strictEqual(envReload.document.body.classList.contains('sidebar-mobile-open'), true, 'Mobile toggle opens off-canvas drawer');
  assert.strictEqual(envReload.localStorage.getItem('tradefourge_sidebar_collapsed'), 'true', 'Mobile drawer must not overwrite desktop collapse preference');
  envReload.App.toggleSidebar();
  assert.strictEqual(envReload.document.body.classList.contains('sidebar-mobile-open'), false, 'Second mobile toggle closes drawer');
  console.log('PASS: 4. Reload persistence & mobile drawer isolation verified');

  console.log('\nSummary: 4 passed, 0 failed (4 total).');
}

runAll();
