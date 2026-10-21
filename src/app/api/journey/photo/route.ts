import { ApiError, ok, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import { selectOne } from '@/lib/mysql';
import { cleanTags, isValidStoryDate } from '@/lib/journey';
import { deletePhoto, detectImage, MAX_PHOTO_BYTES, savePhoto } from '@/lib/photos';
import { requireUser } from '@/lib/session';

const ANGLES = ['front', 'side', 'back', 'other'] as const;

// POST /api/journey/photo — multipart: file, date, angle, caption?, tags? (comma separated)
// The image goes to private disk storage; the story document (MongoDB) records the
// file name, angle and the body weight in force on that date (fn_current_weight, MySQL).
export const POST = route(async (req) => {
  const me = await requireUser();

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_PHOTO_BYTES + 100_000) throw new ApiError(413, 'Photo is too large (max 6 MB).');
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError(415, 'Send the photo as multipart/form-data.');
  }

  const form = await req.formData().catch(() => {
    throw new ApiError(400, 'Could not read the upload.');
  });
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'Choose a photo.');
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) throw new ApiError(413, 'Photo must be between 1 byte and 6 MB.');

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = detectImage(buf);
  if (!ext) throw new ApiError(415, 'Only JPEG, PNG or WebP photos are allowed.');

  const date = String(form.get('date') ?? '');
  if (!isValidStoryDate(date)) throw new ApiError(400, 'Use a real date, not in the future.');
  const angle = String(form.get('angle') ?? 'front');
  if (!(ANGLES as readonly string[]).includes(angle)) throw new ApiError(400, 'Unknown angle.');
  const caption = String(form.get('caption') ?? '').trim().slice(0, 1000) || null;
  const tags = cleanTags(String(form.get('tags') ?? '').split(','));

  const w = await selectOne<{ weight: number | null }>('SELECT fn_current_weight(?, ?) AS weight', [me.id, date]);

  const photoFile = await savePhoto(me.id, buf, ext);
  try {
    const db = await getMongoDb();
    const res = await db.collection('journey_stories').insertOne({
      user_id: me.id,
      date,
      kind: 'progress_photo',
      caption,
      tags,
      photo_file: photoFile,
      photo_angle: angle,
      weight_snapshot: w?.weight ?? null,
      created_at: new Date(),
    });
    return ok({ id: res.insertedId.toString(), photoUrl: `/api/photos/${photoFile}` }, 201);
  } catch (err) {
    await deletePhoto(me.id, photoFile); // no orphan file if the document could not be written
    throw err;
  }
});
