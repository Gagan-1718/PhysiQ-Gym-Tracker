const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, launch, newPage, closeContexts, login, api } = require('./helpers');

let browser;
let page;

before(async () => {
  browser = await launch();
  page = await newPage(browser);
  await login(page, 'alex@physiq.test');
});

after(async () => {
  const problems = page.problems;
  await closeContexts();
  await browser.close();
  assert.deepEqual(problems, [], 'no console or page errors during the whole suite');
});

const set = (exercise, n, what) => page.locator(`section[aria-label="${exercise}"]`).getByLabel(`set ${n} ${what}`, { exact: true });

test('Today recommends the most overdue day and shows it in an app-wide banner', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#up-next-title');
  assert.equal(await page.locator('#up-next-title').innerText(), 'Pull');
  assert.match(await page.locator('[role="status"]').first().innerText(), /Pull is \d+ days overdue/);
  assert.match(await page.locator('section[aria-labelledby="activity-title"]').innerText(), /154/, 'protein target from sp_get_daily_fuel');
});

test('a full workout: pre-filled targets, live PR badge, survives a reload, saves one transaction, deletes cleanly', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Start Pull/ }).click();
  await page.waitForURL('**/train/session', { timeout: 30000 });
  await page.waitForSelector('section[aria-label="Barbell Deadlift"]');

  // Sets are pre-filled from sp_estimate_next_target: last time 130 x 10 -> 132.5 x 8
  assert.equal(await set('Barbell Deadlift', 1, 'weight').inputValue(), '132.5');
  assert.equal(await set('Barbell Deadlift', 1, 'reps').inputValue(), '8');

  const dl = page.locator('section[aria-label="Barbell Deadlift"]');
  await dl.getByRole('button', { name: 'Complete set W' }).click();
  await dl.getByRole('button', { name: 'Complete set 1' }).click();
  await page.getByRole('button', { name: 'Skip' }).click(); // rest timer appeared
  // Beat the record: 135 x 9 has e1RM 175.5 > 173.33
  await set('Barbell Deadlift', 2, 'weight').fill('135');
  await set('Barbell Deadlift', 2, 'weight').blur();
  await set('Barbell Deadlift', 2, 'reps').fill('9');
  await set('Barbell Deadlift', 2, 'reps').blur();
  assert.equal(await set('Barbell Deadlift', 3, 'weight').inputValue(), '135', 'a changed weight flows down to later unticked sets');
  await dl.getByRole('button', { name: 'Complete set 2' }).click();
  assert.ok((await dl.getByText('PR', { exact: true }).count()) > 0, 'live PR badge');

  // The workout lives on the device: a reload keeps it
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('section[aria-label="Barbell Deadlift"]');
  assert.equal(await page.locator('button[aria-pressed="true"]').count(), 3, 'ticked sets survived the reload');

  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('radio', { name: /Strong/ }).click();
  await page.getByRole('button', { name: 'pump', exact: true }).click();
  await page.getByPlaceholder('Anything worth remembering?').fill('e2e workout');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await page.getByText('Pull done').waitFor({ timeout: 20000 });
  const success = await page.locator('main').innerText();
  assert.match(success, /New personal records/);
  assert.match(success, /175\.5/, 'e1RM computed by the database');

  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForSelector('#up-next-title');
  assert.notEqual(await page.locator('#up-next-title').innerText(), 'Pull', 'Pull was trained, so the recommendation moved on');

  // History shows the PR; deleting rolls PRs and recovery back through the triggers
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/history/"]').first().click();
  await page.getByText('Delete workout').waitFor();
  assert.ok((await page.getByText('PR', { exact: true }).count()) > 0);
  await page.getByRole('button', { name: 'Delete workout' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL('**/history');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#up-next-title');
  assert.equal(await page.locator('#up-next-title').innerText(), 'Pull', 'recommendation restored after the delete');
});

test('editing a saved workout: the database recalculates volume and the PR', async () => {
  const bench = (await api(page, 'GET', '/api/exercises')).body.exercises.find((e) => e.name === 'Barbell Bench Press').id;
  const created = await api(page, 'POST', '/api/workouts', {
    clientRef: crypto.randomUUID(),
    sessionDate: new Date().toLocaleDateString('en-CA'),
    splitDayId: null,
    bodyPart: 'E2E Edit',
    startedAt: null,
    endedAt: null,
    exercises: [{ exerciseId: bench, sets: [{ weight: 50, reps: 10, warmup: false }, { weight: 50, reps: 8, warmup: false }] }],
  });
  assert.equal(created.status, 201);
  try {
    await page.goto(`${BASE}/history/${created.body.sessionId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Edit' }).click();
    // 200 kg x 10 beats any plausible bench record, so the PR check does not depend on earlier data.
    // The history cards are not labelled sections like the logger's, so address the field page-wide.
    await page.getByLabel('set 1 weight', { exact: true }).fill('200');
    await page.getByLabel('set 1 weight', { exact: true }).blur();
    await page.getByRole('button', { name: 'Delete set 2' }).click();
    assert.equal(await page.getByRole('button', { name: /^Save/ }).innerText(), 'Save (2)');
    await page.getByRole('button', { name: /^Save/ }).click();
    await page.getByText('Workout updated').first().waitFor();
    // The page refreshes first and only then leaves edit mode, so the old numbers never flash back
    await page.getByRole('button', { name: 'Edit' }).waitFor();
    const text = await page.locator('main').innerText();
    assert.match(text, /Volume\s*2\.0k/, '200 x 10 = 2000 kg, recomputed by the trigger (shown compact)');
    assert.ok(/PR/.test(text), 'e1RM 266.67 beats the record');

    // A workout cannot be emptied
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    assert.equal(await page.getByRole('button', { name: /^Save/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Cancel' }).click();
  } finally {
    // Always remove the test workout, even when an assertion above failed, so it cannot pollute later runs
    await api(page, 'DELETE', `/api/workouts/${created.body.sessionId}`);
  }
});
