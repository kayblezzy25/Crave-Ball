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
    const errFields =
      error instanceof Error
        ? { ...fields, error: error.message }
        : fields;
    console.error(format('ERROR', message, errFields));
  },
};
