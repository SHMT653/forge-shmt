/**
 * Supabase throws plain PostgrestError/StorageError objects (not `instanceof Error`),
 * so a naive `instanceof Error` check swallows their `.message` and shows only the
 * generic fallback — hiding the actual cause (e.g. "schema must be one of …").
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}
