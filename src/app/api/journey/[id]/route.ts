import { ObjectId } from 'mongodb';
import { ApiError, ok, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import type { StoryDoc } from '@/lib/journey';
import { deletePhoto } from '@/lib/photos';
import { requireUser } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/journey/:id — removes the story and, for photo stories, the file on disk
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Invalid story id.');
  const db = await getMongoDb();
  // user_id in the filter: members can only delete their own stories
  const doc = await db.collection<StoryDoc>('journey_stories').findOneAndDelete({ _id: new ObjectId(id), user_id: me.id });
  if (!doc) throw new ApiError(404, 'Story not found.');
  if (doc.photo_file) await deletePhoto(me.id, doc.photo_file);
  return ok({ deleted: id });
});
