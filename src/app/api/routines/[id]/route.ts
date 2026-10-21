import { ObjectId } from 'mongodb';
import { ApiError, ok, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/routines/:id
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Invalid routine id.');
  const db = await getMongoDb();
  const res = await db.collection('custom_routines').deleteOne({ _id: new ObjectId(id), user_id: me.id });
  if (res.deletedCount === 0) throw new ApiError(404, 'Routine not found.');
  return ok({ deleted: id });
});
