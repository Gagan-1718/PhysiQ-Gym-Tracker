import { z } from 'zod';
import { ObjectId, type Filter } from 'mongodb';
import { ApiError, ok, readJson, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import { cleanTags, isValidStoryDate, toStory, type StoryDoc } from '@/lib/journey';
import { requireUser } from '@/lib/session';

const KINDS = ['workout_journal', 'progress_photo', 'milestone', 'note'] as const;

// GET /api/journey?kind=&tag=&q=&before=<date>_<id>&limit=
// Chronological feed (newest first) with keyset pagination on (date, _id), served by idx_user_timeline.
//   kind  -> idx_user_kind_date        tag -> idx_user_tags (multikey)
//   q     -> text index txt_caption_tags (whole-word search; always scoped to this user)
export const GET = route(async (req) => {
  const me = await requireUser();
  const params = new URL(req.url).searchParams;
  const limit = Math.min(30, Math.max(1, Number(params.get('limit')) || 15));

  const filter: Filter<StoryDoc> = { user_id: me.id };

  const kind = params.get('kind');
  if (kind) {
    if (!(KINDS as readonly string[]).includes(kind)) throw new ApiError(400, 'Unknown kind.');
    filter.kind = kind as StoryDoc['kind'];
  }
  const tag = params.get('tag')?.trim().toLowerCase();
  if (tag) filter.tags = tag;
  const q = params.get('q')?.trim();
  if (q) filter.$text = { $search: q.slice(0, 80) };

  const before = params.get('before');
  if (before) {
    const [date, id] = before.split('_');
    if (!isValidStoryDate(date) || !ObjectId.isValid(id)) throw new ApiError(400, 'Invalid cursor.');
    // (date, _id) < (cursor date, cursor id) without OFFSET
    filter.$or = [{ date: { $lt: date } }, { date, _id: { $lt: new ObjectId(id) } }];
  }

  const db = await getMongoDb();
  const docs = await db.collection<StoryDoc>('journey_stories').find(filter).sort({ date: -1, _id: -1 }).limit(limit).toArray();
  const last = docs[docs.length - 1];
  return ok({
    stories: docs.map(toStory),
    nextCursor: docs.length === limit && last ? `${last.date}_${last._id.toString()}` : null,
  });
});

const NoteSchema = z.object({
  date: z.string().refine(isValidStoryDate, 'use a real date, not in the future'),
  caption: z.string().trim().min(1, 'write something').max(1000),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
});

// POST /api/journey — a free-form note (workout journals and milestones are created by the workout flow)
export const POST = route(async (req) => {
  const me = await requireUser();
  const n = NoteSchema.parse(await readJson(req));
  const db = await getMongoDb();
  const doc = {
    user_id: me.id,
    date: n.date,
    kind: 'note' as const,
    caption: n.caption,
    mood: n.mood ?? null,
    energy: n.energy ?? null,
    tags: cleanTags(n.tags),
    created_at: new Date(),
  };
  const res = await db.collection('journey_stories').insertOne(doc);
  return ok({ id: res.insertedId.toString() }, 201);
});
