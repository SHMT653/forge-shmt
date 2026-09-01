import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/services/supabase/serverClient';

/**
 * Design-Abgleich mit NEO.
 *
 * NEO haelt Hell/Dunkel und die Akzentfarbe in `user_settings.theme`; VAULT
 * liegt auf derselben Datenbank, FORGE nicht. Diese Route reicht den Wert
 * durch, damit alle drei Apps gleich aussehen.
 *
 * Der Browser schickt sein Supabase-Access-Token mit; damit wird die E-Mail
 * bestimmt. Das geteilte Geheimnis fuer NEO bleibt server-seitig.
 */

function neoBaseUrl() {
  const configured = process.env.NEO_API_URL ?? process.env.NEXT_PUBLIC_NEO_URL ?? 'https://neo-shmt.vercel.app';
  return configured.replace(/\/$/, '');
}

/** E-Mail des anfragenden Nutzers aus dem Bearer-Token, sonst null. */
async function callerEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function config(): { secret: string } | null {
  const secret = process.env.NEO_FORGE_API_SECRET;
  return secret ? { secret } : null;
}

export async function GET(req: NextRequest) {
  const email = await callerEmail(req);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cfg = config();
  if (!cfg) return NextResponse.json({ theme: null, reason: 'not-configured' });

  try {
    const res = await fetch(`${neoBaseUrl()}/api/integrations/design?email=${encodeURIComponent(email)}`, {
      headers: { 'x-api-secret': cfg.secret },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ theme: null, reason: `neo-${res.status}` });

    const body = (await res.json()) as { theme?: string | null };
    return NextResponse.json({ theme: body.theme ?? null });
  } catch {
    return NextResponse.json({ theme: null, reason: 'neo-unreachable' });
  }
}

export async function PUT(req: NextRequest) {
  const email = await callerEmail(req);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, reason: 'not-configured' });

  let body: { theme?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 });
  }

  try {
    const res = await fetch(`${neoBaseUrl()}/api/integrations/design`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': cfg.secret },
      body: JSON.stringify({ email, theme: body.theme }),
      cache: 'no-store',
    });
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false, reason: 'neo-unreachable' });
  }
}
