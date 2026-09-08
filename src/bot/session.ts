/**
 * Short-lived in-memory state for multi-step admin flows (e.g. "waiting for
 * the admin to send a new startup image"). Deliberately not persisted to
 * Supabase — it's conversational scaffolding, not bot configuration, and a
 * single long-running Railway process is enough to hold it. Entries expire
 * on their own so an abandoned flow doesn't linger forever.
 */
export type AdminAction = 'awaiting_image' | 'awaiting_message' | 'awaiting_button';

interface SessionEntry {
  action: AdminAction;
  expiresAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const sessions = new Map<number, SessionEntry>();

export function setAdminAction(telegramId: number, action: AdminAction): void {
  sessions.set(telegramId, { action, expiresAt: Date.now() + SESSION_TTL_MS });
}

export function getAdminAction(telegramId: number): AdminAction | null {
  const entry = sessions.get(telegramId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessions.delete(telegramId);
    return null;
  }
  return entry.action;
}

export function clearAdminAction(telegramId: number): void {
  sessions.delete(telegramId);
}
