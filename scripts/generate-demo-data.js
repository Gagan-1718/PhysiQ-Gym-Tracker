#!/usr/bin/env node
/*
 * Generates database/seeds/demo_data.sql — five weeks of realistic PPL training
 * for the demo member, following the same double-progression rule as
 * sp_estimate_next_target. Output is deterministic (seeded PRNG) and every date
 * is relative to CURRENT_DATE, so the demo always looks recent.
 *
 * The seed only inserts raw sessions and sets. total_volume, personal_records
 * and split_days.last_trained_date are all filled in by the triggers, which
 * is itself a demonstration that the database logic works.
 *
 * Usage: node scripts/generate-demo-data.js
 */
const fs = require('fs');
const path = require('path');

// bcrypt (10 rounds) of "physiq123" — demo accounts only
const DEMO_PASSWORD_HASH = '$2a$10$tvEaJlUNMX8eOuW5rgrRRuMZUAJLcxRcz3lQoKVgZ3SxVCQYdbQLK';

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1718);
const pick = (items) => items[Math.floor(rand() * items.length)];

// Day offsets before today. Ends with Pull 6 days ago (overdue), Legs 3 days ago
// (ready) and Push yesterday (recovering) so the dashboard shows every status.
const SCHEDULE = [
  [35, 'Push'], [33, 'Pull'], [32, 'Legs'], [30, 'Push'], [28, 'Pull'], [27, 'Legs'],
  [25, 'Push'], [23, 'Pull'], [21, 'Legs'], [20, 'Push'], [18, 'Pull'], [16, 'Legs'],
  [14, 'Push'], [13, 'Pull'], [11, 'Legs'], [9, 'Push'], [6, 'Pull'], [3, 'Legs'],
  [1, 'Push'],
];

// Starting top set for each exercise; `warmup` adds a light first set.
const PROGRAM = {
  Push: [
    { name: 'Barbell Bench Press', weight: 70, reps: 8, warmup: true },
    { name: 'Incline Dumbbell Press', weight: 24, reps: 9 },
    { name: 'Dumbbell Lateral Raise', weight: 10, reps: 11 },
    { name: 'Triceps Rope Pushdown', weight: 25, reps: 10 },
  ],
  Pull: [
    { name: 'Barbell Deadlift', weight: 130, reps: 5, warmup: true },
    { name: 'Lat Pulldown', weight: 55, reps: 9 },
    { name: 'Seated Cable Row', weight: 55, reps: 10 },
    { name: 'Hammer Curl', weight: 14, reps: 10 },
  ],
  Legs: [
    { name: 'Barbell Back Squat', weight: 100, reps: 6, warmup: true },
    { name: 'Romanian Deadlift', weight: 80, reps: 8 },
    { name: 'Leg Press', weight: 160, reps: 10 },
    { name: 'Standing Calf Raise', weight: 60, reps: 12 },
  ],
};

const NOTES = {
  4: 'First week back on PPL, keeping it controlled.',
  8: 'Short on sleep, kept the back-off sets tight.',
  12: 'Bench moving fast today.',
  16: 'Deadlift felt smooth, grip was the limit.',
  17: 'Squat depth on point, legs cooked.',
};

