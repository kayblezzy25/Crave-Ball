/**
 * Table structure definitions. See supabase/schema.sql for the DDL that
 * creates these tables in the Supabase project — run it once in the
 * Supabase SQL editor before starting the bot.
 *
 * bot_settings (single row, id='general')  -> startup content, buttons
 * admins (telegram_id primary key)          -> AdminRecord
 *
 * Kept intentionally flat and small so future tables (announcements,
 * broadcasts, group configs, stats, ...) can be added alongside these
 * without restructuring what already exists.
 */

export interface InlineButtonConfig {
  text: string;
  url: string;
}

export interface BotGeneralSettingsRow {
  id: string;
  startup_message: string;
  startup_image_path: string | null;
  startup_image_url: string | null;
  buttons: InlineButtonConfig[];
  updated_at: string | null;
  updated_by: number | null;
}

export interface AdminRow {
  telegram_id: number;
  username: string | null;
  role: 'super_admin' | 'admin';
  active: boolean;
  created_at: string;
}

export const BOT_SETTINGS_TABLE = 'bot_settings';
export const GENERAL_SETTINGS_ID = 'general';
export const ADMINS_TABLE = 'admins';
