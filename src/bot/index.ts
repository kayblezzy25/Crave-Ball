import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleAdmin } from './commands/admin';
import { handleAdminCallback } from './handlers/callbacks';
import { handleAdminPhotoUpload } from './handlers/adminImage';
import { handleAdminTextInput } from './handlers/adminMessage';
import { logger } from '../utils/logger';

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.command('start', handleStart);
  bot.command('admin', handleAdmin);

  bot.on('callback_query', handleAdminCallback);
  bot.on('photo', handleAdminPhotoUpload);
  bot.on('text', handleAdminTextInput);

  bot.catch((error, ctx) => {
    logger.error('Unhandled bot error', error, {
      updateType: ctx.updateType,
      chatId: ctx.chat?.id,
    });
  });

  return bot;
}
