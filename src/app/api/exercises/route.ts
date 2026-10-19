import { ok, readJson, route } from '@/lib/api';
import { execute, select, selectOne, withTransaction } from '@/lib/mysql';
import { requireAdmin, requireUser } from '@/lib/session';
import { ExerciseSchema } from '@/lib/schemas';
import type { Exercise } from '@/types/database';

const EXERCISE_COLUMNS = `e.id, e.name, e.muscle_group_id, mg.name AS muscle_group, e.equipment_needed, e.instructions`;

// GET /api/exercises — master library, sorted by muscle group then name
export const GET = route(async () => {
  await requireUser();
  const exercises = await select<Exercise>(
    `SELECT ${EXERCISE_COLUMNS}
     FROM exercises e JOIN muscle_groups mg ON mg.id = e.muscle_group_id
     ORDER BY mg.id, e.name`
  );
  const muscleGroups = await select<{ id: number; name: string; region: string }>('SELECT id, name, region FROM muscle_groups ORDER BY id');
  return ok({ exercises, muscleGroups });
});

// POST /api/exercises — admins add to the master library (audited by trg_exercises_ai)
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const body = ExerciseSchema.parse(await readJson(req));
  const id = await withTransaction(
    async (conn) => {
      const res = await execute(
        'INSERT INTO exercises (name, muscle_group_id, equipment_needed, instructions) VALUES (?, ?, ?, ?)',
        [body.name, body.muscleGroupId, body.equipment, body.instructions || null],
        conn
      );
      return res.insertId;
    },
    { actingUserId: admin.id }
  );
  const exercise = await selectOne<Exercise>(
    `SELECT ${EXERCISE_COLUMNS} FROM exercises e JOIN muscle_groups mg ON mg.id = e.muscle_group_id WHERE e.id = ?`,
    [id]
  );
  return ok(exercise, 201);
});
