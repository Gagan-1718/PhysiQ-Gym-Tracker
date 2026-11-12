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

const field = (label) => page.getByLabel(label, { exact: true });
const done = () => page.getByRole('button', { name: /^Done/ });
const start = (name) => page.getByRole('button', { name, exact: true }).click();
const skipRest = () => page.getByRole('button', { name: 'Skip' }).click();

test('Today recommends the most overdue day and shows it in an app-wide banner', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#up-next-title');
  assert.equal(await page.locator('#up-next-title').innerText(), 'Pull');
  assert.match(await page.locator('[role="status"]').first().innerText(), /Pull is \d+ days overdue/);
  assert.match(await page.locator('section[aria-labelledby="activity-title"]').innerText(), /154/, 'protein target from sp_get_daily_fuel');
});

test('a full workout: weigh-ins, pre-filled targets, live PR badge, survives a reload, saves one transaction, deletes cleanly', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const hadWeightToday = (await api(page, 'GET', '/api/body')).body.some((m) => m.recorded_on === today);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Start Pull/ }).click();
  await page.waitForURL('**/train/session', { timeout: 30000 });

  // First the exercise list: customise it, then start. The clock does not run while planning.
  await page.getByRole('button', { name: 'Start workout', exact: true }).waitFor();
  assert.match(await page.locator('header').innerText(), /Choose your exercises/);
  await page.getByRole('button', { name: 'Remove Dumbbell Bicep Curl' }).click();
  assert.equal(await page.getByRole('button', { name: /^Remove / }).count(), 3, 'an exercise was removed from the plan');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();

  // Weigh in first (migration 004): starts at the last logged body weight, 0.1 kg steps
  const before = page.getByRole('slider', { name: 'Slide to change body weight before' });
  assert.equal(await before.getAttribute('aria-orientation'), 'vertical');
  await field('body weight before').fill('80.4');
  await field('body weight before').blur();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Guided, one set at a time. First the set's weight, with the muscles from exercise_muscles (migration 003)
  await page.getByRole('heading', { name: 'Barbell Deadlift' }).waitFor();
  const chips = await page.getByRole('list', { name: 'Muscles' }).locator('li').allInnerTexts();
  assert.deepEqual(chips.slice(0, 3), ['Glutes', 'Hamstrings', 'Lower back'], 'primary muscles first');
  assert.match(await page.getByText(/Exercise 1 of 3/).innerText(), /Exercise 1 of 3/);

  // Warm-up first (as last time), then ramping sets that end on the overload target:
  // sp_estimate_next_target says 132.5 x 8 (last time 130 x 10) and the deadlift steps 10 kg,
  // so the plan is 112.5 x 12, 122.5 x 10, 132.5 x 8. Reps are not asked: each set keeps its planned reps.
  assert.equal(await field('set W weight').inputValue(), '65');
  assert.equal(await page.getByLabel('set W reps').count(), 0, 'no reps to fill in');
  // Then the exercise full screen, its name on top, and Done
  await start('Start warm-up');
  assert.equal(await page.getByRole('img', { name: 'Barbell Deadlift demonstration' }).count(), 1);
  assert.match(await page.getByRole('region', { name: /Barbell Deadlift, Warm-up/ }).innerText(), /65 kg/);
  await done().click();
  await skipRest(); // the rest timer ran under the next set's weight
  assert.equal(await field('set 1 weight').inputValue(), '112.5');

  // The vertical ruler is a slider: arrow keys move it 2.5 kg at a time
  const ruler = page.getByRole('slider', { name: 'Slide to change set 1 weight' });
  assert.equal(await ruler.getAttribute('aria-orientation'), 'vertical');
  await ruler.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  assert.equal(await ruler.getAttribute('aria-valuenow'), '107.5');
  // The big number follows the ruler on the next frame
  await page.waitForFunction(() => document.querySelector('input[aria-label="set 1 weight"]')?.value === '107.5');
  await start('Start set 1');
  await done().click();
  await skipRest();
  assert.equal(await field('set 2 weight').inputValue(), '117.5', 'the next set is what was really lifted plus the 10 kg step');

  // Beat the record: 135 kg for the planned 10 reps has e1RM 180 > 173.33
  await field('set 2 weight').fill('135');
  await field('set 2 weight').blur();
  await start('Start set 2');
  await done().click();
  await page.getByText('New PR! Barbell Deadlift 135 kg').waitFor();
  await skipRest();
  assert.equal(await field('set 3 weight').inputValue(), '145', '135 + 10');

  // The workout lives on the device: a reload keeps it, even in the middle of a set
  await start('Start set 3');
  await page.reload({ waitUntil: 'networkidle' });
  await done().waitFor();
  await page.getByRole('button', { name: 'Change the weight' }).click();
  assert.equal(await field('set 3 weight').inputValue(), '145');

  // All sets: the warm-up and two working sets are ticked; skip the last set and move on
  await page.getByRole('button', { name: 'All sets' }).click();
  assert.equal(await page.locator('[role="dialog"] button[aria-pressed="true"]').count(), 3);
  await page.getByRole('button', { name: /Skip to next exercise/ }).click();
  await page.getByRole('heading', { name: 'Lat Pulldown' }).waitFor();
  assert.match(await page.getByText(/Exercise 2 of 3/).innerText(), /Exercise 2 of 3/);

  // Finishing asks the weight again, starting from the weigh-in; the summary shows both
  await page.getByRole('button', { name: 'Finish' }).click();
  assert.equal(await field('body weight after').inputValue(), '80.4');
  await page.getByRole('slider', { name: 'Slide to change body weight after' }).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('input[aria-label="body weight after"]')?.value === '79.8');
  await page.getByRole('button', { name: 'Continue' }).click();
  assert.match(await page.getByRole('dialog', { name: 'Finish workout' }).innerText(), /Body weight 80\.4 → 79\.8 kg \(−0\.6\)/);
  await page.getByRole('radio', { name: /Strong/ }).click();
  await page.getByRole('button', { name: 'pump', exact: true }).click();
  await page.getByPlaceholder('Anything worth remembering?').fill('e2e workout');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await page.getByText('Pull done').waitFor({ timeout: 20000 });
  const success = await page.locator('main').innerText();
  assert.match(success, /New personal records/);
  assert.match(success, /\b180\b/, 'e1RM computed by the database (135 x 10)');

  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForSelector('#up-next-title');
  assert.notEqual(await page.locator('#up-next-title').innerText(), 'Pull', 'Pull was trained, so the recommendation moved on');

  // History shows the PR; deleting rolls PRs and recovery back through the triggers
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/history/"]').first().click();
  await page.getByText('Delete workout').waitFor();
  assert.ok((await page.getByText('PR', { exact: true }).count()) > 0);
  assert.match(await page.locator('main').innerText(), /Body weight 80\.4 → 79\.8 kg/);
  await page.getByRole('button', { name: 'Delete workout' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL('**/history');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#up-next-title');
  assert.equal(await page.locator('#up-next-title').innerText(), 'Pull', 'recommendation restored after the delete');

  // The weigh-in became today's body weight (trg_workout_sessions_ai) unless one was logged; undo that
  const todayRow = (await api(page, 'GET', '/api/body')).body.find((m) => m.recorded_on === today);
  if (!hadWeightToday) {
    assert.equal(todayRow.weight, 80.4);
    await api(page, 'DELETE', `/api/body/${todayRow.id}`);
  }
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
