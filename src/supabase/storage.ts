import { getSupabase } from './config';
import { logger } from '../utils/logger';

/**
 * The default single-bot deployment keeps the original unprefixed path;
 * only a non-default BOT_INSTANCE_ID (multiple bots sharing one bucket)
 * gets namespaced, so existing single-bot deployments are unaffected.
 */
function startupImageObjectPath(botInstanceId: string): string {
  return botInstanceId === 'general'
    ? 'startup/current-image.jpg'
    : `${botInstanceId}/startup/current-image.jpg`;
}

/**
 * Uploads a buffer to the Supabase Storage bucket as the active startup
 * image and returns its storage path plus a public download URL.
 * Overwrites the previous file at the same path (upsert) so old images do
 * not accumulate in storage.
 */
export async function uploadStartupImage(
  buffer: Buffer,
  contentType: string,
  bucket: string,
  botInstanceId: string
): Promise<{ path: string; url: string }> {
  const supabase = getSupabase();
  const objectPath = startupImageObjectPath(botInstanceId);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType,
      upsert: true,
      cacheControl: '0',
    });

  if (uploadError) {
    logger.error('Failed to upload startup image to Supabase Storage', uploadError);
    throw new Error('Could not upload the image to Supabase Storage.');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  logger.info('Startup image uploaded to Supabase Storage', { path: objectPath });
  return { path: objectPath, url: data.publicUrl };
}
