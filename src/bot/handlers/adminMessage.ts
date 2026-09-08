import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { isAuthorizedAdmin } from '../../services/adminService';
import { updateStartupMessage, addButton } from '../../services/botSettings';
import { getAdminAction, clearAdminAction } from '../session';
import { adminPanelKeyboard } from '../keyboards/adminKeyboard';
import { logger } from '../../utils/logger';

const URL_PATTERN = /^https?:\/\/.+/i;

/**
 * Handles a plain-text message sent by an admin who is mid-flow
 * ("awaiting_message" or "awaiting_button"). Ignores everything else,
 * including commands, so it never swallows normal bot commands.
 */
export async function handleAdminTextInput(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAuthorizedAdmin(userId)) return;
  if (!ctx.has(message('text'))) return;

  const text = ctx.message.text;
  if (text.startsWith('/')) return; // let commands fall through to their own handlers

  const action = getAdminAction(userId);
  if (action === 'awaiting_message') {
    await handleMessageUpdate(ctx, userId, text);
  } else if (action === 'awaiting_button') {
    await handleButtonAdd(ctx, userId, text);
  }
}

async function handleMessageUpdate(ctx: Context, userId: number, text: string): Promise<void> {
  try {
    await updateStartupMessage(text, userId);
    clearAdminAction(userId);
    await ctx.reply('✅ Startup message updated. It is now live for all users.');
    await ctx.reply('🛠 ADMIN PANEL\n\nChoose an option:', adminPanelKeyboard());
    logger.info('Admin updated startup message', { userId });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Admin message update failed', error, { userId });
    await ctx.reply(`❌ Could not update the message: ${messageText}`);
  }
}

async function handleButtonAdd(ctx: Context, userId: number, text: string): Promise<void> {
  const parts = text.split('|').map((part) => part.trim());
  if (parts.length !== 2 || !parts[0] || !URL_PATTERN.test(parts[1])) {
    await ctx.reply(
      '❌ Invalid format. Send it as:\nLabel | https://example.com'
    );
    return;
  }

  const [buttonText, url] = parts;

  try {
    await addButton({ text: buttonText, url }, userId);
    clearAdminAction(userId);
    await ctx.reply(`✅ Button "${buttonText}" added. It is now live for all users.`);
    await ctx.reply('🛠 ADMIN PANEL\n\nChoose an option:', adminPanelKeyboard());
    logger.info('Admin added startup button', { userId, buttonText });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Admin button add failed', error, { userId });
    await ctx.reply(`❌ Could not add the button: ${messageText}`);
  }
}
