import { isAuthClockSkewError } from '@/domain/authErrors';
import { getSupabaseClient } from './client';

const AUTH_RECOVERY_RETRY_DELAY_MS = 1200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function recoverAuthSession(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return false;

    const refreshed = await supabase.auth.refreshSession();
    return !refreshed.error && Boolean(refreshed.data.session);
  } catch {
    return false;
  }
}

export async function withRecoveredAuthSession<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!isAuthClockSkewError(err)) throw err;

    const recovered = await recoverAuthSession();
    if (!recovered) throw err;

    await wait(AUTH_RECOVERY_RETRY_DELAY_MS);
    return work();
  }
}
