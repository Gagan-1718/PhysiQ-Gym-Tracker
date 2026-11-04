import type { ObjectId } from 'mongodb';
import type { JourneyStory } from '@/types/database';

/** Shape of a journey_stories document as stored in MongoDB. */
export interface StoryDoc {
  _id: ObjectId;
  user_id: number;
  date: string;
  kind: JourneyStory['kind'];
  session_id?: number | null;
  caption?: string | null;
  mood?: number | null;
  energy?: number | null;
  tags?: string[];
  weight_snapshot?: number | null;
  photo_file?: string | null;
  photo_angle?: JourneyStory['photo_angle'];
  milestone?: JourneyStory['milestone'];
  highlights?: JourneyStory['highlights'];
  created_at: Date;
}

/** Document -> client JSON. The photo is exposed as an authenticated URL, never a disk path. */
export function toStory(d: StoryDoc): JourneyStory {
  return {
    id: d._id.toString(),
    date: d.date,
    kind: d.kind,
    session_id: d.session_id ?? null,
    caption: d.caption ?? null,
    mood: d.mood ?? null,
    energy: d.energy ?? null,
    tags: d.tags ?? [],
    weight_snapshot: d.weight_snapshot === undefined || d.weight_snapshot === null ? null : Number(d.weight_snapshot),
    photo_url: d.photo_file ? `/api/photos/${d.photo_file}` : null,
    photo_angle: d.photo_angle ?? null,
    milestone: d.milestone ?? null,
    highlights: d.highlights ?? [],
    created_at: d.created_at.toISOString(),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, not in the future beyond a 1-day timezone allowance. */
export function isValidStoryDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + 1);
  limit.setHours(23, 59, 59, 999);
  return dt.getTime() <= limit.getTime();
}

/** Normalise tags: lowercase, trimmed, unique, max 12. */
export function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

/** Session counts that earn an automatic milestone story. */
export const SESSION_MILESTONES = [1, 10, 25, 50, 100, 250];
