import { Context } from 'telegraf';
import { isAuthorizedAdmin } from '../../services/adminService';
import { clearButtons, getStartupConfig } from '../../services/botSettings';
import { sendStartupContent } from '../commands/start';
import {
  adminPanelKeyboard,
  backToAdminKeyboard,
  buttonsMenuKeyboard,
} from '../keyboards/adminKeyboard';
import { setAdminAction, clearAdminAction } from '../session';
import { logger } from '../../utils/logger';

function isCallbackQuery(
  update: Context['update']
): update is Context['update'] & { callback_query: { data?: string } } {
  return 'callback_query' in update;
}

export async function handleAdminCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!isCallbackQuery(ctx.update) || !('data' in ctx.update.callback_query)) {
    return;
  }
  const data = ctx.update.callback_query.data;

  if (!userId || !isAuthorizedAdmin(userId)) {
    await ctx.answerCbQuery('Access denied.', { show_alert: true });
    return;
  }

  try {
    switch (data) {
      case 'admin:back': {
        clearAdminAction(userId);
        await ctx.editMessageText('🛠 ADMIN PANEL\n\nChoose an option:', adminPanelKeyboard());
        break;
      }

      case 'admin:image': {
        setAdminAction(userId, 'awaiting_image');
        await ctx.editMessageText(
          '🖼 Please upload the new startup image (send it as a photo).',
          backToAdminKeyboard()
        );
        break;
      }

      case 'admin:message': {
        setAdminAction(userId, 'awaiting_message');
        await ctx.editMessageText(
          '✏️ Please send the new startup message as plain text.',
          backToAdminKeyboard()
        );
        break;
      }

      case 'admin:buttons': {
        clearAdminAction(userId);
        const config = await getStartupConfig();
        const list =
          config.buttons.length === 0
            ? 'No buttons configured yet.'
            : config.buttons.map((b, i) => `${i + 1}. ${b.text} → ${b.url}`).join('\n');
        await ctx.editMessageText(`🔘 BUTTONS\n\n${list}`, buttonsMenuKeyboard());
        break;
      }

      case 'admin:buttons:add': {
        setAdminAction(userId, 'awaiting_button');
        await ctx.editMessageText(
          '➕ Send the button as:\nLabel | https://example.com',
          backToAdminKeyboard()
        );
        break;
      }

      case 'admin:buttons:clear': {
        await clearButtons(userId);
        await ctx.answerCbQuery('All buttons cleared.');
        await ctx.editMessageText('🔘 BUTTONS\n\nNo buttons configured yet.', buttonsMenuKeyboard());
        break;
      }

      case 'admin:preview': {
        clearAdminAction(userId);
        await ctx.answerCbQuery();
        await ctx.reply('👀 Preview — this is exactly what a user sees on /start:');
        await sendStartupContent(ctx.telegram, userId);
        return;
      }

      case 'admin:settings': {
        clearAdminAction(userId);
        const config = await getStartupConfig();
        const updatedAt = config.updated_at ? config.updated_at.toDate().toISOString() : 'never';
        await ctx.editMessageText(
          `⚙️ SETTINGS\n\nLast updated: ${updatedAt}\nUpdated by: ${config.updated_by ?? 'n/a'}\nButtons configured: ${config.buttons.length}`,
          backToAdminKeyboard()
        );
        break;
      }

      default:
        await ctx.answerCbQuery();
        return;
    }

    await ctx.answerCbQuery();
  } catch (error) {
    logger.error('Failed to handle admin callback', error, { userId, data });
    await ctx.answerCbQuery('Something went wrong. Please try again.', { show_alert: true });
  }
}
