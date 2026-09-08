import { Context, Markup, Telegram } from 'telegraf';
import { getStartupConfig } from '../../services/botSettings';
import { logger } from '../../utils/logger';

function buildButtonsKeyboard(buttons: { text: string; url: string }[]) {
  if (buttons.length === 0) return undefined;
  return Markup.inlineKeyboard(
    buttons.map((button) => [Markup.button.url(button.text, button.url)])
  );
}

/**
 * Sends the current startup content (image + message + buttons) to a chat.
 * Shared by /start (for regular users) and the admin Preview action, so
 * both see exactly the same thing.
 */
export async function sendStartupContent(telegram: Telegram, chatId: number): Promise<void> {
  const config = await getStartupConfig();
  const keyboard = buildButtonsKeyboard(config.buttons);

  if (config.startup_image_url) {
    await telegram.sendPhoto(chatId, config.startup_image_url, {
      caption: config.startup_message,
      ...keyboard,
    });
  } else {
    await telegram.sendMessage(chatId, config.startup_message, keyboard);
  }
}

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  try {
    await sendStartupContent(ctx.telegram, chatId);
    logger.info('/start served', { chatId, userId: ctx.from?.id });
  } catch (error) {
    logger.error('Failed to serve /start', error, { chatId });
    await ctx.reply(
      'Sorry, something went wrong loading the welcome content. Please try again in a moment.'
    );
  }
}
