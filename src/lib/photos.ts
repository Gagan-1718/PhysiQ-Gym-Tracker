import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Private progress-photo storage on local disk: uploads/<user_id>/<uuid>.<ext>
 *
 * - Never under /public: photos are only reachable through /api/photos/<file>,
 *   which resolves the folder from the *session* user id, so one member can
 *   never request another member's file.
 * - File names are server-generated UUIDs (no user-controlled path segments).
 * - The type is decided from the file's magic bytes, not its name or MIME header.
 */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export type PhotoExt = 'jpg' | 'png' | 'webp';
export const PHOTO_MIME: Record<PhotoExt, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const FILE_RE = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

function root(): string {
  // The upload folder is runtime data, not part of the build: tell Turbopack not to trace it into the bundle
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}

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

function resolveFor(userId: number, file: string): string {
  if (!isPhotoFileName(file)) throw new Error('Invalid photo file name');
  const full = path.resolve(root(), String(userId), file);
  // Defence in depth: the resolved path must stay inside this user's folder
  if (!full.startsWith(path.resolve(root(), String(userId)) + path.sep)) throw new Error('Invalid photo path');
  return full;
}

export async function savePhoto(userId: number, buf: Buffer, ext: PhotoExt): Promise<string> {
  const file = `${randomUUID()}.${ext}`;
  const full = resolveFor(userId, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: 'wx' }); // never overwrite
  return file;
}

export async function readPhoto(userId: number, file: string): Promise<Buffer | null> {
  try {
    return await readFile(/* turbopackIgnore: true */ resolveFor(userId, file));
  } catch {
    return null;
  }
}

export async function deletePhoto(userId: number, file: string): Promise<void> {
  try {
    await unlink(resolveFor(userId, file));
  } catch {
    // already gone: nothing to clean up
  }
}
