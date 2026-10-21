import { ApiError, ok, route } from '@/lib/api';
import { execute } from '@/lib/mysql';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/body/:id
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid id.');
  const res = await execute('DELETE FROM body_measurements WHERE id = ? AND user_id = ?', [id, me.id]);
  if (res.affectedRows === 0) throw new ApiError(404, 'Measurement not found.');
  return ok({ deleted: id });
});
