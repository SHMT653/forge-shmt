import { getSupabaseClient } from '@/services/supabase/client';
import type { DayAggregate } from '@/domain/dayRating';

/**
 * Loads a date range as one aggregate per day.
 *
 * Four queries for a whole month, all against tables that already hold one row
 * per day (§51 — nothing is stored twice, and nothing is recomputed from
 * individual meal rows just to colour a square).
 *
 * Water costs the fourth query. It is loaded because the calendar square and
 * today's score have to be the same number, and today's score counts water —
 * feeding the two views different inputs is how they came to disagree.
 */
export async function loadDayAggregates(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, DayAggregate>> {
  const supabase = getSupabaseClient();

  const { data: waterHabit } = await supabase
    .from('forge_habits')
    .select('id')
    .eq('user_id', userId)
    .eq('key', 'water')
    .maybeSingle();

  const [nutrition, health, sessions, water] = await Promise.all([
    supabase
      .from('forge_nutrition_logs')
      .select('log_date, calories, protein_g')
      .eq('user_id', userId)
      .gte('log_date', fromDate)
      .lte('log_date', toDate),
    supabase
      .from('forge_daily_health')
      .select('log_date, steps, sleep_minutes')
      .eq('user_id', userId)
      .gte('log_date', fromDate)
      .lte('log_date', toDate),
    supabase
      .from('forge_workout_sessions')
      .select('completed_at, kind')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', `${fromDate}T00:00:00`)
      .lte('completed_at', `${toDate}T23:59:59`),
    waterHabit?.id
      ? supabase
          .from('forge_habit_logs')
          .select('log_date, value')
          .eq('user_id', userId)
          .eq('habit_id', waterHabit.id)
          .gte('log_date', fromDate)
          .lte('log_date', toDate)
      : Promise.resolve({ data: [] as { log_date: string; value: number }[] }),
  ]);

  const days = new Map<string, DayAggregate>();

  const ensure = (date: string): DayAggregate => {
    const existing = days.get(date);
    if (existing) return existing;
    const created: DayAggregate = {
      date,
      kcal: null,
      proteinG: null,
      steps: null,
      sleepH: null,
      waterMl: null,
      trained: false,
      miniSession: false,
    };
    days.set(date, created);
    return created;
  };

  for (const row of nutrition.data ?? []) {
    const day = ensure(row.log_date as string);
    const kcal = Number(row.calories);
    const protein = Number(row.protein_g);
    if (Number.isFinite(kcal) && kcal > 0) day.kcal = kcal;
    if (Number.isFinite(protein) && protein > 0) day.proteinG = protein;
  }

  for (const row of health.data ?? []) {
    const day = ensure(row.log_date as string);
    const steps = row.steps === null ? null : Number(row.steps);
    const minutes = row.sleep_minutes === null ? null : Number(row.sleep_minutes);
    if (steps !== null && Number.isFinite(steps) && steps > 0) day.steps = steps;
    if (minutes !== null && Number.isFinite(minutes) && minutes > 0) day.sleepH = minutes / 60;
  }

  for (const row of water.data ?? []) {
    const day = ensure(row.log_date as string);
    const ml = Number(row.value);
    if (Number.isFinite(ml) && ml > 0) day.waterMl = ml;
  }

  for (const row of sessions.data ?? []) {
    const date = (row.completed_at as string).slice(0, 10);
    const day = ensure(date);
    if (row.kind === 'mini') day.miniSession = true;
    else day.trained = true;
  }

  return days;
}

/**
 * Everything recorded on one specific day — used when a past day is opened to
 * be corrected. Loaded on demand, never as part of the month view.
 */
export async function loadDayDetail(userId: string, date: string) {
  const supabase = getSupabaseClient();

  const [meals, health, weight, sessions, checkin] = await Promise.all([
    supabase
      .from('forge_meal_entries')
      .select('id, name, kcal, protein_g, carbs_g, fat_g, logged_at, data_quality, meal_slot')
      .eq('user_id', userId)
      .eq('log_date', date)
      .order('logged_at'),
    supabase
      .from('forge_daily_health')
      .select('steps, sleep_minutes, steps_source, sleep_source')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle(),
    supabase
      .from('forge_body_metrics')
      .select('weight_kg, source')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle(),
    supabase
      .from('forge_workout_sessions')
      .select('id, day_name, plan_name, duration_seconds, kind')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', `${date}T00:00:00`)
      .lte('completed_at', `${date}T23:59:59`),
    supabase
      .from('forge_daily_checkins')
      .select('soreness, note')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle(),
  ]);

  return {
    meals: (meals.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      kcal: Number(row.kcal),
      proteinG: Number(row.protein_g),
      carbsG: Number(row.carbs_g),
      fatG: Number(row.fat_g),
      loggedAt: row.logged_at as string,
      dataQuality: row.data_quality as 'verified' | 'estimated' | 'unknown',
      slot: row.meal_slot as string | null,
    })),
    steps: health.data?.steps === null || health.data?.steps === undefined ? null : Number(health.data.steps),
    sleepMinutes:
      health.data?.sleep_minutes === null || health.data?.sleep_minutes === undefined
        ? null
        : Number(health.data.sleep_minutes),
    stepsSource: (health.data?.steps_source as string | undefined) ?? 'manual',
    sleepSource: (health.data?.sleep_source as string | undefined) ?? 'manual',
    weightKg: weight.data?.weight_kg === null || weight.data?.weight_kg === undefined ? null : Number(weight.data.weight_kg),
    sessions: (sessions.data ?? []).map((row) => ({
      id: row.id as string,
      dayName: row.day_name as string,
      planName: row.plan_name as string,
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      kind: (row.kind === 'mini' ? 'mini' : 'full') as 'mini' | 'full',
    })),
    soreness: (checkin.data?.soreness as string | null) ?? null,
    note: (checkin.data?.note as string | undefined) ?? '',
  };
}

export type DayDetail = Awaited<ReturnType<typeof loadDayDetail>>;