const sqlVar = (name) => '@ex_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, '');
const daysAgo = (n) => (n === 0 ? 'CURRENT_DATE' : `DATE_SUB(CURRENT_DATE, INTERVAL ${n} DAY)`);
const money = (n) => n.toFixed(2);
const clock = (minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}:00`;
};

// Same rule as sp_estimate_next_target
function nextTarget(last) {
  if (last.reps >= 10) return { weight: last.weight + 2.5, reps: 8 };
  return { weight: last.weight, reps: last.reps + 1 };
}

const out = [];
const emit = (line = '') => out.push(line);

emit('-- =============================================================================');
emit('-- Seed: demo accounts + 5 weeks of training history (GENERATED FILE)');
emit('-- Regenerate with: node scripts/generate-demo-data.js');
emit('-- Demo logins (password "physiq123"): alex@physiq.test (member), admin@physiq.test (admin)');
emit('-- =============================================================================');
emit();
emit('USE physiq_db;');
emit();
emit('-- Demo accounts');
emit('INSERT INTO users (name, email, password_hash, role, goal, height, starting_weight) VALUES');
emit(`('PhysiQ Admin', 'admin@physiq.test', '${DEMO_PASSWORD_HASH}', 'admin', 'maintenance', 175.00, 72.00),`);
emit(`('Alex Mercer', 'alex@physiq.test', '${DEMO_PASSWORD_HASH}', 'member', 'hypertrophy', 178.00, 76.00);`);
emit("SET @alex = (SELECT id FROM users WHERE email = 'alex@physiq.test');");
emit();
emit('-- An older, inactive split (only one split per user may be active)');
emit("INSERT INTO splits (user_id, split_name, is_active) VALUES (@alex, 'Upper / Lower', FALSE);");
emit('SET @old_split = LAST_INSERT_ID();');
emit("INSERT INTO split_days (split_id, body_part, day_order) VALUES (@old_split, 'Upper', 1), (@old_split, 'Lower', 2);");
emit();
emit('-- Active Push / Pull / Legs split');
emit("INSERT INTO splits (user_id, split_name, is_active) VALUES (@alex, 'Push / Pull / Legs', TRUE);");
emit('SET @ppl = LAST_INSERT_ID();');
emit('INSERT INTO split_days (split_id, body_part, day_order, min_rest_days) VALUES');
emit("(@ppl, 'Push', 1, 2), (@ppl, 'Pull', 2, 2), (@ppl, 'Legs', 3, 2);");
emit("SET @day_push = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Push');");
emit("SET @day_pull = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Pull');");
emit("SET @day_legs = (SELECT id FROM split_days WHERE split_id = @ppl AND body_part = 'Legs');");
emit('INSERT INTO split_day_muscles (split_day_id, muscle_group_id)');
emit('SELECT d.id, mg.id FROM split_days d JOIN muscle_groups mg');
emit("  ON (d.body_part = 'Push' AND mg.name IN ('Chest', 'Shoulders', 'Triceps'))");
emit("  OR (d.body_part = 'Pull' AND mg.name IN ('Back', 'Biceps'))");
emit("  OR (d.body_part = 'Legs' AND mg.name IN ('Quads', 'Hamstrings', 'Glutes', 'Calves'))");
emit('WHERE d.split_id = @ppl;');
emit("INSERT INTO split_day_muscles (split_day_id, muscle_group_id)");
emit("SELECT d.id, mg.id FROM split_days d JOIN muscle_groups mg");
emit("  ON (d.body_part = 'Upper' AND mg.region = 'upper') OR (d.body_part = 'Lower' AND mg.region = 'lower')");
emit('WHERE d.split_id = @old_split;');
emit();
emit('-- Exercise ids');
const allExercises = Object.values(PROGRAM).flat();
for (const ex of allExercises) {
  emit(`SET ${sqlVar(ex.name)} = (SELECT id FROM exercises WHERE name = '${ex.name}');`);
}
emit();

// Progression state per exercise: the last top set actually achieved
const state = new Map(allExercises.map((ex) => [ex.name, null]));

SCHEDULE.forEach(([offset, day], index) => {
  const start = 17 * 60 + 30 + Math.floor(rand() * 90); // 17:30 - 19:00
  const duration = 55 + Math.floor(rand() * 26); // 55 - 80 min
  const note = NOTES[index] ? `'${NOTES[index]}'` : 'NULL';
  const date = daysAgo(offset);

  emit(`-- ${day}, ${offset} day(s) ago`);
  emit('INSERT INTO workout_sessions (user_id, split_day_id, session_date, body_part, started_at, ended_at, notes) VALUES');
  emit(
    `(@alex, @day_${day.toLowerCase()}, ${date}, '${day}', TIMESTAMP(${date}, '${clock(start)}'), ` +
      `TIMESTAMP(${date}, '${clock(start + duration)}'), ${note});`
  );
  emit('SET @s = LAST_INSERT_ID();');

  const rows = [];
  for (const ex of PROGRAM[day]) {
    const last = state.get(ex.name);
    const target = last ? nextTarget(last) : { weight: ex.weight, reps: ex.reps };
    // Hit the target ~80% of the time, otherwise repeat last performance
    const top = !last || rand() < 0.8 ? target : { ...last };
    state.set(ex.name, top);

    let setNumber = 1;
    if (ex.warmup) {
      const warmWeight = Math.round((top.weight * 0.5) / 2.5) * 2.5;
      rows.push(`(@s, ${sqlVar(ex.name)}, ${setNumber++}, 10, ${money(warmWeight)}, TRUE, NULL)`);
    }
    const workingSets = [top.reps, Math.max(top.reps - 1, 1), Math.max(top.reps - 2, 1)];
    workingSets.forEach((reps, i) => {
      const rpe = pick(i === 0 ? ['8.0', '8.5', '9.0'] : ['8.5', '9.0', '9.5']);
      rows.push(`(@s, ${sqlVar(ex.name)}, ${setNumber++}, ${reps}, ${money(top.weight)}, FALSE, ${rpe})`);
    });
  }
  emit('INSERT INTO sets (session_id, exercise_id, set_number, reps, weight, is_warmup, rpe) VALUES');
  emit(rows.join(',\n') + ';');
  emit();
});

emit('-- Weekly body measurements (lean bulk)');
emit('INSERT INTO body_measurements (user_id, recorded_on, weight, waist, chest, arms) VALUES');
const measurements = [
  [35, 76.0, 81.0, 100.0, 37.0],
  [28, 76.3, 81.0, 100.4, 37.2],
  [21, 76.4, 81.2, 100.6, 37.3],
  [14, 76.8, 81.3, 101.0, 37.5],
  [7, 77.0, 81.4, 101.2, 37.6],
  [0, 77.2, 81.5, 101.5, 37.8],
];
emit(
  measurements
    .map(([d, w, waist, chest, arms]) => `(@alex, ${daysAgo(d)}, ${money(w)}, ${money(waist)}, ${money(chest)}, ${money(arms)})`)
    .join(',\n') + ';'
);
emit();

emit('-- Daily fuel for the last week (targets computed by sp_ensure_daily_fuel)');
for (let d = 6; d >= 0; d--) {
  // Today is half-way through the day; earlier days land between 70% and 110%
  const protein = d === 0 ? 0.45 : 0.7 + rand() * 0.4;
  const water = d === 0 ? 0.4 : 0.65 + rand() * 0.45;
  emit(`CALL sp_ensure_daily_fuel(@alex, ${daysAgo(d)});`);
  emit(
    `UPDATE user_daily_fuel SET protein_logged_g = ROUND(protein_target_g * ${protein.toFixed(2)}), ` +
      `water_logged_ml = ROUND(water_target_ml * ${water.toFixed(2)} / 250) * 250 ` +
      `WHERE user_id = @alex AND fuel_date = ${daysAgo(d)};`
  );
}

const target = path.join(__dirname, '..', 'database', 'seeds', 'demo_data.sql');
fs.writeFileSync(target, out.join('\n') + '\n');
console.log(`Wrote ${path.relative(process.cwd(), target)} (${SCHEDULE.length} sessions)`);
