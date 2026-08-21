import { type NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/services/ai/auth';
import { getAIProvider, isAIConfigured } from '@/services/ai/anthropic';
import { buildCoachContext } from '@/services/ai/coachContext';
import { AIUnavailableError } from '@/services/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

function parseHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryTurn[] = [];
  for (const item of value.slice(-8)) {
    if (!item || typeof item !== 'object') continue;
    const turn = item as { role?: unknown; content?: unknown };
    if ((turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.content !== 'string') continue;
    out.push({ role: turn.role, content: turn.content.slice(0, 2000) });
  }
  return out;
}

/**
 * POST /api/ai/coach
 *
 * The context is rebuilt here from the database for the authenticated user —
 * the client cannot influence which numbers the coach reasons over.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  if (!isAIConfigured()) {
    return NextResponse.json({ error: 'AI ist auf diesem Server nicht konfiguriert.' }, { status: 503 });
  }

  let body: { question?: unknown; history?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request.' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return NextResponse.json({ error: 'Keine Frage übergeben.' }, { status: 400 });
  if (question.length > 1000) return NextResponse.json({ error: 'Frage ist zu lang.' }, { status: 400 });

  // The day boundary is the client's local one (§52); validate the shape.
  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  try {
    const context = await buildCoachContext(userId, today);
    const answer = await getAIProvider().coach({ question, context, history: parseHistory(body.history) });
    return NextResponse.json({ answer });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[ai/coach] failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Der Coach ist gerade nicht erreichbar.' }, { status: 500 });
  }
}
