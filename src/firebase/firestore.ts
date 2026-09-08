import { getDb } from './config';

/**
 * Low-level Firestore structure definitions and collection references.
 * Higher-level read/write logic lives in src/services/*.
 *
 * bot_settings/general        -> BotGeneralSettings (startup content, buttons)
 * admins/{telegram_id}        -> AdminRecord
 *
 * Kept intentionally flat and small so future collections (announcements,
 * broadcasts, group configs, stats, ...) can be added alongside these
 * without restructuring what already exists.
 */

export interface InlineButtonConfig {
  text: string;
  url: string;
}

export interface BotGeneralSettings {
  startup_message: string;
  startup_image_path: string | null;
  startup_image_url: string | null;
  buttons: InlineButtonConfig[];
  updated_at: FirebaseFirestore.Timestamp | null;
  updated_by: number | null;
}

export interface AdminRecord {
  telegram_id: number;
  username: string | null;
  role: 'super_admin' | 'admin';
  active: boolean;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export const BOT_SETTINGS_COLLECTION = 'bot_settings';
export const GENERAL_SETTINGS_DOC = 'general';
export const ADMINS_COLLECTION = 'admins';

export function generalSettingsRef(): FirebaseFirestore.DocumentReference {
  return getDb().collection(BOT_SETTINGS_COLLECTION).doc(GENERAL_SETTINGS_DOC);
}

export function adminDocRef(telegramId: number): FirebaseFirestore.DocumentReference {
  return getDb().collection(ADMINS_COLLECTION).doc(String(telegramId));
}

export function adminsCollectionRef(): FirebaseFirestore.CollectionReference {
  return getDb().collection(ADMINS_COLLECTION);
}
