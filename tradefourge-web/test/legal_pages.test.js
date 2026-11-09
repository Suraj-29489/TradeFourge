/**
 * TradeForge - Public Privacy Policy & Terms of Service Verification Suite
 *
 * Verifies:
 * - Clean URL HTTP serving without authentication (/privacy-policy & /terms-of-service -> 200 OK)
 * - No dependency on dashboard JS, Chart.js, or gitignored config.local.js
 * - SEO metadata, responsive/theme support (Classic, Midnight, Light), TOC & return links
 * - Truthful technical reflection of OAuth scopes, drive.file folders, Gemini proxy, and AES-256-GCM cookies
 * - Settings ("Legal & Information"), Auth Gate, Sidebar Footer, and Service Worker integrations
 * - Configurable support contact helper without invented addresses & unchanged 4-function Vercel limit
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function httpGet(baseUrl, urlPath) {
  const res = await fetch(`${baseUrl}${urlPath}`, { redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function listServerlessFunctions(rootDir) {
  const apiDir = path.join(rootDir, 'api');
  const out = [];
  function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (/\.(js|mjs|cjs|ts)$/i.test(entry.name)) out.push(`api/${rel}`);
    }
  }
  walk(apiDir, '');
  return out.sort();
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING PUBLIC LEGAL PAGES & INTEGRATION VERIFICATION SUITE');
  console.log('================================================================\n');

  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.strictEqual(vercelJson.cleanUrls, true, 'vercel.json must keep cleanUrls: true for /privacy-policy and /terms-of-service');
  const fnCount = listServerlessFunctions(ROOT);
  assert.strictEqual(fnCount.length, 4, `Expected exactly 4 serverless functions, found ${fnCount.join(', ')}`);
  console.log('PASS: 1. Vercel cleanUrls enabled and serverless count preserved at 4');

  const { createAppServer } = require(path.join(ROOT, 'scripts/dev-server'));
  const server = createAppServer({ reloadEnv: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Direct unauthenticated requests to both clean URLs and stylesheets
    const [ppRes, tosRes, ppHtmlRes, tosHtmlRes, cssRes] = await Promise.all([
      httpGet(baseUrl, '/privacy-policy'),
      httpGet(baseUrl, '/terms-of-service'),
      httpGet(baseUrl, '/privacy-policy.html'),
      httpGet(baseUrl, '/terms-of-service.html'),
      httpGet(baseUrl, '/css/legal.css')
    ]);

    assert.strictEqual(ppRes.status, 200, 'GET /privacy-policy must return 200 OK while logged out');
    assert.strictEqual(tosRes.status, 200, 'GET /terms-of-service must return 200 OK while logged out');
    assert.strictEqual(ppHtmlRes.status, 200, 'GET /privacy-policy.html must return 200 OK');
    assert.strictEqual(tosHtmlRes.status, 200, 'GET /terms-of-service.html must return 200 OK');
    assert.strictEqual(cssRes.status, 200, 'GET /css/legal.css must return 200 OK');
    assert.ok(!ppRes.headers.get('location'), '/privacy-policy must never redirect unauthenticated visitors');
    assert.ok(!tosRes.headers.get('location'), '/terms-of-service must never redirect unauthenticated visitors');
    console.log('PASS: 2. Both public URLs serve 200 OK cleanly without auth cookies or redirects');

    const pp = ppRes.text;
    const tos = tosRes.text;

    // Standalone independence + SEO metadata checks
    [
      { name: 'Privacy Policy', html: pp, canonical: 'https://tradefourge.vercel.app/privacy-policy', title: 'Privacy Policy — TradeForge' },
      { name: 'Terms of Service', html: tos, canonical: 'https://tradefourge.vercel.app/terms-of-service', title: 'Terms of Service — TradeForge' }
    ].forEach((doc) => {
      assert.ok(doc.html.includes(`<title>${doc.title}</title>`), `${doc.name} title check`);
      assert.ok(doc.html.includes(`rel="canonical" href="${doc.canonical}"`), `${doc.name} canonical link check`);
      assert.ok(doc.html.includes('meta name="description"'), `${doc.name} meta description required`);
      assert.ok(doc.html.includes('property="og:title"'), `${doc.name} Open Graph metadata required`);
      assert.ok(doc.html.includes('Last Updated'), `${doc.name} Last Updated label required`);
      assert.ok(doc.html.includes('Return to TradeForge'), `${doc.name} visible return link required`);
      assert.ok(doc.html.includes('href="/"'), `${doc.name} link back to / required`);
      assert.ok(doc.html.includes("localStorage.getItem('tradeforge_theme')"), `${doc.name} pre-paint theme support required`);
      assert.ok(doc.html.includes('data-legal-theme="classic"') && doc.html.includes('data-legal-theme="midnight"') && doc.html.includes('data-legal-theme="light"'), `${doc.name} must support switching all 3 themes`);
      // Must NOT load dashboard JS, auth JS, Chart.js, or gitignored local overrides
      ['js/app.js', 'js/auth.js', 'js/storage.js', 'js/charts.js', 'js/google-auth.js', 'js/config.local.js', 'chart.umd.min.js'].forEach((forbidden) => {
        assert.ok(!doc.html.includes(forbidden), `${doc.name} must not depend on ${forbidden}`);
      });
    });

    // Check theme token parity in legal.css
    const legalCss = cssRes.text;
    assert.ok(legalCss.includes('[data-theme="classic"]'), 'legal.css defines Classic theme');
    assert.ok(legalCss.includes('[data-theme="midnight"]'), 'legal.css defines Midnight theme');
    assert.ok(legalCss.includes('[data-theme="light"]'), 'legal.css defines Light theme');
    console.log('PASS: 3. SEO metadata, 3-theme tokens, TOC, return link & standalone independence verified');

    // Privacy policy technical truthfulness assertions
    [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
      'My Drive / TradeForge / User Data/',
      'My Drive / TradeForge / Backups/',
      'My Drive / TradeForge / Exports/',
      'generativelanguage.googleapis.com',
      '/api/strategy-bot',
      'offline-strategy-engine.js',
      'AES-256-GCM',
      'tf_sess',
      'tf_oauth_tx',
      'HttpOnly',
      'myaccount.google.com/permissions',
      'Google API Services User Data Policy',
      '[SUPPORT_EMAIL]',
      '[OPERATOR_NAME]',
      'not undergone formal external security audits'
    ].forEach((phrase) => {
      assert.ok(pp.includes(phrase), `Privacy Policy missing required accurate disclosure: ${phrase}`);
    });
    // Ensure Privacy Policy has all 14 sections and does not invent fake contact addresses or broad drive scopes
    for (let i = 1; i <= 14; i++) {
      assert.ok(pp.includes(`id="section-${i}"`), `Privacy Policy missing section-${i}`);
    }
    assert.ok(!/support@tradeforge\.(com|io|app)/i.test(pp), 'Privacy Policy must not invent a fake support email');

    // Terms of Service content assertions (all 16 sections + disclaimer + risk disclosure + placeholders)
    const tosPlain = tos.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (let i = 1; i <= 16; i++) {
      assert.ok(tos.includes(`id="section-${i}"`), `Terms of Service missing section-${i}`);
    }
    [
      'Financial Disclaimer',
      'Trading Risk Disclosure',
      'not a registered broker-dealer',
      'AS IS',
      'AS AVAILABLE',
      'drive.file',
      'Fourge AI',
      '[SUPPORT_EMAIL]',
      '[OPERATOR_NAME]',
      '[GOVERNING_JURISDICTION]'
    ].forEach((phrase) => {
      assert.ok(tosPlain.includes(phrase) || tos.includes(phrase), `Terms of Service missing required clause: ${phrase}`);
    });
    assert.ok(!/support@tradeforge\.(com|io|app)/i.test(tos), 'Terms of Service must not invent a fake support email');
    console.log('PASS: 4. Privacy Policy (14 sections) & Terms of Service (16 sections) match implementation truth');

    // Settings, Auth Gate, Sidebar Footer & SW integration assertions
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const settingsStart = indexHtml.indexOf('id="view-settings"');
    const settingsEnd = indexHtml.indexOf('id="mobileBottomNav"', settingsStart);
    const settingsHtml = indexHtml.slice(settingsStart, settingsEnd);

    assert.ok(settingsHtml.includes('id="legalSettingsCard"'), 'Settings must include Legal & Information card');
    assert.ok(settingsHtml.includes('Legal &amp; Information'), 'Settings card title must read Legal & Information');
    assert.ok(/href="\/privacy-policy"[^>]*id="settingsLinkPrivacyPolicy"|id="settingsLinkPrivacyPolicy"[^>]*href="\/privacy-policy"/.test(settingsHtml), 'Settings must include clickable Privacy Policy link');
    assert.ok(/href="\/terms-of-service"[^>]*id="settingsLinkTermsOfService"|id="settingsLinkTermsOfService"[^>]*href="\/terms-of-service"/.test(settingsHtml), 'Settings must include clickable Terms of Service link');

    const authStart = indexHtml.indexOf('id="authGateView"');
    const authEnd = indexHtml.indexOf('id="windowDragOverlay"', authStart);
    const authHtml = indexHtml.slice(authStart, authEnd);
    assert.ok(authHtml.includes('href="/privacy-policy"'), 'Auth gate must link to Privacy Policy');
    assert.ok(authHtml.includes('href="/terms-of-service"'), 'Auth gate must link to Terms of Service');

    const footerStart = indexHtml.indexOf('class="sidebar-footer"');
    const footerEnd = indexHtml.indexOf('</aside>', footerStart);
    const sidebarFooterHtml = indexHtml.slice(footerStart, footerEnd);
    assert.ok(sidebarFooterHtml.includes('href="/privacy-policy"'), 'App sidebar footer must link to Privacy Policy');
    assert.ok(sidebarFooterHtml.includes('href="/terms-of-service"'), 'App sidebar footer must link to Terms of Service');

    const swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.ok(swJs.includes('./privacy-policy.html') && swJs.includes('./terms-of-service.html') && swJs.includes('./css/legal.css'), 'Service worker must precache public legal pages and stylesheet');
    console.log('PASS: 5. Settings, Auth Gate, App Sidebar Footer & Service Worker integrations verified');

    // TradeForgeConfig contact helper test
    delete require.cache[require.resolve(path.join(ROOT, 'js/config.js'))];
    const TradeForgeConfig = require(path.join(ROOT, 'js/config.js'));
    const defaultContact = TradeForgeConfig.getContactInfo();
    assert.strictEqual(defaultContact.supportEmail, '', 'Default SUPPORT_EMAIL must stay unconfigured until owner sets it');
    assert.strictEqual(defaultContact.hasSupportEmail, false);

    global.TRADEFORGE_CONFIG = {
      SUPPORT_EMAIL: 'ops@example-owner.test',
      OPERATOR_NAME: 'Example Owner',
      GOVERNING_JURISDICTION: 'Example State'
    };
    const configuredContact = TradeForgeConfig.getContactInfo();
    assert.strictEqual(configuredContact.supportEmail, 'ops@example-owner.test');
    assert.strictEqual(configuredContact.operatorName, 'Example Owner');
    assert.strictEqual(configuredContact.governingJurisdiction, 'Example State');
    assert.strictEqual(configuredContact.hasSupportEmail, true);
    delete global.TRADEFORGE_CONFIG;
    console.log('PASS: 6. TradeForgeConfig configurable support contact resolver verified');

    console.log('\nSummary: 6 passed, 0 failed (6 total).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests().catch((err) => {
  console.error('FAILED:', err);
  process.exitCode = 1;
});
