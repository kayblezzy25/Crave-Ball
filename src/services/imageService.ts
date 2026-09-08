import { Telegram } from 'telegraf';
import { uploadStartupImage } from '../firebase/storage';
import { updateStartupImage } from './botSettings';
import { logger } from '../utils/logger';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Downloads a Telegram-hosted photo into memory, validates it, uploads it
 * to Firebase Cloud Storage, and records the new reference in Firestore.
 * The file only ever touches local memory/tmp — Railway's filesystem is
 * never used as permanent storage.
 */
export async function processAdminStartupImageUpload(
  telegram: Telegram,
  fileId: string,
  updatedBy: number
): Promise<{ url: string }> {
  const fileLink = await telegram.getFileLink(fileId);

  const response = await fetch(fileLink.href);
  if (!response.ok) {
    throw new Error('Could not download the image from Telegram.');
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, or WebP image.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength === 0) {
    throw new Error('The downloaded image is empty.');
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `The image is too large (${(buffer.byteLength / (1024 * 1024)).toFixed(1)}MB). Max is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`
    );
  }

  const { path, url } = await uploadStartupImage(buffer, contentType);
  await updateStartupImage(path, url, updatedBy);

  logger.info('Admin startup image upload processed', { updatedBy, bytes: buffer.byteLength });
  return { url };
}
