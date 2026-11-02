import { ApiError, ok, readJson, route } from '@/lib/api';
import { execute, withTransaction } from '@/lib/mysql';
import { requireAdmin } from '@/lib/session';
import { ExerciseSchema } from '@/lib/schemas';

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
  return ok({ id });
});

// DELETE /api/exercises/:id — only possible while no one has logged it (FK RESTRICT)
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = parseId((await params).id);
  const res = await withTransaction((conn) => execute('DELETE FROM exercises WHERE id = ?', [id], conn), { actingUserId: admin.id });
  if (res.affectedRows === 0) throw new ApiError(404, 'Exercise not found.');
  return ok({ deleted: id });
});
