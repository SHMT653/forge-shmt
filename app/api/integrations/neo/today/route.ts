import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/services/supabase/serverClient';

/**
 * Tagesstand für NEOs Dashboard.
 *
 * NEO und FORGE liegen in getrennten Supabase-Projekten, deshalb kann NEO
 * die Zahlen nicht selbst abfragen. Diese Route liefert genau das, was in die
 * Kachel „SHMT heute" passt: Kalorien, Eiweiß, Training und Schlaf.
 *
 * Geschützt durch dasselbe geteilte Geheimnis wie die Schlaf-Brücke.
 */

const TZ = 'Europe/Berlin';

export type ForgeTodaySummary = {
  date: string;
  calories: number | null;
  calorieGoal: number | null;
  protein: number | null;
  proteinGoal: number | null;
  /** true, sobald heute ein Training abgeschlossen wurde. */
  trained: boolean;
  /** Geplantes Training heute, falls der Planer eins gelegt hat. */
  plannedSession: { name: string; start: string | null } | null;
  sleepMinutes: number | null;
};

function isAuthorized(req: NextRequest) {
  const secret = process.env.NEO_FORGE_API_SECRET;
  if (!secret) return false;
  return (
    req.headers.get('x-api-secret') === secret ||
    req.headers.get('authorization') === `Bearer ${secret}`
  );
}

function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'email fehlt' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: 'Forge ist nicht konfiguriert.' }, { status: 503 });
  }

  // Nutzer über die E-Mail finden — dieselbe Person wie in NEO.
  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const forgeUser = userList.users.find((u) => u.email?.toLowerCase() === email);
  if (!forgeUser) {
    return NextResponse.json({ error: 'Forge-Benutzer nicht gefunden' }, { status: 404 });
  }

  const date = todayBerlin();

  const [nutrition, goals, health, sessions, planned] = await Promise.all([
    supabase
      .from('forge_nutrition_logs')
      .select('calories, protein_g')
      .eq('user_id', forgeUser.id)
      .eq('log_date', date)
      .maybeSingle(),
    supabase
      .from('forge_user_goals')
      .select('calorie_goal, protein_goal')
      .eq('user_id', forgeUser.id)
      .maybeSingle(),
    supabase
      .from('forge_daily_health')
      .select('sleep_minutes')
      .eq('user_id', forgeUser.id)
      .eq('log_date', date)
      .maybeSingle(),
    supabase
      .from('forge_workout_sessions')
      .select('completed_at')
      .eq('user_id', forgeUser.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', `${date}T00:00:00`)
      .lte('completed_at', `${date}T23:59:59`)
      .limit(1),
    supabase
      .from('forge_planned_sessions')
      .select('plan_day_name, planned_start, status')
      .eq('user_id', forgeUser.id)
      .eq('plan_date', date)
      .maybeSingle(),
  ]);

  const plannedRow = planned.data as { plan_day_name?: string; planned_start?: string | null; status?: string } | null;

  const summary: ForgeTodaySummary = {
    date,
    calories: num((nutrition.data as { calories?: unknown } | null)?.calories),
    calorieGoal: num((goals.data as { calorie_goal?: unknown } | null)?.calorie_goal),
    protein: num((nutrition.data as { protein_g?: unknown } | null)?.protein_g),
    proteinGoal: num((goals.data as { protein_goal?: unknown } | null)?.protein_goal),
    trained: (sessions.data ?? []).length > 0,
    plannedSession:
      plannedRow && plannedRow.status === 'scheduled'
        ? { name: plannedRow.plan_day_name ?? 'Training', start: plannedRow.planned_start ?? null }
        : null,
    sleepMinutes: num((health.data as { sleep_minutes?: unknown } | null)?.sleep_minutes),
  };

  return NextResponse.json(summary);
}
