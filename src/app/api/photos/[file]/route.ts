import { NextResponse } from 'next/server';
import { ApiError, route } from '@/lib/api';
import { isPhotoFileName, PHOTO_MIME, readPhoto, type PhotoExt } from '@/lib/photos';
import { requireUser } from '@/lib/session';

type Ctx = { params: { file: string } };

// GET /api/photos/<uuid>.<ext> — streams the signed-in member's own photo.
// The folder comes from the session user id, so another member's file name simply 404s.
export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  if (!isPhotoFileName(params.file)) throw new ApiError(404, 'Photo not found.');
  const buf = await readPhoto(me.id, params.file);
  if (!buf) throw new ApiError(404, 'Photo not found.');
  const ext = params.file.split('.').pop() as PhotoExt;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': PHOTO_MIME[ext],
      'Content-Length': String(buf.length),
      // Private: browser may keep it, shared caches and CDNs may not. File names are never reused.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});
