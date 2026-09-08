import { getBucket } from './config';
import { logger } from '../utils/logger';

const STARTUP_IMAGE_PATH = 'bot/startup/current-image.jpg';

/**
 * Uploads a buffer to Firebase Cloud Storage as the active startup image
 * and returns its storage path plus a long-lived public download URL.
 * Overwrites the previous file at the same path so old images do not
 * accumulate in storage.
 */
export async function uploadStartupImage(
  buffer: Buffer,
  contentType: string
): Promise<{ path: string; url: string }> {
  const bucket = getBucket();
  const file = bucket.file(STARTUP_IMAGE_PATH);

  try {
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'no-cache, max-age=0' },
    });
    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${STARTUP_IMAGE_PATH}`;
    logger.info('Startup image uploaded to Cloud Storage', { path: STARTUP_IMAGE_PATH });
    return { path: STARTUP_IMAGE_PATH, url };
  } catch (error) {
    logger.error('Failed to upload startup image to Cloud Storage', error);
    throw new Error('Could not upload the image to Firebase Cloud Storage.');
  }
}
