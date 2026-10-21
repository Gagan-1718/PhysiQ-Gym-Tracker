const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { BASE, DEMO_PASSWORD, launch, newPage, closeContexts, login, api } = require('./helpers');

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await closeContexts();
  await browser.close();
});

test('a new member registers, goes through onboarding and lands on a personalised Today', async () => {
  const page = await newPage(browser);
  const email = `e2e-${crypto.randomUUID()}@physiq.test`;
  try {
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.getByLabel('Name').fill('E2E Member');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL('**/onboarding', { timeout: 30000 });

    // Step 1: goal. Step 2: body. Step 3: split
    await page.getByRole('radio', { name: /Get stronger/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('height', { exact: true }).fill('178');
    await page.getByLabel('height', { exact: true }).blur();
    await page.getByRole('button', { name: 'Increase weight' }).click(); // 72 -> 72.5
    assert.match(await page.locator('main, body').first().innerText(), /145\s*g/, 'protein target 2 g/kg of 72.5 kg');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: /Upper \/ Lower/ }).click();
    await page.getByRole('button', { name: 'Start training' }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 30000 });
    await page.waitForSelector('#up-next-title');

    assert.equal(await page.locator('#up-next-title').innerText(), 'Upper', 'first day of the new split, never trained');
    const me = (await api(page, 'GET', '/api/me')).body;
    assert.deepEqual([me.goal, me.height, me.starting_weight, me.needsOnboarding], ['strength', 178, 72.5, false]);
    assert.deepEqual(page.problems, []);
  } finally {
    await api(page, 'DELETE', '/api/me', { password: DEMO_PASSWORD });
  }
});

test('sign-in errors are generic and the page guard sends visitors to login', async () => {
  const page = await newPage(browser);
  await page.goto(`${BASE}/train`, { waitUntil: 'networkidle' });
  assert.match(page.url(), /\/login\?callbackUrl=%2Ftrain/);
  await page.getByLabel('Email').fill('alex@physiq.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // (Next.js also renders an empty, invisible role=alert route announcer, so target the form's own message)
  const error = page.locator('form p[role="alert"]');
  await error.waitFor();
  assert.match(await error.innerText(), /Email or password is incorrect/);
  // after a correct sign-in the original destination is restored
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/train');
});

test('profile: reminders switch persists, data export downloads, members cannot open the admin area', async () => {
  const page = await newPage(browser, { permissions: ['notifications'] });
  await login(page, 'alex@physiq.test');
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });

  const sw = page.getByRole('switch', { name: 'Overdue reminders' });
  assert.equal(await sw.getAttribute('aria-checked'), 'false');
  await sw.click();
  await page.waitForFunction(() => document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('switch', { name: 'Overdue reminders' }).getAttribute('aria-checked'), 'true', 'preference persisted on the device');
  await page.getByRole('switch', { name: 'Overdue reminders' }).click();

  // The link points at the export endpoint and is marked as a download. (Clicking an <a download> leaves a
  // navigation that Playwright cannot cleanly cancel at browser close, so fetch it with the page's session instead.)
  const link = page.getByRole('link', { name: /Download my data/ });
  assert.equal(await link.getAttribute('href'), '/api/me/export');
  assert.notEqual(await link.getAttribute('download'), null);
  const exported = await page.request.get(`${BASE}/api/me/export`);
  assert.equal(exported.status(), 200);
  assert.match(exported.headers()['content-disposition'], /^attachment; filename="physiq-export-\d{4}-\d{2}-\d{2}\.json"$/);
  const saved = await exported.json();
  assert.equal(saved.profile.email, 'alex@physiq.test');
  assert.ok(!JSON.stringify(saved).includes('password_hash'));

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('main').innerText(), /Admins only/);
  assert.deepEqual(page.problems, []);
});

test('admin: exercise library and the trigger-written audit log', async () => {
  const page = await newPage(browser);
  await login(page, 'admin@physiq.test');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('ul li button');
  assert.ok((await page.locator('ul li button').count()) >= 44, 'the 44-exercise library');

  await page.getByRole('radio', { name: 'Audit log' }).click();
  await page.waitForSelector('li');
  assert.match(await page.locator('main').innerText(), /INSERT/);

  // Add and remove an exercise: both go through the audit trigger with the acting admin
  await page.getByRole('radio', { name: 'Exercise library' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Name').fill('E2E Cable Press');
  await page.getByRole('button', { name: 'Add to library' }).click();
  await page.getByText('Exercise added').first().waitFor();
  await page.getByRole('radio', { name: 'Audit log' }).click();
  await page.getByText('E2E Cable Press').first().waitFor();
  assert.match(await page.locator('main').innerText(), /PhysiQ Admin/, 'the trigger knows who acted');

  const created = (await api(page, 'GET', '/api/exercises')).body.exercises.find((e) => e.name === 'E2E Cable Press');
  assert.equal((await api(page, 'DELETE', `/api/exercises/${created.id}`)).status, 200);
  assert.deepEqual(page.problems, []);
});
