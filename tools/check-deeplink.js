#!/usr/bin/env node
/* Deep-link checks: ?mode=bench opens the Mixing Bench (with or without ?course=), and the plain URL still opens the normal start screen.
   Loads index.html in Chromium at a phone size (390×844, touch) and a desktop size; fails on any console error.
   Usage: NODE_PATH=<node_modules with playwright> node tools/check-deeplink.js */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright not found. Run with NODE_PATH pointing at a node_modules that has playwright, e.g.\n  NODE_PATH=/path/to/node_modules node tools/check-deeplink.js'); process.exit(2); }
const path = require('path'), fs = require('fs'), url = require('url');
const ROOT = path.join(__dirname, '..'), GH = path.join(ROOT, '..');
const page0 = url.pathToFileURL(path.join(ROOT, 'index.html')).href;
const SIZES = [['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1280, height: 900 } }]];
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (!c) { fail++; console.log('FAIL', m); } };
/* offline and repeatable: itsdrdan.github.io/<repo>/… is served from the sibling local clone when it exists; every other web request gets an empty reply */
async function route(ctx) {
  await ctx.route(/^https?:/, r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'itsdrdan.github.io') { const f = path.join(GH, decodeURIComponent(u.pathname)); if (fs.existsSync(f) && fs.statSync(f).isFile()) return r.fulfill({ path: f }); }
    return r.fulfill({ status: 200, body: '' });
  });
}
async function run(CASES) {
  const browser = await chromium.launch();
  for (const [size, opts] of SIZES) for (const c of CASES) {
    const ctx = await browser.newContext(opts); await route(ctx);
    const page = await ctx.newPage(), errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(page0 + c.q, { waitUntil: 'load' }); await page.waitForTimeout(400);
    const f0 = fail, tag = size + ' ' + (c.q || '(no parameters)');
    try { await c.check(page, (cond, m) => ok(cond, tag + ': ' + m)); } catch (e) { ok(false, tag + ': ' + e.message); }
    ok(!errs.length, tag + ': console errors: ' + errs.join(' | '));
    console.log((fail > f0 ? '  ' : 'ok') + ' ' + tag);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${n - fail}/${n} deep-link checks passed`); process.exit(fail ? 1 : 0);
}
const benchOpen = async (page, ok) => {
  ok(await page.locator('#benchCard').isVisible(), 'Mixing Bench card is visible');
  ok(await page.locator('#benchCard .bench-beakers').isVisible(), 'two beakers are drawn');
  ok(await page.locator('#benchCard [data-bp]').count() === 4, 'four prediction choices');
  ok(await page.evaluate(() => document.body.classList.contains('bench-on') && document.querySelector('.modes [data-bench]').classList.contains('active')), 'bench card is the active mode');
};
run([
  { q: '', check: async (page, ok) => {
    ok(!(await page.locator('#benchCard').isVisible()), 'bench stays closed');
    ok(await page.evaluate(() => !document.body.classList.contains('bench-on') && state.mode === 'balance'), 'Balance is the starting mode');
    ok(await page.evaluate(() => document.body.classList.contains('course-1A')), 'default course is CHEM 1A');
  } },
  { q: '?mode=bench', check: benchOpen },
  { q: '?course=3A&mode=bench', check: async (page, ok) => { await benchOpen(page, ok); ok(await page.evaluate(() => document.body.classList.contains('course-3A')), 'course=3A still applies'); } },
  { q: '?course=1A&mode=BENCH', check: async (page, ok) => { await benchOpen(page, ok); ok(await page.evaluate(() => document.body.classList.contains('course-1A')), 'course=1A still applies'); } },
  { q: '?mode=nonsense', check: async (page, ok) => { ok(!(await page.locator('#benchCard').isVisible()), 'unknown mode is ignored'); } },
]);
