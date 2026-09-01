import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/services/supabase/serverClient';

/**
 * Zutaten auf NEOs Einkaufsliste legen.
 *
 * Wer hier ein Rezept kocht, braucht die Zutaten — und die Einkaufsliste steht
 * in NEO. Diese Route nimmt die Liste entgegen und reicht sie mit dem geteilten
 * Geheimnis an NEO weiter.
 *
 * Wie `/api/design` authentifiziert sie sich am **Nutzer**: der Browser schickt
 * sein Supabase-Access-Token, daraus wird die E-Mail bestimmt. Das Geheimnis
 * bleibt server-seitig.
 */

const MAX_ITEMS = 40;

type IncomingItem = { name?: unknown; quantity?: unknown };

function neoBaseUrl() {
  const configured = process.env.NEO_API_URL ?? process.env.NEXT_PUBLIC_NEO_URL ?? 'https://neo-shmt.vercel.app';
  return configured.replace(/\/$/, '');
}

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

export async function POST(req: NextRequest) {
  const email = await callerEmail(req);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = process.env.NEO_FORGE_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Die Verbindung zu NEO ist nicht eingerichtet.' }, { status: 503 });
  }

  let body: { items?: IncomingItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 });
  }

  const items = (Array.isArray(body.items) ? body.items : [])
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      quantity: typeof item.quantity === 'string' && item.quantity.trim() ? item.quantity.trim() : undefined,
    }))
    .filter((item) => item.name.length > 0)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return NextResponse.json({ error: 'Keine Zutaten übergeben.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${neoBaseUrl()}/api/integrations/shopping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': secret },
      body: JSON.stringify({ email, items, source: 'forge_recipe' }),
      cache: 'no-store',
    });

    const result = (await res.json().catch(() => ({}))) as { error?: string; added?: number; skipped?: number };

    if (!res.ok) {
      return NextResponse.json(
        { error: result.error ?? 'NEO konnte die Zutaten nicht übernehmen.' },
        { status: res.status },
      );
    }

    return NextResponse.json({ ok: true, added: result.added ?? 0, skipped: result.skipped ?? 0 });
  } catch {
    return NextResponse.json({ error: 'NEO ist gerade nicht erreichbar.' }, { status: 502 });
  }
}
