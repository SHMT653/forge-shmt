import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/**
 * Verifies the caller's Supabase access token and returns their user id.
 *
 * The AI routes run with the service-role key, which bypasses row-level
 * security — so every query they make must be scoped to the id returned here,
 * never to an id supplied in the request body.
 */
export async function requireUserId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
