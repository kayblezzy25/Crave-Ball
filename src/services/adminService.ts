import { getSupabase } from '../supabase/config';
import { ADMINS_TABLE } from '../supabase/database';
import { logger } from '../utils/logger';

/**
 * Source of truth for admin authorization is ADMIN_TELEGRAM_IDS (a numeric
 * Telegram user ID allowlist read from environment configuration at
 * startup). This keeps the security-critical check fast and independent of
 * Supabase availability.
 *
 * The `admins` table mirrors that allowlist for record-keeping and future
 * expansion (roles, per-admin audit trail, additional admins added without
 * a redeploy in a later iteration).
 */
let authorizedIds: Set<number> = new Set();

export function configureAuthorizedAdmins(ids: number[]): void {
  authorizedIds = new Set(ids);
}

export function isAuthorizedAdmin(telegramId: number): boolean {
  return authorizedIds.has(telegramId);
}

/**
 * Upserts every env-configured admin into Supabase so the `admins` table
 * stays a complete, queryable record. Safe to run on every startup.
 */
export async function syncAdminsToSupabase(ids: number[]): Promise<void> {
  const rows = ids.map((telegramId) => ({
    telegram_id: telegramId,
    role: 'admin' as const,
    active: true,
  }));

  const { error } = await getSupabase()
    .from(ADMINS_TABLE)
    .upsert(rows, { onConflict: 'telegram_id', ignoreDuplicates: false });

  if (error) {
    // Non-fatal: authorization already works from the in-memory allowlist.
    logger.error('Failed to sync admins to Supabase (authorization still works)', error);
    return;
  }

  logger.info('Synced admin allowlist to Supabase', { count: ids.length });
}
