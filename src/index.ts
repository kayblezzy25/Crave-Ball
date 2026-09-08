import 'dotenv/config';
import { loadEnvironment } from './config/environment';
import { initializeFirebase } from './firebase/config';
import { configureAuthorizedAdmins, syncAdminsToFirestore } from './services/adminService';
import { createBot } from './bot';
import { startWebhookServer, WEBHOOK_PATH } from './server/webhook';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info('Starting application...');

  const env = loadEnvironment();

  initializeFirebase(env);
  configureAuthorizedAdmins(env.adminTelegramIds);
  await syncAdminsToFirestore(env.adminTelegramIds);

  const bot = createBot(env.telegramBotToken);

  if (env.webhookUrl) {
    // Production path: Telegram pushes updates to our HTTPS endpoint.
    const fullWebhookUrl = `${env.webhookUrl}${WEBHOOK_PATH}`;
    await bot.telegram.setWebhook(fullWebhookUrl, {
      secret_token: env.webhookSecret ?? undefined,
    });
    logger.info('Telegram webhook registered', { webhookUrl: fullWebhookUrl });

    startWebhookServer(bot, env.port, env.webhookSecret);
  } else {
    // Local development fallback: no public URL available, use long polling.
    await bot.telegram.deleteWebhook().catch(() => undefined);
    await bot.launch();
    logger.info('Bot started with long polling (WEBHOOK_URL not set)');
  }

  logger.info('Application startup complete');

  process.once('SIGINT', () => {
    logger.info('Received SIGINT, shutting down');
    bot.stop('SIGINT');
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down');
    bot.stop('SIGTERM');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal startup error', error);
  process.exit(1);
});
