import { Telegram } from 'telegraf';
import { uploadStartupImage } from '../supabase/storage';
import { updateStartupImage } from './botSettings';
import { logger } from '../utils/logger';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Sniffs the actual image format from its magic bytes rather than trusting
 * Telegram's file server Content-Type header (it commonly serves
 * application/octet-stream regardless of the real format). Falls back to
 * JPEG, which is what Telegram always produces for a compressed `photo`
 * upload — the only path that reaches this function.
 */
function detectImageContentType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6).match(/^GIF8[79]a$/)) {
    return 'image/gif';
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp';
  }
  return 'image/jpeg';
}

/**
 * Downloads a Telegram-hosted photo into memory, validates it, uploads it
 * to Supabase Storage, and records the new reference in the database.
 * The file only ever touches local memory/tmp — Railway's filesystem is
 * never used as permanent storage.
 */
export async function processAdminStartupImageUpload(
  telegram: Telegram,
  fileId: string,
  updatedBy: number,
  bucket: string
): Promise<{ url: string }> {
  const fileLink = await telegram.getFileLink(fileId);

  const response = await fetch(fileLink.href);
  if (!response.ok) {
    throw new Error('Could not download the image from Telegram.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = detectImageContentType(buffer);

  if (buffer.byteLength === 0) {
    throw new Error('The downloaded image is empty.');
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `The image is too large (${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB). Max is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`
    );
  }

  const { path, url } = await uploadStartupImage(buffer, contentType, bucket);
  await updateStartupImage(path, url, updatedBy);

  logger.info('Admin startup image upload processed', { updatedBy, bytes: buffer.byteLength });
  return { url };
}
