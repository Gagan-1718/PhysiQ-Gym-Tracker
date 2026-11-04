const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { signedIn, today, client } = require('./helpers');

let alex;
before(async () => {
  alex = await signedIn('alex@physiq.test');
});

test('daily fuel: targets come from sp_get_daily_fuel, logging goes through sp_log_fuel with clamping', async () => {
  const fuel = (await alex.get(`/api/fuel?date=${today()}`)).body;
  assert.equal(fuel.body_weight_kg, 77.2);
  assert.equal(fuel.protein_target_g, 154, '2 g per kg');
  assert.equal(fuel.water_target_ml, 3100, '40 ml per kg rounded to 50');
  assert.equal(fuel.calorie_target, 2850, '33 kcal/kg + 300 for hypertrophy');

  const up = (await alex.post('/api/fuel', { date: today(), proteinDelta: 25, waterDelta: 250 })).body;
  assert.equal(up.protein_logged_g, fuel.protein_logged_g + 25);
  assert.equal(up.water_logged_ml, fuel.water_logged_ml + 250);
  const down = (await alex.post('/api/fuel', { date: today(), proteinDelta: -500, waterDelta: -5000 })).body;
  assert.equal(down.protein_logged_g, 0, 'cannot go below zero');
  assert.equal(down.water_logged_ml, 0);
  // restore the seeded values
  await alex.post('/api/fuel', { date: today(), proteinDelta: fuel.protein_logged_g, waterDelta: fuel.water_logged_ml });

  assert.equal((await alex.get('/api/fuel?date=19-10-2026')).status, 400);
  assert.equal((await alex.post('/api/fuel', { date: today() })).status, 400, 'nothing to log');
  assert.equal((await alex.post('/api/fuel', { date: today(), proteinDelta: 99999 })).status, 400);
});

test('progress summary: weekly volume from a view, sets per muscle, PRs and the gaps-and-islands streak', async () => {
  const p = (await alex.get('/api/progress')).body;
  assert.equal(p.weeklyGoal, 4);
  assert.ok(p.weeks.length >= 5);
  assert.equal(p.muscles.length, 10);
  assert.equal(p.prs.length, 6);
  assert.ok(p.streakWeeks >= 4, `streak ${p.streakWeeks}`);
  for (const w of p.weeks) assert.equal(new Date(w.week_start + 'T00:00:00Z').getUTCDay(), 1, 'weeks start on Monday');
});

test('strength trend per exercise from view_exercise_session_best, with the next target', async () => {
  const list = (await alex.get('/api/progress/exercises')).body;
  assert.equal(list.length, 12);
  assert.equal(list[0].sessions, 7, 'most frequent first');
  const bench = list.find((e) => e.name === 'Barbell Bench Press');
  const detail = (await alex.get(`/api/progress/exercises/${bench.exercise_id}`)).body;
  assert.equal(detail.series.length, 7);
  assert.ok(detail.series.every((s, i, a) => i === 0 || s.session_date >= a[i - 1].session_date), 'oldest first');
  assert.equal(detail.pr.weight, 72.5);
  assert.ok(detail.target.suggested_weight >= 72.5);
  assert.equal((await alex.get('/api/progress/exercises/999999')).status, 404);
  assert.equal((await alex.get('/api/progress/exercises/abc')).status, 400);
});

test('body measurements: one entry per day, later logs merge, validated ranges', async () => {
  const day = today(-400); // a date the demo data never uses
  assert.equal((await alex.post('/api/body', { date: day, weight: 80 })).status, 201);
  assert.equal((await alex.post('/api/body', { date: day, waist: 81.2 })).status, 201, 'second log the same day');
  const rows = (await alex.get('/api/body')).body.filter((m) => m.recorded_on === day);
  assert.equal(rows.length, 1, 'UNIQUE (user_id, recorded_on) keeps one row per day');
  assert.equal(rows[0].weight, 80, 'weight kept: the second log only sent waist');
  assert.equal(rows[0].waist, 81.2);

  assert.equal((await alex.post('/api/body', { date: day })).status, 400, 'at least one value');
  assert.equal((await alex.post('/api/body', { date: day, weight: 5 })).status, 400, 'range aligned with the CHECK constraint');
  assert.equal((await client().del('/api/body/1')).status, 401);
  assert.equal((await alex.del(`/api/body/${rows[0].id}`)).status, 200, 'cleanup');
});

test("members cannot delete each other's measurements", async () => {
  const admin = await signedIn('admin@physiq.test');
  const row = (await alex.get('/api/body')).body[0];
  assert.equal((await admin.del(`/api/body/${row.id}`)).status, 404);
});

