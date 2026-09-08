import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { isAuthorizedAdmin } from '../../services/adminService';
import { processAdminStartupImageUpload } from '../../services/imageService';
import { getAdminAction, clearAdminAction } from '../session';
import { adminPanelKeyboard } from '../keyboards/adminKeyboard';
import { logger } from '../../utils/logger';

/**
 * Handles a photo sent by an admin who is in the "awaiting_image" flow.
 * Ignores photos from anyone else / any other state so it never interferes
 * with normal user traffic.
 */
export async function handleAdminPhotoUpload(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAuthorizedAdmin(userId)) return;
  if (getAdminAction(userId) !== 'awaiting_image') return;
  if (!ctx.has(message('photo'))) return;

  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];

  const statusMessage = await ctx.reply('⏳ Uploading image to Firebase Cloud Storage...');

  try {
    await processAdminStartupImageUpload(ctx.telegram, largest.file_id, userId);
    clearAdminAction(userId);
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      statusMessage.message_id,
      undefined,
      '✅ Startup image updated. It is now live for all users.'
    );
    await ctx.reply('🛠 ADMIN PANEL\n\nChoose an option:', adminPanelKeyboard());
    logger.info('Admin updated startup image', { userId });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Admin image upload failed', error, { userId });
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      statusMessage.message_id,
      undefined,
      `❌ Could not update the image: ${messageText}`
    );
  }
}
