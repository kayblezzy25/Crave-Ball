import { getSupabase } from './config';
import { logger } from '../utils/logger';

const STARTUP_IMAGE_PATH = 'startup/current-image.jpg';

/**
 * Uploads a buffer to the Supabase Storage bucket as the active startup
 * image and returns its storage path plus a public download URL.
 * Overwrites the previous file at the same path (upsert) so old images do
 * not accumulate in storage.
 */
export async function uploadStartupImage(
  buffer: Buffer,
  contentType: string,
  bucket: string
): Promise<{ path: string; url: string }> {
  const supabase = getSupabase();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(STARTUP_IMAGE_PATH, buffer, {
      contentType,
      upsert: true,
      cacheControl: '0',
    });

  if (uploadError) {
    logger.error('Failed to upload startup image to Supabase Storage', uploadError);
    throw new Error('Could not upload the image to Supabase Storage.');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(STARTUP_IMAGE_PATH);

  logger.info('Startup image uploaded to Supabase Storage', { path: STARTUP_IMAGE_PATH });
  return { path: STARTUP_IMAGE_PATH, url: data.publicUrl };
}

export function startupImagePath(): string {
  return STARTUP_IMAGE_PATH;
}
