import { getSupabase } from '../supabase/config';
import {
  BOT_SETTINGS_TABLE,
  BotGeneralSettingsRow,
  InlineButtonConfig,
} from '../supabase/database';
import { loadEnvironment } from '../config/environment';
import { logger } from '../utils/logger';

const DEFAULT_STARTUP_MESSAGE =
  'Welcome! The administrator has not configured a startup message yet.';

const MAX_MESSAGE_LENGTH = 1024; // Telegram caption limit
const MAX_BUTTONS = 10;

export interface StartupConfig {
  startup_message: string;
  startup_image_path: string | null;
  startup_image_url: string | null;
  buttons: InlineButtonConfig[];
  updated_at: string | null;
  updated_by: number | null;
}

/**
 * Reads the active startup configuration used by /start. Returns sane
 * defaults if the row has never been created (e.g. schema.sql hasn't been
 * run yet), so a brand-new deployment doesn't crash on the very first
 * /start.
 */
export async function getStartupConfig(): Promise<StartupConfig> {
  const { data, error } = await getSupabase()
    .from(BOT_SETTINGS_TABLE)
    .select('*')
    .eq('id', loadEnvironment().botInstanceId)
    .maybeSingle<BotGeneralSettingsRow>();

  if (error) {
    logger.error('Failed to read startup configuration from Supabase', error);
    throw new Error('Could not read the bot configuration from Supabase.');
  }

  if (!data) {
    return {
      startup_message: DEFAULT_STARTUP_MESSAGE,
      startup_image_path: null,
      startup_image_url: null,
      buttons: [],
      updated_at: null,
      updated_by: null,
    };
  }

  return {
    startup_message: data.startup_message ?? DEFAULT_STARTUP_MESSAGE,
    startup_image_path: data.startup_image_path,
    startup_image_url: data.startup_image_url,
    buttons: data.buttons ?? [],
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}

async function upsertGeneralSettings(
  fields: Partial<
    Pick<
      BotGeneralSettingsRow,
      'startup_message' | 'startup_image_path' | 'startup_image_url' | 'buttons'
    >
  >,
  updatedBy: number
): Promise<void> {
  const { error } = await getSupabase()
    .from(BOT_SETTINGS_TABLE)
    .upsert(
      {
        id: loadEnvironment().botInstanceId,
        ...fields,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: 'id' }
    );

  if (error) {
    logger.error('Failed to write bot settings to Supabase', error);
    throw new Error('Could not save the change to Supabase.');
  }
}

export async function updateStartupMessage(
  message: string,
  updatedBy: number
): Promise<void> {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new Error('The startup message cannot be empty.');
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `The startup message is too long (${trimmed.length}/${MAX_MESSAGE_LENGTH} characters).`
    );
  }

  await upsertGeneralSettings({ startup_message: trimmed }, updatedBy);
  logger.info('Startup message updated', { updatedBy });
}

export async function updateStartupImage(
  path: string,
  url: string,
  updatedBy: number
): Promise<void> {
  await upsertGeneralSettings({ startup_image_path: path, startup_image_url: url }, updatedBy);
  logger.info('Startup image reference updated', { updatedBy, path });
}

export async function addButton(
  button: InlineButtonConfig,
  updatedBy: number
): Promise<InlineButtonConfig[]> {
  const config = await getStartupConfig();
  if (config.buttons.length >= MAX_BUTTONS) {
    throw new Error(`You can configure at most ${MAX_BUTTONS} buttons.`);
  }
  const buttons = [...config.buttons, button];

  await upsertGeneralSettings({ buttons }, updatedBy);
  logger.info('Startup button added', { updatedBy, text: button.text });
  return buttons;
}

export async function clearButtons(updatedBy: number): Promise<void> {
  await upsertGeneralSettings({ buttons: [] }, updatedBy);
  logger.info('Startup buttons cleared', { updatedBy });
}
