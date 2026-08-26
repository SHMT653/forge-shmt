const AUTH_CLOCK_SKEW_PATTERNS = [
  /jwt\s+issued\s+at\s+future/i,
  /issued\s+at\s+future/i,
  /not\s+yet\s+valid/i,
  /clock\s+skew/i,
  /iat.*future/i,
];

export const AUTH_SESSION_SYNC_MESSAGE = 'Deine Sitzung war kurz nicht synchron. Bitte erneut versuchen.';

export function isAuthClockSkewMessage(message: string): boolean {
  return AUTH_CLOCK_SKEW_PATTERNS.some((pattern) => pattern.test(message));
}

export function isAuthClockSkewError(err: unknown): boolean {
  if (typeof err === 'string') return isAuthClockSkewMessage(err);
  if (err instanceof Error) return isAuthClockSkewMessage(err.message);

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    for (const key of ['message', 'error', 'error_description', 'details', 'hint', 'code']) {
      const value = record[key];
      if (typeof value === 'string' && isAuthClockSkewMessage(value)) return true;
    }
  }

  return false;
}
