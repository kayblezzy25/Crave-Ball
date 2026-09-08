import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvironmentConfig } from '../config/environment';
import { logger } from '../utils/logger';

let client: SupabaseClient | null = null;

/**
 * Initializes the Supabase client using the project URL and a
 * SERVICE ROLE key supplied entirely through environment variables (never
 * committed). The service role key bypasses Row Level Security, so — same
 * trust model as the Firebase Admin SDK it replaces — this client must
 * only ever run in this trusted server process, never be sent to Telegram
 * users, a frontend, or logs.
 */
export function initializeSupabase(env: EnvironmentConfig): SupabaseClient {
  if (client) return client;

  try {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    logger.info('Supabase client initialized', { url: env.supabaseUrl });
    return client;
  } catch (error) {
    logger.error('Failed to initialize Supabase client', error);
    throw new Error('Supabase initialization failed. Check SUPABASE_* environment variables.');
  }
}

export function getSupabase(): SupabaseClient {
  if (!client) throw new Error('Supabase has not been initialized yet');
  return client;
}
