/**
 * Loads and validates all environment configuration in one place, fails
 * fast on startup if anything required is missing, and never logs secret
 * values.
 */
export interface EnvironmentConfig {
  telegramBotToken: string;
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  firebaseStorageBucket: string;
  adminTelegramIds: number[];
  webhookUrl: string | null;
  webhookSecret: string | null;
  port: number;
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

function normalizePrivateKey(raw: string): string {
  // Railway (and most host env-var stores) cannot hold real newlines, so the
  // key is supplied with literal "\n" sequences that must be converted back.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

let cached: EnvironmentConfig | null = null;

export function loadEnvironment(): EnvironmentConfig {
  if (cached) return cached;

  const config: EnvironmentConfig = {
    telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
    firebaseProjectId: required('FIREBASE_PROJECT_ID'),
    firebaseClientEmail: required('FIREBASE_CLIENT_EMAIL'),
    firebasePrivateKey: normalizePrivateKey(required('FIREBASE_PRIVATE_KEY')),
    firebaseStorageBucket: required('FIREBASE_STORAGE_BUCKET'),
    adminTelegramIds: parseAdminIds(required('ADMIN_TELEGRAM_IDS')),
    webhookUrl: process.env.WEBHOOK_URL?.trim()
      ? process.env.WEBHOOK_URL.trim().replace(/\/+$/, '')
      : null,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    port: Number(process.env.PORT) || 3000,
  };

  cached = config;
  return config;
}
