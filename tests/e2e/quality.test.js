const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, launch, newPage, closeContexts, login, axeViolations } = require('./helpers');

/*
 * Quality gate: every screen must have
 *   - zero axe-core violations (WCAG 2.2 AA + best practices: contrast, names, roles, headings)
 *   - no horizontal scrolling (checked at 320 px, the smallest phones, up to a laptop)
 *   - no console errors (which also catches Content-Security-Policy violations on a production build)
 */
const WIDTHS = [320, 390, 1280];
let browser;

before(async () => {
  browser = await launch();
});
after(async () => {
  await closeContexts();
  await browser.close();
});

async function check(page, name) {
  await page.waitForTimeout(700); // let charts and lists settle
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `${name}: page scrolls sideways by ${overflow}px`);
  const violations = await axeViolations(page);
  assert.deepEqual(violations, [], `${name}: accessibility violations`);
}

for (const width of WIDTHS) {
  test(`member screens at ${width}px: accessible and no horizontal scroll`, async () => {
    const page = await newPage(browser, { desktop: width >= 700, width });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await check(page, '/login');
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await check(page, '/register');

    await login(page, 'alex@physiq.test');
    await page.waitForSelector('#up-next-title');
    await check(page, '/ (Today)');

    await page.goto(`${BASE}/train`, { waitUntil: 'networkidle' });
    await check(page, '/train');

    await page.goto(`${BASE}/fuel`, { waitUntil: 'networkidle' });
    await check(page, '/fuel');

    await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
    await check(page, '/progress (overview)');
    await page.getByRole('radio', { name: 'Strength' }).click();
    await page.waitForSelector('text=Next target');
    await check(page, '/progress (strength)');
    await page.getByRole('radio', { name: 'Body' }).click();
    await check(page, '/progress (body)');
    await page.getByRole('radio', { name: 'Journey' }).click();
    await page.waitForSelector('article');
    await check(page, '/progress (journey)');

    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
    await check(page, '/history');
    await page.locator('a[href^="/history/"]').first().click();
    await page.getByText('Delete workout').waitFor();
    await check(page, '/history/:id');
    await page.getByRole('button', { name: 'Edit' }).click();
    await check(page, '/history/:id (edit mode)');

    await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
    await check(page, '/profile');

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /Start Pull/ }).click();
    await page.waitForURL('**/train/session');
    await page.getByRole('button', { name: 'Start workout', exact: true }).waitFor();
    await check(page, '/train/session (choose exercises)');
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    await check(page, '/train/session (weigh in)');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('heading', { name: 'Barbell Deadlift' }).waitFor();
    await check(page, '/train/session (set weight)');
    await page.getByRole('button', { name: 'Start warm-up' }).click();
    await page.getByRole('button', { name: 'Done' }).waitFor();
    await check(page, '/train/session (doing the set)');
    await page.getByRole('button', { name: /^Done/ }).click();
    await page.getByRole('timer').waitFor();
    await check(page, '/train/session (resting)');
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();

    assert.deepEqual(page.problems, [], 'no console or page errors');
  });

  test(`admin screens at ${width}px: accessible and no horizontal scroll`, async () => {
    const page = await newPage(browser, { desktop: width >= 700, width });
    await login(page, 'admin@physiq.test');
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForSelector('ul li button');
    await check(page, '/admin (library)');
    await page.getByRole('radio', { name: 'Audit log' }).click();
    await page.waitForSelector('li');
    await check(page, '/admin (audit log)');
    assert.deepEqual(page.problems, [], 'no console or page errors');
  });
}

test('unknown pages show the branded 404', async () => {
  const page = await newPage(browser);
  await login(page, 'alex@physiq.test');
  const res = await page.goto(`${BASE}/definitely-not-a-page`, { waitUntil: 'networkidle' });
  assert.equal(res.status(), 404);
  assert.match(await page.locator('h1').first().innerText(), /doesn’t exist/);
  await check(page, '/404');
});
