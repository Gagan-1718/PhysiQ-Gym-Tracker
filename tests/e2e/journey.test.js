const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, launch, newPage, closeContexts, login, api, makePhoto } = require('./helpers');

let browser;
let page;

before(async () => {
  browser = await launch();
  page = await newPage(browser);
  await login(page, 'alex@physiq.test');
});

after(async () => {
  // Remove anything this suite created, even after a failure
  const left = await api(page, 'GET', '/api/journey?q=e2eword&limit=30');
  for (const s of left.body?.stories ?? []) await api(page, 'DELETE', `/api/journey/${s.id}`);
  const problems = page.problems;
  await closeContexts();
  await browser.close();
  assert.deepEqual(problems, [], 'no console or page errors');
});

async function openJourney() {
  await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Journey' }).click();
  await page.waitForSelector('article');
}

test('the Journey shows the seeded MongoDB journals with insights', async () => {
  await openJourney();
  assert.equal(await page.locator('article').count(), 6);
  assert.match(await page.locator('main').innerText(), /Mood by week/);
  assert.ok((await page.getByRole('button', { name: /#deadlift/ }).count()) > 0, 'top tags from the $facet aggregation');
});

test('add a note and two photos; search, filter, compare then-and-now; photos are shrunk and private', async () => {
  await openJourney();

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Progress, plateaus, how training feels').fill('e2eword note: sleep improved this week.');
  await page.getByRole('radio', { name: /Strong/ }).click();
  await page.getByRole('button', { name: 'pump', exact: true }).click();
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByText('Note added').first().waitFor();

  const big = await makePhoto(page, { hue: 200 });
  const big2 = await makePhoto(page, { hue: 20 });
  for (const [i, bytes] of [big, big2].entries()) {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('radio', { name: 'Progress photo' }).click();
    await page.getByLabel('Choose a photo').setInputFiles({ name: `p${i}.png`, mimeType: 'image/png', buffer: bytes });
    await page.getByRole('button', { name: i === 0 ? 'front' : 'side', exact: true }).click();
    await page.getByPlaceholder('Lighting, pump, conditions').fill(`e2eword photo ${i}`);
    await page.getByRole('button', { name: 'Add photo' }).click();
    await page.getByText('Photo added').first().waitFor({ timeout: 30000 });
    // the sheet really closes (a stuck overlay would block every later tap)
    await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 0, null, { timeout: 5000 });
  }

  assert.ok((await page.getByText('Then and now').count()) > 0, 'comparison appears with two photos');

  // Photo stored privately and shrunk by the browser before upload
  const stored = await page.evaluate(async () => {
    const r = await fetch('/api/journey?kind=progress_photo&limit=1').then((x) => x.json());
    const img = await fetch(r.stories[0].photo_url);
    const blob = await img.blob();
    return { type: blob.type, bytes: blob.size, cache: img.headers.get('cache-control'), weight: r.stories[0].weight_snapshot };
  });
  assert.equal(stored.type, 'image/jpeg', 're-encoded as JPEG');
  assert.ok(stored.bytes < 200 * 1024, `resized: ${stored.bytes} bytes`);
  assert.match(stored.cache, /private/);
  assert.equal(typeof stored.weight, 'number', 'weight snapshot from MySQL fn_current_weight');

  // Full-text search and filters
  await page.getByPlaceholder('Search captions and tags').fill('e2eword');
  await page.waitForFunction(() => document.querySelectorAll('article').length === 3, null, { timeout: 10000 });
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 2, null, { timeout: 10000 });

  // Delete the three entries through the UI
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForFunction((n) => document.querySelectorAll('article').length === n, 3 - i, { timeout: 10000 });
    await page.getByRole('button', { name: 'Delete entry' }).first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByText('Entry deleted').first().waitFor();
  }
  await page.getByPlaceholder('Search captions and tags').fill('');
  await page.waitForFunction(() => document.querySelectorAll('article').length === 6, null, { timeout: 10000 });
});
