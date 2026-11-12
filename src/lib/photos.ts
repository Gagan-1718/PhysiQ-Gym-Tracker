import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { GridFSBucket } from 'mongodb';
import { getMongoDb } from './mongodb';

/**
 * Private progress photos, stored in MongoDB GridFS (bucket "progress_photos"):
 *   progress_photos.files   one document per photo: filename, length, uploadDate,
 *                           metadata { user_id, content_type }
 *   progress_photos.chunks  the bytes, split into 255 KB pieces
 * So photos live in the database, not on the server's disk: they survive a redeploy and
 * work on serverless hosts (Vercel), whose file system is read-only.
 *
 * - Photos are only reachable through /api/photos/<file>, which looks the file up by name
 *   AND the *session* user id, so one member can never fetch another member's photo.
 * - File names are server-generated UUIDs (no user-controlled names).
 * - The type is decided from the file's magic bytes, not its name or MIME header.
 * Photos saved by older versions on local disk (uploads/<user_id>/<file>) are still read.
 */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const PHOTO_BUCKET = 'progress_photos';

export type PhotoExt = 'jpg' | 'png' | 'webp';
export const PHOTO_MIME: Record<PhotoExt, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const FILE_RE = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

export function isPhotoFileName(name: string): boolean {
  return FILE_RE.test(name);
}

/** Identify JPEG / PNG / WebP from the first bytes; anything else (SVG, HTML, GIF…) is rejected. */
export function detectImage(buf: Buffer): PhotoExt | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function bucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await getMongoDb(), { bucketName: PHOTO_BUCKET });
}

export async function savePhoto(userId: number, buf: Buffer, ext: PhotoExt): Promise<string> {
  const file = `${randomUUID()}.${ext}`;
  const b = await bucket();
  await new Promise<void>((resolve, reject) => {
    const upload = b.openUploadStream(file, { metadata: { user_id: userId, content_type: PHOTO_MIME[ext] } });
    upload.once('finish', () => resolve());
    upload.once('error', reject);
    upload.end(buf);
  });
  return file;
}

export async function readPhoto(userId: number, file: string): Promise<Buffer | null> {
  if (!isPhotoFileName(file)) return null;
  const b = await bucket();
  const doc = await b.find({ filename: file, 'metadata.user_id': userId }, { limit: 1 }).next();
  if (doc) {
    const parts: Buffer[] = [];
    for await (const chunk of b.openDownloadStream(doc._id)) parts.push(chunk as Buffer);
    return Buffer.concat(parts);
  }
  // A photo saved on disk by an older version
  try {
    return await readFile(/* turbopackIgnore: true */ legacyPath(userId, file));
  } catch {
    return null;
  }
}

export async function deletePhoto(userId: number, file: string): Promise<void> {
  if (!isPhotoFileName(file)) return;
  const b = await bucket();
  for await (const doc of b.find({ filename: file, 'metadata.user_id': userId })) await b.delete(doc._id);
  try {
    await unlink(legacyPath(userId, file));
  } catch {
    // not on disk: nothing to clean up
  }
}

/** Every photo of a member (account deletion). */
export async function deleteAllPhotos(userId: number): Promise<void> {
  const b = await bucket();
  for await (const doc of b.find({ 'metadata.user_id': userId })) await b.delete(doc._id);
}

// ---- photos written to disk by versions before GridFS --------------------------------------------
function legacyPath(userId: number, file: string): string {
  // The upload folder is runtime data, not part of the build: tell Turbopack not to trace it into the bundle
  const root = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  const full = path.resolve(root, String(userId), file);
  if (!full.startsWith(path.resolve(root, String(userId)) + path.sep)) throw new Error('Invalid photo path');
  return full;
}
