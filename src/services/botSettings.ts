import admin from 'firebase-admin';
import { getDb } from '../firebase/config';
import {
  generalSettingsRef,
  BotGeneralSettings,
  InlineButtonConfig,
} from '../firebase/firestore';
import { logger } from '../utils/logger';

const DEFAULT_STARTUP_MESSAGE =
  'Welcome! The administrator has not configured a startup message yet.';

const MAX_MESSAGE_LENGTH = 1024; // Telegram caption limit
const MAX_BUTTONS = 10;

/**
 * Reads the active startup configuration used by /start. Returns sane
 * defaults if the document has never been created, so a brand-new
 * deployment doesn't crash on the very first /start.
 */
export async function getStartupConfig(): Promise<BotGeneralSettings> {
  try {
    const snap = await generalSettingsRef().get();
    if (!snap.exists) {
      return {
        startup_message: DEFAULT_STARTUP_MESSAGE,
        startup_image_path: null,
        startup_image_url: null,
        buttons: [],
        updated_at: null,
        updated_by: null,
      };
    }
    const data = snap.data() as Partial<BotGeneralSettings>;
    return {
      startup_message: data.startup_message ?? DEFAULT_STARTUP_MESSAGE,
      startup_image_path: data.startup_image_path ?? null,
      startup_image_url: data.startup_image_url ?? null,
      buttons: data.buttons ?? [],
      updated_at: data.updated_at ?? null,
      updated_by: data.updated_by ?? null,
    };
  } catch (error) {
    logger.error('Failed to read startup configuration from Firestore', error);
    throw new Error('Could not read the bot configuration from Firestore.');
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

  try {
    await generalSettingsRef().set(
      {
        startup_message: trimmed,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: updatedBy,
      },
      { merge: true }
    );
    logger.info('Startup message updated', { updatedBy });
  } catch (error) {
    logger.error('Failed to write startup message to Firestore', error);
    throw new Error('Could not save the startup message to Firestore.');
  }
}

export async function updateStartupImage(
  path: string,
  url: string,
  updatedBy: number
): Promise<void> {
  try {
    await generalSettingsRef().set(
      {
        startup_image_path: path,
        startup_image_url: url,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: updatedBy,
      },
      { merge: true }
    );
    logger.info('Startup image reference updated', { updatedBy, path });
  } catch (error) {
    logger.error('Failed to write startup image reference to Firestore', error);
    throw new Error('Could not save the image reference to Firestore.');
  }
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

  try {
    await generalSettingsRef().set(
      {
        buttons,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: updatedBy,
      },
      { merge: true }
    );
    logger.info('Startup button added', { updatedBy, text: button.text });
    return buttons;
  } catch (error) {
    logger.error('Failed to add button in Firestore', error);
    throw new Error('Could not save the new button to Firestore.');
  }
}

export async function clearButtons(updatedBy: number): Promise<void> {
  try {
    await generalSettingsRef().set(
      {
        buttons: [],
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: updatedBy,
      },
      { merge: true }
    );
    logger.info('Startup buttons cleared', { updatedBy });
  } catch (error) {
    logger.error('Failed to clear buttons in Firestore', error);
    throw new Error('Could not clear buttons in Firestore.');
  }
}

export function assertFirestoreConfigured(): void {
  // Cheap sanity check used at startup; throws if the SDK was never initialized.
  getDb();
}
