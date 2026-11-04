#!/usr/bin/env node
/*
 * Re-takes every README / viva screenshot in docs/screenshots from the running app:
 *
 *   npm run db:reset && npm run build && npm start     (in another terminal)
 *   npm run docs:screenshots
 *
 * Needs a FRESH db:reset (the seed dates are relative to the day it was built, and the
 * Today screen shows the "Pull is overdue" state). Nothing is saved: the live-logger shot
 * discards its workout. Set PW_EXECUTABLE to use an installed Chrome or Edge.
 */
const fs = require('fs');
const path = require('path');
const { BASE, launch, newPage, closeContexts, login } = require('../tests/e2e/helpers');

const OUT = path.resolve(__dirname, '..', 'docs', 'screenshots');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const shot = async (page, name) => {
    await page.waitForTimeout(900); // let charts, rings and fonts settle
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  ✓ ${name}`);
  };
  const scrollToTop = (page, locator) => locator.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));

  try {
    // ---- signed out
    let page = await newPage(browser);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await shot(page, '00-login');

    // ---- member on a phone
    page = await newPage(browser);
    await login(page, 'alex@physiq.test');
    await page.waitForSelector('#up-next-title');
    await shot(page, '01-today');
    await scrollToTop(page, page.locator('h2.text-title', { hasText: 'Activity' }));
    await shot(page, '02-today-activity');

    await page.goto(`${BASE}/train`, { waitUntil: 'networkidle' });
    await shot(page, '03-train');

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /Start Pull/ }).click();
    await page.waitForURL('**/train/session');
    await page.waitForSelector('section[aria-label="Barbell Deadlift"]');
    const dl = page.locator('section[aria-label="Barbell Deadlift"]');
    await dl.getByRole('button', { name: 'Complete set W' }).click();
    await dl.getByRole('button', { name: 'Complete set 1' }).click();
    await page.getByRole('button', { name: 'Skip' }).click();
    // 135 x 9 beats the 173.33 kg e1RM record, so the PR badge shows
    await dl.getByLabel('set 2 weight', { exact: true }).fill('135');
    await dl.getByLabel('set 2 weight', { exact: true }).blur();
    await dl.getByLabel('set 2 reps', { exact: true }).fill('9');
    await dl.getByLabel('set 2 reps', { exact: true }).blur();
    await dl.getByRole('button', { name: 'Complete set 2' }).click();
    await shot(page, '04-logger');
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();

    await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
    await shot(page, '05-progress-overview');
    await page.getByRole('radio', { name: 'Strength' }).click();
    await shot(page, '06-progress-strength');
    await page.waitForSelector('ul[aria-label="Estimated weight for each rep count"]');
    await scrollToTop(page, page.getByText('1RM calculator', { exact: true }));
    await shot(page, '13-one-rep-max');
    await page.getByRole('radio', { name: 'Journey' }).click();
    await page.waitForSelector('article');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, '07-journey');

    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
    await page.locator('a[href^="/history/"]').first().click();
    await page.getByText('Delete workout').waitFor();
    await shot(page, '08-history-detail');
    await page.getByRole('button', { name: 'Edit' }).click();
    await shot(page, '14-edit-workout');

    await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
    await shot(page, '09-profile');

    // ---- admin
    page = await newPage(browser);
    await login(page, 'admin@physiq.test');
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'Audit log' }).click();
    await page.waitForSelector('li');
    await shot(page, '10-admin-audit');

    // ---- laptop
    page = await newPage(browser, { desktop: true, width: 1360 });
    await login(page, 'alex@physiq.test');
    await page.waitForSelector('#up-next-title');
    await shot(page, '11-laptop-today');
    await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
    await shot(page, '12-laptop-progress');
  } finally {
    await closeContexts();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
