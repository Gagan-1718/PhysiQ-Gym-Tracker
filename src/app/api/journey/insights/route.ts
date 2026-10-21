import { ok, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import { toStory, type StoryDoc } from '@/lib/journey';
import { requireUser } from '@/lib/session';
import type { JourneyInsights } from '@/types/database';

// GET /api/journey/insights — one aggregation ($facet) over the member's stories:
//   counts      $group by kind
//   moodByWeek  $dateTrunc to Monday, average mood/energy per week
//   topTags     $unwind tags -> $group -> $sort -> $limit
// plus the first and latest progress photo for the "then and now" card.
export const GET = route(async () => {
  const me = await requireUser();
  const col = (await getMongoDb()).collection<StoryDoc>('journey_stories');

  const [facets] = await col
    .aggregate<{
      counts: { _id: string; n: number }[];
      moodByWeek: { _id: Date; mood: number | null; energy: number | null; entries: number }[];
      topTags: { _id: string; n: number }[];
    }>([
      { $match: { user_id: me.id } },
      {
        $facet: {
          counts: [{ $group: { _id: '$kind', n: { $sum: 1 } } }],
          moodByWeek: [
            { $match: { mood: { $ne: null } } },
            { $addFields: { day: { $dateFromString: { dateString: '$date' } } } },
            { $group: { _id: { $dateTrunc: { date: '$day', unit: 'week', startOfWeek: 'monday' } }, mood: { $avg: '$mood' }, energy: { $avg: '$energy' }, entries: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $limit: 26 },
          ],
          topTags: [{ $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 8 }],
        },
      },
    ])
    .toArray();

  const photoFilter = { user_id: me.id, kind: 'progress_photo' as const, photo_file: { $type: 'string' as const } };
  const [first, latest] = await Promise.all([
    col.find(photoFilter).sort({ date: 1, _id: 1 }).limit(1).next(),
    col.find(photoFilter).sort({ date: -1, _id: -1 }).limit(1).next(),
  ]);

  const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
  const insights: JourneyInsights = {
    counts: Object.fromEntries((facets?.counts ?? []).map((c) => [c._id, c.n])),
    moodByWeek: (facets?.moodByWeek ?? []).map((w) => ({
      week: w._id.toISOString().slice(0, 10),
      mood: round(w.mood),
      energy: round(w.energy),
      entries: w.entries,
    })),
    topTags: (facets?.topTags ?? []).map((t) => ({ tag: t._id, count: t.n })),
    // Only offer "then and now" when there are two different photos
    firstPhoto: first && latest && !first._id.equals(latest._id) ? toStory(first) : null,
    latestPhoto: first && latest && !first._id.equals(latest._id) ? toStory(latest) : null,
  };
  return ok(insights);
});
