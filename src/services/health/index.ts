import { AppleHealthProvider } from './appleHealth';
import { ManualHealthProvider, type HealthProvider } from './provider';

export * from './provider';
export { AppleHealthProvider } from './appleHealth';

let cached: HealthProvider | null = null;

/**
 * Picks the provider that fits the current runtime.
 *
 * Called from the client only. In a browser this always resolves to the manual
 * provider, so no screen ever needs a platform check of its own (§5).
 */
export async function resolveHealthProvider(): Promise<HealthProvider> {
  if (cached) return cached;
  const apple = new AppleHealthProvider();
  cached = (await apple.isAvailable()) ? apple : new ManualHealthProvider();
  return cached;
}

/** Test seam — lets a test install a fake provider. */
export function __setHealthProvider(provider: HealthProvider | null): void {
  cached = provider;
}
