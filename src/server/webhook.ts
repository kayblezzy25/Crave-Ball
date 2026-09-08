import http from 'node:http';
import { Telegraf } from 'telegraf';
import { logger } from '../utils/logger';

const WEBHOOK_PATH = '/telegram/webhook';
const HEALTH_PATH = '/health';

/**
 * Minimal HTTP server (no extra web framework) exposing:
 *   POST /telegram/webhook  -> Telegram update delivery
 *   GET  /health            -> liveness probe, no sensitive data
 * Anything else gets a 404. Never returns tokens, keys, or admin IDs.
 */
export function startWebhookServer(
  bot: Telegraf,
  port: number,
  webhookSecret: string | null
): http.Server {
  const telegramCallback = bot.webhookCallback(WEBHOOK_PATH, {
    secretToken: webhookSecret ?? undefined,
  });

  const server = http.createServer((req, res) => {
    const url = req.url ?? '';

    if (req.method === 'GET' && url === HEALTH_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && url.startsWith(WEBHOOK_PATH)) {
      telegramCallback(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    logger.info('HTTP server listening', { port, webhookPath: WEBHOOK_PATH });
  });

  return server;
}

export { WEBHOOK_PATH };
