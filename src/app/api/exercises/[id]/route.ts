import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, selectOne, withTransaction } from '@/lib/mysql';
import { requireAdmin } from '@/lib/session';
import { ExerciseSchema } from '@/lib/schemas';
import { deleteVector, upsertExerciseVector } from '@/lib/vector';
import type { Exercise } from '@/types/database';

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid exercise id.');
  return id;
}

// PATCH /api/exercises/:id — admin edit (audited with before/after JSON)
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId((await params).id);
  const body = ExerciseSchema.parse(await readJson(req));
  const res = await withTransaction(
    (conn) =>
      execute(
        'UPDATE exercises SET name = ?, muscle_group_id = ?, equipment_needed = ?, instructions = ? WHERE id = ?',
        [body.name, body.muscleGroupId, body.equipment, body.instructions || null, id],
        conn
      ),
    { actingUserId: admin.id }
  );
  if (res.affectedRows === 0) throw new ApiError(404, 'Exercise not found.');

  // Keep the exercise's vector in MongoDB in step (after the MySQL commit, best effort)
  const exercise = await selectOne<Exercise>(
    `SELECT e.id, e.name, e.muscle_group_id, mg.name AS muscle_group, e.equipment_needed, e.instructions, e.media_key
     FROM exercises e JOIN muscle_groups mg ON mg.id = e.muscle_group_id WHERE e.id = ?`,
    [id]
  );
  if (exercise) await upsertExerciseVector(exercise).catch((err) => console.warn('vector sync failed', err));
  return ok({ id });
});

// DELETE /api/exercises/:id — only possible while no one has logged it (FK RESTRICT)
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId((await params).id);
  const res = await withTransaction((conn) => execute('DELETE FROM exercises WHERE id = ?', [id], conn), { actingUserId: admin.id });
  if (res.affectedRows === 0) throw new ApiError(404, 'Exercise not found.');
  await deleteVector('exercise', id).catch((err) => console.warn('vector delete failed', err));
  return ok({ deleted: id });
});
