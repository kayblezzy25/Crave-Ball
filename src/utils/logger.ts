/**
 * Minimal structured logger. Never pass tokens, private keys, or other
 * secret values into these calls.
 */
type LogFields = Record<string, unknown>;

function format(level: string, message: string, fields?: LogFields): string {
  const base = `[${new Date().toISOString()}] ${level.padEnd(5)} ${message}`;
  if (!fields || Object.keys(fields).length === 0) return base;
  return `${base} ${JSON.stringify(fields)}`;
}

export const logger = {
  info(message: string, fields?: LogFields): void {
    console.log(format('INFO', message, fields));
  },
  warn(message: string, fields?: LogFields): void {
    console.warn(format('WARN', message, fields));
  },
  error(message: string, error?: unknown, fields?: LogFields): void {
    // Supabase/Postgrest errors are plain objects with a `.message` (and
    // often `.code`/`.details`), not `Error` instances, so duck-type
    // rather than requiring `instanceof Error`.
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : undefined;
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined;
    const errFields =
      errorMessage !== undefined
        ? { ...fields, error: errorMessage, ...(errorCode ? { code: errorCode } : {}) }
        : fields;
    console.error(format('ERROR', message, errFields));
  },
};
