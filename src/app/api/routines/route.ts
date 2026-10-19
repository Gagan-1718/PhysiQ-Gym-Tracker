import { z } from 'zod';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { select } from '@/lib/mysql';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';
import type { Routine } from '@/types/database';

type RoutineDoc = Omit<Routine, 'id' | 'last_used_at' | 'updated_at'> & {
  _id: { toString(): string };
  user_id: number;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const toClient = (d: RoutineDoc): Routine => ({
  id: d._id.toString(),
  name: d.name,
  focus: d.focus ?? null,
  notes: d.notes ?? null,
  exercises: d.exercises,
  times_used: d.times_used ?? 0,
  last_used_at: d.last_used_at ? d.last_used_at.toISOString() : null,
  updated_at: d.updated_at.toISOString(),
});

// GET /api/routines — the user's templates (MongoDB), most recently used first
export const GET = route(async () => {
  const me = await requireUser();
  const db = await getMongoDb();
  const docs = await db
    .collection<RoutineDoc>('custom_routines')
    .find({ user_id: me.id })
    .sort({ last_used_at: -1, updated_at: -1 })
    .limit(50)
    .toArray();
  return ok(docs.map(toClient));
});

const RoutineSchema = z.object({
  name: z.string().trim().min(1).max(60),
  focus: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        targetSets: z.number().int().min(1).max(10),
        repMin: z.number().int().min(1).max(100).optional(),
        repMax: z.number().int().min(1).max(100).optional(),
        restSeconds: z.number().int().min(0).max(600).optional(),
        superset: z.string().trim().max(2).nullable().optional(),
      })
    )
    .min(1)
    .max(20),
});

// POST /api/routines — save a template. Exercise ids are checked against MySQL first,
// because no database can enforce a foreign key across the two stores.
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = RoutineSchema.parse(await readJson(req));

  const ids = [...new Set(body.exercises.map((e) => e.exerciseId))];
  const found = await select<{ id: number; name: string }>('SELECT id, name FROM exercises WHERE id IN (?)', [ids]);
  const nameById = new Map(found.map((f) => [f.id, f.name]));
  const missing = ids.filter((id) => !nameById.has(id));
  if (missing.length) throw new ApiError(400, `Unknown exercise id(s): ${missing.join(', ')}`);

  const now = new Date();
  const doc = {
    user_id: me.id,
    name: body.name,
    focus: body.focus ?? null,
    notes: body.notes ?? null,
    exercises: body.exercises.map((e) => ({
      exercise_id: e.exerciseId,
      name: nameById.get(e.exerciseId)!, // snapshot for fast reads
      target_sets: e.targetSets,
      ...(e.repMin !== undefined && { rep_min: e.repMin }),
      ...(e.repMax !== undefined && { rep_max: e.repMax }),
      ...(e.restSeconds !== undefined && { rest_seconds: e.restSeconds }),
      superset: e.superset ?? null,
    })),
    times_used: 0,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };
  const db = await getMongoDb();
  const res = await db.collection('custom_routines').insertOne(doc);
  return ok({ id: res.insertedId.toString() }, 201);
});
