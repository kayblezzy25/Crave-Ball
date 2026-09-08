/**
 * Loads and validates all environment configuration in one place, fails
 * fast on startup if anything required is missing, and never logs secret
 * values.
 */
export interface EnvironmentConfig {
  telegramBotToken: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  adminTelegramIds: number[];
  webhookUrl: string | null;
  webhookSecret: string | null;
  port: number;
  /**
   * Namespaces the bot_settings row and Storage object path so multiple
   * bot deployments can safely share one Supabase project/bucket. Defaults
   * to 'general', which keeps the original unprefixed row id and storage
   * path — existing single-bot deployments are unaffected unless this is
   * explicitly set.
   */
  botInstanceId: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAdminIds(raw: string): number[] {
  const ids = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const id = Number(part);
      if (!Number.isInteger(id)) {
        throw new Error(
          `Invalid entry in ADMIN_TELEGRAM_IDS: "${part}" is not a numeric Telegram user ID`
        );
      }
      return id;
    });

  if (ids.length === 0) {
    throw new Error(
      'ADMIN_TELEGRAM_IDS must contain at least one numeric Telegram user ID'
    );
  }

  return ids;
}

let cached: EnvironmentConfig | null = null;

export function loadEnvironment(): EnvironmentConfig {
  if (cached) return cached;

  const config: EnvironmentConfig = {
    telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseStorageBucket: required('SUPABASE_STORAGE_BUCKET'),
    adminTelegramIds: parseAdminIds(required('ADMIN_TELEGRAM_IDS')),
    webhookUrl: process.env.WEBHOOK_URL?.trim()
      ? process.env.WEBHOOK_URL.trim().replace(/\/+$/, '')
      : null,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    port: Number(process.env.PORT) || 3000,
    botInstanceId: process.env.BOT_INSTANCE_ID?.trim() || 'general',
  };

  cached = config;
  return config;
}
