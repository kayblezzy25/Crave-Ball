import admin from 'firebase-admin';
import { adminDocRef, adminsCollectionRef } from '../firebase/firestore';
import { logger } from '../utils/logger';

/**
 * Source of truth for admin authorization is ADMIN_TELEGRAM_IDS (a numeric
 * Telegram user ID allowlist read from environment configuration at
 * startup). This keeps the security-critical check fast and independent of
 * Firestore availability.
 *
 * The Firestore `admins` collection mirrors that allowlist for
 * record-keeping and future expansion (roles, per-admin audit trail,
 * additional admins added without a redeploy in a later iteration).
 */
let authorizedIds: Set<number> = new Set();

export function configureAuthorizedAdmins(ids: number[]): void {
  authorizedIds = new Set(ids);
}

export function isAuthorizedAdmin(telegramId: number): boolean {
  return authorizedIds.has(telegramId);
}

/**
 * Upserts every env-configured admin into Firestore so the `admins`
 * collection stays a complete, queryable record. Safe to run on every
 * startup.
 */
export async function syncAdminsToFirestore(
  ids: number[],
  usernamesById: Map<number, string | null> = new Map()
): Promise<void> {
  const db = adminsCollectionRef().firestore;
  const batch = db.batch();

  for (const telegramId of ids) {
    batch.set(
      adminDocRef(telegramId),
      {
        telegram_id: telegramId,
        username: usernamesById.get(telegramId) ?? null,
        role: 'admin',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  try {
    await batch.commit();
    logger.info('Synced admin allowlist to Firestore', { count: ids.length });
  } catch (error) {
    // Non-fatal: authorization already works from the in-memory allowlist.
    logger.error('Failed to sync admins to Firestore (authorization still works)', error);
  }
}
