/*
 * Helpers for the browser (end-to-end) suite. These tests drive the real app in a
 * real browser against a RUNNING server on a FRESH database (npm run db:init or
 * db:reset), because the demo data's dates are relative to the day it was built.
 *
 *   BASE_URL       default http://localhost:3000
 *   PW_EXECUTABLE  path to a Chromium-based browser (e.g. Edge or Chrome). If unset,
 *                  Playwright's own Chromium is used (npx playwright-core install chromium).
 */
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DEMO_PASSWORD = 'physiq123';

function launch() {
  return chromium.launch({ executablePath: process.env.PW_EXECUTABLE || undefined });
}

const openContexts = new Set();

/** Close every page this file opened, so nothing is still loading when the browser shuts down. */
async function closeContexts() {
  for (const c of openContexts) await c.close().catch(() => undefined);
  openContexts.clear();
}

/** A phone (default) or laptop browser context. */
async function newPage(browser, { desktop = false, width, permissions = [] } = {}) {
  const context = await browser.newContext(
    desktop
      ? { viewport: { width: width ?? 1280, height: 860 }, colorScheme: 'dark', permissions }
      : { viewport: { width: width ?? 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', permissions }
  );
  openContexts.add(context);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // CSP violations and failed requests show up as console errors: they must not happen
    if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 240)}`);
  });
  page.problems = problems;
  return page;
}

async function login(page, email, password = DEMO_PASSWORD) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
}

/** Call the app's own JSON API from inside the page (same cookies as the user). */
function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { method, url, body }
  );
}

/** A PNG made in the browser (so the suite needs no image library). */
function makePhoto(page, { hue = 200, width = 1800, height = 2400 } = {}) {
  return page
    .evaluate(
      async ({ hue, width, height }) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const g = canvas.getContext('2d');
        const bg = g.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, `hsl(${hue},40%,20%)`);
        bg.addColorStop(1, `hsl(${hue + 40},50%,8%)`);
        g.fillStyle = bg;
        g.fillRect(0, 0, width, height);
        g.fillStyle = `hsl(${hue},60%,60%)`;
        g.fillRect(width * 0.3, height * 0.3, width * 0.4, height * 0.35);
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      },
      { hue, width, height }
    )
    .then((bytes) => Buffer.from(bytes));
}

const axePath = path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js');

/** Run axe-core (WCAG 2.2 AA + best practices) on the current page; returns violations. */
async function axeViolations(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return res.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
  });
}

module.exports = { BASE, DEMO_PASSWORD, launch, newPage, closeContexts, login, api, makePhoto, axeViolations };