test('1RM calculator is computed by the database (sp_rep_max_table) and validated', async () => {
  const res = await alex.get('/api/calc/one-rep-max?weight=100&reps=10');
  assert.equal(res.status, 200);
  assert.equal(res.body.oneRm, 133.33);
  assert.equal(res.body.table.length, 12);
  assert.equal(res.body.table[9].weight_kg, 100, 'the 10-rep row returns the input weight');
  assert.equal(res.body.table[0].pct_of_one_rm, 100);

  for (const bad of ['weight=0&reps=5', 'weight=100&reps=0', 'weight=100&reps=31', 'weight=abc&reps=5', 'weight=100', 'weight=1000&reps=5']) {
    assert.equal((await alex.get(`/api/calc/one-rep-max?${bad}`)).status, 400, bad);
  }
  assert.equal((await client().get('/api/calc/one-rep-max?weight=100&reps=10')).status, 401);
});

test('nutrition & hydration APIs: food library, meal logging, and water logging sync daily fuel', async () => {
  const foodsRes = await alex.get('/api/foods?category=protein');
  assert.equal(foodsRes.status, 200);
  assert.ok(foodsRes.body.foods.length >= 4, 'seeded protein foods');

  const day = today(-390);
  const initial = (await alex.get(`/api/nutrition?date=${day}`)).body;
  assert.equal(initial.meals.length, 0);
  assert.equal(initial.waterLogs.length, 0);

  const mealRes = await alex.post('/api/nutrition/meals', {
    date: day,
    mealType: 'lunch',
    foodId: foodsRes.body.foods[0].id,
    servings: 1.5,
  });
  assert.equal(mealRes.status, 201);

  const waterRes = await alex.post('/api/nutrition/water', {
    date: day,
    amountMl: 500,
    containerLabel: 'Bottle',
  });
  assert.equal(waterRes.status, 201);

  const after = (await alex.get(`/api/nutrition?date=${day}`)).body;
  assert.equal(after.meals.length, 1);
  assert.equal(after.waterLogs.length, 1);
  assert.equal(after.fuel.calories_logged, mealRes.body.calories);
  assert.equal(after.fuel.water_logged_ml, 500);

  assert.equal((await alex.del(`/api/nutrition/meals?id=${mealRes.body.id}`)).status, 200);
  assert.equal((await alex.del(`/api/nutrition/water?id=${waterRes.body.id}`)).status, 200);

  const cleaned = (await alex.get(`/api/nutrition?date=${day}`)).body;
  assert.equal(cleaned.fuel.calories_logged, 0);
  assert.equal(cleaned.fuel.water_logged_ml, 0);
});

test('vector search API (/api/vector/search): ranks exercises and foods by 32-d Cosine Similarity', async () => {
  const exRes = await alex.get('/api/vector/search?domain=exercise&q=lower+back+friendly+leg+builder&k=4');
  assert.equal(exRes.status, 200);
  assert.equal(exRes.body.dimensions, 32);
  assert.equal(exRes.body.results.length, 4);
  assert.ok(
    exRes.body.results[0].cosine_similarity >= exRes.body.results[1].cosine_similarity,
    'results sorted descending by cosine similarity'
  );

  const simRes = await alex.get(`/api/vector/search?domain=exercise&similarTo=${exRes.body.results[0].entity_id}&k=3`);
  assert.equal(simRes.status, 200);
  assert.equal(simRes.body.results.length, 3);
  assert.ok(simRes.body.results.every((r) => r.entity_id !== exRes.body.results[0].entity_id), 'excludes anchor exercise');

  const foodRes = await alex.get('/api/vector/search?domain=food&q=high+protein+post+workout+recovery&k=4');
  assert.equal(foodRes.status, 200);
  assert.equal(foodRes.body.results.length, 4);
  assert.ok(foodRes.body.results[0].cosine_similarity > 0.4);
});

test("vector search never anchors on another member's custom food", async () => {
  // The admin account doubles as "another member" here; its custom foods are private to it
  const admin = await signedIn('admin@physiq.test');
  const created = await admin.post('/api/foods', { name: `Private probe food ${Date.now()}`, category: 'meals', calories: 300, proteinG: 20 });
  assert.equal(created.status, 201);

  const own = await admin.get(`/api/vector/search?domain=food&similarTo=${created.body.id}&k=3`);
  assert.equal(own.status, 200, 'the owner can search from it');

  const other = await alex.get(`/api/vector/search?domain=food&similarTo=${created.body.id}&k=3`);
  assert.equal(other.status, 404, 'another member gets "not found", not its name or embedding');
  assert.ok(!JSON.stringify(other.body).includes('Private probe food'));
});
