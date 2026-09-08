import { Context } from 'telegraf';
import { isAuthorizedAdmin } from '../../services/adminService';
import { adminPanelKeyboard } from '../keyboards/adminKeyboard';
import { clearAdminAction } from '../session';
import { logger } from '../../utils/logger';

export async function handleAdmin(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId || !isAuthorizedAdmin(userId)) {
    logger.warn('Unauthorized /admin attempt', { userId });
    await ctx.reply('⛔ Access denied. You are not authorized to use this command.');
    return;
  }

  clearAdminAction(userId);
  logger.info('Admin panel opened', { userId });
  await ctx.reply('🛠 ADMIN PANEL\n\nChoose an option:', adminPanelKeyboard());
}
