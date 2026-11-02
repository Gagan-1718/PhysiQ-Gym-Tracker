'use client';

/**
 * Prepare a photo for upload: apply EXIF rotation, scale the long edge down to
 * `maxEdge`, re-encode as JPEG. Re-encoding through a canvas drops all metadata,
 * including GPS coordinates, so a progress photo never leaks where it was taken.
 * Typical phone photos shrink from 3-6 MB to a few hundred KB.
 */
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.86): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format is not supported. Use a JPEG, PNG or WebP photo.');
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image in this browser.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not process the image.');
  return blob;
}
