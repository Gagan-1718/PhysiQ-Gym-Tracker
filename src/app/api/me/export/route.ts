import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { toStory, type StoryDoc } from '@/lib/journey';
import { requireUser } from '@/lib/session';

// GET /api/me/export — everything PhysiQ stores about the signed-in member, as one JSON file.
// Reads both databases (MySQL: structured history; MongoDB: journal, notes, routines).
// The password hash is never included. Photo files are not embedded; their names are listed.
export const GET = route(async () => {
  const me = await requireUser();

  const [profile, splits, sessions, sets, records, measurements, fuel] = await Promise.all([
    select('SELECT id, name, email, role, goal, height, starting_weight, weekly_goal, created_at FROM users WHERE id = ?', [me.id]),
    select(
      `SELECT s.id AS split_id, s.split_name, s.is_active, sd.id AS day_id, sd.body_part, sd.day_order, sd.min_rest_days, sd.last_trained_date
       FROM splits s LEFT JOIN split_days sd ON sd.split_id = s.id WHERE s.user_id = ? ORDER BY s.id, sd.day_order`,
      [me.id]
    ),
    select('SELECT id, session_date, body_part, split_day_id, started_at, ended_at, total_volume, notes FROM workout_sessions WHERE user_id = ? ORDER BY session_date, id', [me.id]),
    select(
      `SELECT s.id, s.session_id, e.name AS exercise, s.set_number, s.reps, s.weight, s.is_warmup, s.rpe
       FROM sets s JOIN workout_sessions ws ON ws.id = s.session_id JOIN exercises e ON e.id = s.exercise_id
       WHERE ws.user_id = ? ORDER BY s.session_id, s.id`,
      [me.id]
    ),
    select('SELECT exercise_name, muscle_group, weight, reps, estimated_1rm, achieved_on, session_id FROM view_personal_records_detailed WHERE user_id = ? ORDER BY exercise_name', [me.id]),
    select('SELECT recorded_on, weight, waist, chest, arms FROM body_measurements WHERE user_id = ? ORDER BY recorded_on', [me.id]),
    select('SELECT fuel_date, protein_target_g, protein_logged_g, water_target_ml, water_logged_ml, calorie_target FROM user_daily_fuel WHERE user_id = ? ORDER BY fuel_date', [me.id]),
  ]);

  const db = await getMongoDb();
  const [stories, routines] = await Promise.all([
    db.collection<StoryDoc>('journey_stories').find({ user_id: me.id }).sort({ date: 1, _id: 1 }).toArray(),
    db.collection('custom_routines').find({ user_id: me.id }).sort({ name: 1 }).toArray(),
  ]);

  // Nest the sets under their workouts so the file reads like a training log
  const setsBySession = new Map<number, unknown[]>();
  for (const s of sets as { session_id: number }[]) setsBySession.set(s.session_id, [...(setsBySession.get(s.session_id) ?? []), s]);

  const body = {
    exportedAt: new Date().toISOString(),
    format: 'physiq-export/1',
    profile: (profile as unknown[])[0],
    splits,
    workouts: (sessions as { id: number }[]).map((w) => ({ ...w, sets: setsBySession.get(w.id) ?? [] })),
    personalRecords: records,
    bodyMeasurements: measurements,
    dailyFuel: fuel,
    journey: stories.map((s) => ({ ...toStory(s), photo_file: s.photo_file ?? null })),
    routines: routines.map((r) => ({ name: r.name, focus: r.focus ?? null, notes: r.notes ?? null, exercises: r.exercises, times_used: r.times_used ?? 0 })),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="physiq-export-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
