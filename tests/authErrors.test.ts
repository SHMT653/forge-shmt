import { AUTH_SESSION_SYNC_MESSAGE, isAuthClockSkewError } from '@/domain/authErrors';
import { errorMessage } from '@/domain/errors';

describe('auth clock skew errors', () => {
  it('detects Supabase JWT issued-at clock skew errors', () => {
    expect(isAuthClockSkewError({ message: 'JWT issued at future' })).toBe(true);
    expect(isAuthClockSkewError(new Error('jwt is not yet valid'))).toBe(true);
  });

  it('does not show the raw Supabase auth message to the user', () => {
    expect(errorMessage({ message: 'JWT issued at future' }, 'Fallback')).toBe(AUTH_SESSION_SYNC_MESSAGE);
  });
});
