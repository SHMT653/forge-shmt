import { type NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/services/ai/auth';
import { getAIProvider, isAIConfigured } from '@/services/ai/anthropic';
import { loadLibrary } from '@/services/ai/coachContext';
import { validateParseResult } from '@/domain/aiSchema';
import { AIUnavailableError } from '@/services/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/ai/parse
 *
 * Natural language in, validated structured entries out. This endpoint never
 * writes anything: it returns a proposal the user confirms in the UI, which is
 * what actually saves it (§53).
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  if (!isAIConfigured()) {
    return NextResponse.json({ error: 'AI ist auf diesem Server nicht konfiguriert.' }, { status: 503 });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'Kein Text übergeben.' }, { status: 400 });
  if (text.length > 800) return NextResponse.json({ error: 'Eingabe ist zu lang.' }, { status: 400 });

  try {
    const library = await loadLibrary(userId);
    const raw = await getAIProvider().parseEntry({
      text,
      library,
      localTime: new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
    });
    return NextResponse.json(validateParseResult(raw));
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[ai/parse] failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Die Eingabe konnte nicht verarbeitet werden.' }, { status: 500 });
  }
}
