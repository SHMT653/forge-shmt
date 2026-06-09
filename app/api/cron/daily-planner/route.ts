import { type NextRequest, NextResponse } from 'next/server';
import { listUsersWithActivePlans } from '@/data/plannedSessions';
import { runPlannerForUser, todayBerlin } from '@/services/plannerService';

/**
 * Vercel Cron endpoint — called daily at 00:00 Europe/Berlin.
 * Protected by CRON_SECRET (set in Vercel project settings).
 *
 * Config: vercel.json → crons[].path = "/api/cron/daily-planner"
 */
export async function GET(req: NextRequest) {
  // Security: Vercel passes Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = todayBerlin();
  console.log(`[cron] daily-planner started for date=${date}`);

  try {
    const userIds = await listUsersWithActivePlans();
    console.log(`[cron] found ${userIds.length} users with active plans`);

    const results = await Promise.allSettled(
      userIds.map((userId) => runPlannerForUser(userId, date)),
    );

    const summary = results.map((r, i) => ({
      userId: userIds[i],
      outcome: r.status === 'fulfilled' ? r.value.status.status : 'promise_rejected',
      error:   r.status === 'rejected'  ? String(r.reason) : undefined,
    }));

    const successful = summary.filter((s) => s.outcome === 'scheduled' || s.outcome === 'updated').length;
    const noSlot     = summary.filter((s) => s.outcome === 'no_slot').length;
    const errors     = summary.filter((s) => s.outcome === 'error' || s.outcome === 'promise_rejected').length;

    console.log(`[cron] done — scheduled:${successful} no_slot:${noSlot} errors:${errors}`);

    return NextResponse.json({ date, processed: userIds.length, successful, noSlot, errors, summary });
  } catch (err) {
    console.error('[cron] fatal error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
