import { type NextRequest, NextResponse } from 'next/server';
import { runPlannerForUser, todayBerlin } from '@/services/plannerService';

/**
 * POST /api/planner/run
 * Manually trigger the planner for a single user.
 * Protected by CRON_SECRET — call from the Forge dashboard or CLI.
 *
 * Body: { userId: string, date?: string }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; date?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  if (!body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const date = body.date ?? todayBerlin();
  const result = await runPlannerForUser(body.userId, date);
  return NextResponse.json(result);
}
