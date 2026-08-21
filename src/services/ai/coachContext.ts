import { getSupabaseServerClient } from '@/services/supabase/serverClient';
import { resolveTargets } from '@/domain/goalPhase';
import { summarizeWeight } from '@/domain/weightTrend';
import { formatHours, formatLiters } from '@/domain/coach';
import { weekBoundsFor } from '@/domain/weeklyReview';
import { dateKeyAddDays } from '@/domain/dates';
import { GOALS_DEFAULTS } from '@/data/profile';
import { equipmentLabel, focusLabel, isEquipmentId, isTrainingFocusId } from '@/domain/equipment';
import { formatSleep } from '@/domain/health';
import type { LibraryEntry } from './provider';
import type { BodyMetric, UserGoals } from '@/domain/types';

/**
 * Builds the coach's view of the user, server-side, from the database.
 *
 * Deliberately rebuilt here rather than accepted from the client: the model's
 * answers are only trustworthy if the numbers behind them are. It also keeps
 * the payload minimal — only what a coaching answer actually needs (§71).
 */

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function loadGoals(userId: string): Promise<UserGoals> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('forge_user_goals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<Record<string, unknown>>();
  if (!data) return GOALS_DEFAULTS;

  return {
    ...GOALS_DEFAULTS,
    calorieGoal: num(data.calorie_goal, GOALS_DEFAULTS.calorieGoal),
    proteinGoal: num(data.protein_goal, GOALS_DEFAULTS.proteinGoal),
    currentWeight: data.current_weight === null ? null : num(data.current_weight),
    heightCm: data.height_cm === null ? null : num(data.height_cm),
    birthYear: data.birth_year === null ? null : num(data.birth_year),
    gender: (data.gender ?? 'other') as UserGoals['gender'],
    activityLevel: (data.activity_level ?? 'moderate') as UserGoals['activityLevel'],
    goalType: (data.goal_type ?? 'maintain') as UserGoals['goalType'],
    phaseType: (data.phase_type ?? null) as UserGoals['phaseType'],
    caloriesMin: data.calories_min === null || data.calories_min === undefined ? null : num(data.calories_min),
    caloriesMax: data.calories_max === null || data.calories_max === undefined ? null : num(data.calories_max),
    proteinMin: data.protein_min === null || data.protein_min === undefined ? null : num(data.protein_min),
    proteinMax: data.protein_max === null || data.protein_max === undefined ? null : num(data.protein_max),
    stepsGoal: data.steps_goal === null || data.steps_goal === undefined ? null : num(data.steps_goal),
    waterGoalMl: data.water_goal_ml === null || data.water_goal_ml === undefined ? null : num(data.water_goal_ml),
    sleepGoalH: data.sleep_goal_h === null || data.sleep_goal_h === undefined ? null : num(data.sleep_goal_h),
    weeklyTrainingGoal: data.weekly_training_goal === null || data.weekly_training_goal === undefined ? null : num(data.weekly_training_goal),
    equipment: Array.isArray(data.equipment) ? data.equipment.filter((x): x is string => typeof x === 'string').filter(isEquipmentId) : [],
    trainingFocus: Array.isArray(data.training_focus) ? data.training_focus.filter((x): x is string => typeof x === 'string').filter(isTrainingFocusId) : [],
  };
}

/** The user's own foods and recipes, for reference-first parsing (§35/§54). */
export async function loadLibrary(userId: string): Promise<LibraryEntry[]> {
  const supabase = getSupabaseServerClient();

  const [{ data: foods }, { data: recipes }] = await Promise.all([
    supabase
      .from('forge_food_items')
      .select('id, name, brand, serving_label')
      .eq('user_id', userId)
      .order('use_count', { ascending: false })
      .limit(120),
    supabase
      .from('forge_recipes')
      .select('id, name, serving_label')
      .eq('user_id', userId)
      .limit(60),
  ]);

  const entries: LibraryEntry[] = [];
  for (const row of foods ?? []) {
    entries.push({
      id: row.id,
      kind: 'food',
      name: row.name,
      ...(row.brand ? { brand: row.brand as string } : {}),
      servingLabel: row.serving_label ?? '1 Portion',
    });
  }
  for (const row of recipes ?? []) {
    entries.push({ id: row.id, kind: 'recipe', name: row.name, servingLabel: row.serving_label ?? 'Portion' });
  }
  return entries;
}

export async function buildCoachContext(userId: string, today: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const week = weekBoundsFor(today);
  const since = dateKeyAddDays(today, -30);

  const [goals, nutritionRes, entriesRes, habitsRes, logsRes, metricsRes, sessionsRes, checkinRes, recipesRes, phaseRes, healthRes] =
    await Promise.all([
      loadGoals(userId),
      supabase.from('forge_nutrition_logs').select('log_date, calories, protein_g').eq('user_id', userId).gte('log_date', since).order('log_date'),
      supabase.from('forge_meal_entries').select('name, kcal, protein_g, logged_at, data_quality').eq('user_id', userId).eq('log_date', today).order('logged_at'),
      supabase.from('forge_habits').select('id, key, target').eq('user_id', userId),
      supabase.from('forge_habit_logs').select('habit_id, log_date, value').eq('user_id', userId).gte('log_date', dateKeyAddDays(today, -7)),
      supabase.from('forge_body_metrics').select('id, log_date, weight_kg, body_fat_pct, muscle_mass_kg').eq('user_id', userId).order('log_date', { ascending: false }).limit(90),
      supabase.from('forge_workout_sessions').select('day_name, completed_at, duration_seconds, kind').eq('user_id', userId).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(20),
      supabase.from('forge_daily_checkins').select('soreness, soreness_area, energy').eq('user_id', userId).eq('log_date', today).maybeSingle(),
      supabase.from('forge_recipes').select('name, is_meal_prep').eq('user_id', userId).limit(30),
      supabase.from('forge_goal_phases').select('phase_type, label, start_date, calories_min, calories_max, protein_min, protein_max, steps_goal, weekly_training_goal').eq('user_id', userId).is('end_date', null).maybeSingle(),
      supabase.from('forge_daily_health').select('log_date, steps, sleep_minutes, active_energy_kcal, steps_source, sleep_source').eq('user_id', userId).gte('log_date', dateKeyAddDays(today, -7)),
    ]);

  const phase = phaseRes.data;
  const effectiveGoals: UserGoals = phase
    ? {
        ...goals,
        phaseType: (phase.phase_type ?? goals.phaseType) as UserGoals['phaseType'],
        caloriesMin: num(phase.calories_min) ?? goals.caloriesMin,
        caloriesMax: num(phase.calories_max) ?? goals.caloriesMax,
        proteinMin: num(phase.protein_min) ?? goals.proteinMin,
        proteinMax: num(phase.protein_max) ?? goals.proteinMax,
        stepsGoal: num(phase.steps_goal) ?? goals.stepsGoal,
        weeklyTrainingGoal: num(phase.weekly_training_goal) ?? goals.weeklyTrainingGoal,
      }
    : goals;

  const targets = resolveTargets(effectiveGoals);
  const lines: string[] = [];

  // ── Goals ─────────────────────────────────────────────────────────
  // The coach must never carry a hard-coded idea of what the user wants (§39).
  lines.push(`Phase: ${phase?.label?.trim() || targets.phase.label} (${targets.phase.short})`);
  if (phase?.start_date) lines.push(`Phase läuft seit: ${phase.start_date}`);
  lines.push(`Zielbereich Kalorien: ${targets.calories.min}–${targets.calories.max} kcal`);
  lines.push(`Zielbereich Protein: ${targets.protein.min}–${targets.protein.max} g`);
  lines.push(`Ziele: ${targets.steps} Schritte, ${formatLiters(targets.waterMl)} Wasser, ${formatHours(targets.sleepH)} Schlaf`);
  lines.push(`Trainingsziel: ${targets.weeklyTrainingGoal} Einheiten pro Woche`);
  if (effectiveGoals.equipment.length > 0) {
    lines.push(`Verfügbares Equipment: ${effectiveGoals.equipment.map(equipmentLabel).join(', ')}`);
  }
  if (effectiveGoals.trainingFocus.length > 0) {
    lines.push(`Trainingsfokus: ${effectiveGoals.trainingFocus.map(focusLabel).join(', ')}`);
  }

  // ── Today ─────────────────────────────────────────────────────────
  const todayLog = (nutritionRes.data ?? []).find((r) => r.log_date === today);
  lines.push('');
  lines.push(`HEUTE (${today})`);
  lines.push(`Gegessen: ${num(todayLog?.calories)} kcal, ${num(todayLog?.protein_g)} g Protein`);

  const entries = entriesRes.data ?? [];
  if (entries.length > 0) {
    lines.push('Mahlzeiten heute:');
    for (const e of entries) {
      const time = typeof e.logged_at === 'string' ? e.logged_at.slice(11, 16) : '';
      const flag = e.data_quality !== 'verified' ? ' [geschätzt]' : '';
      lines.push(`  ${time} ${e.name}: ${num(e.kcal)} kcal, ${num(e.protein_g)} g P${flag}`);
    }
  } else {
    lines.push('Mahlzeiten heute: noch keine eingetragen');
  }

  // ── Habit-backed metrics ──────────────────────────────────────────
  const habits = habitsRes.data ?? [];
  const logs = logsRes.data ?? [];
  const valueFor = (key: string, date: string) => {
    const habit = habits.find((h) => h.key === key);
    if (!habit) return 0;
    return num(logs.find((l) => l.habit_id === habit.id && l.log_date === date)?.value);
  };
  // Health data wins over the habit log where it exists — never summed (§43).
  const healthToday = (healthRes.data ?? []).find((row) => row.log_date === today);
  const stepsToday = healthToday?.steps !== null && healthToday?.steps !== undefined ? num(healthToday.steps) : valueFor('steps', today);
  const sleepMinutes = healthToday?.sleep_minutes !== null && healthToday?.sleep_minutes !== undefined
    ? num(healthToday.sleep_minutes)
    : valueFor('sleep', today) * 60;

  lines.push(`Schritte heute: ${stepsToday}${healthToday?.steps_source === 'apple_health' ? ' (aus Apple Health)' : ''}`);
  lines.push(`Wasser heute: ${valueFor('water', today)} ml`);
  lines.push(`Schlaf letzte Nacht: ${formatSleep(sleepMinutes)}${healthToday?.sleep_source === 'apple_health' ? ' (aus Apple Health)' : ''}`);
  if (healthToday?.active_energy_kcal) lines.push(`Aktive Energie heute: ${num(healthToday.active_energy_kcal)} kcal (Apple Health)`);

  const checkin = checkinRes.data;
  if (checkin?.soreness) {
    lines.push(`Muskelkater: ${checkin.soreness}${checkin.soreness_area ? ` (${checkin.soreness_area})` : ''}`);
  }

  // ── 7-day averages ────────────────────────────────────────────────
  const last7 = (nutritionRes.data ?? []).filter((r) => r.log_date >= dateKeyAddDays(today, -6) && num(r.calories) > 0);
  if (last7.length > 0) {
    const avgKcal = Math.round(last7.reduce((s, r) => s + num(r.calories), 0) / last7.length);
    const avgProtein = Math.round(last7.reduce((s, r) => s + num(r.protein_g), 0) / last7.length);
    lines.push('');
    lines.push(`LETZTE 7 TAGE (${last7.length} Tage mit Daten)`);
    lines.push(`Ø ${avgKcal} kcal, Ø ${avgProtein} g Protein`);
  }

  // ── Weight ────────────────────────────────────────────────────────
  const metrics: BodyMetric[] = (metricsRes.data ?? []).map((row) => ({
    id: row.id,
    logDate: row.log_date,
    weightKg: row.weight_kg === null ? null : num(row.weight_kg),
    waistCm: null,
    chestCm: null,
    armsCm: null,
    bia: null,
    source: 'manual' as const,
  })).reverse();

  const weight = summarizeWeight(metrics);
  if (weight.latest !== null) {
    lines.push('');
    lines.push('GEWICHT');
    lines.push(`Zuletzt gemessen: ${weight.latest} kg am ${weight.latestDate}`);
    if (weight.trendNow !== null) lines.push(`7-Tage-Trend: ${weight.trendNow} kg`);
    if (weight.change7d.deltaKg !== null) lines.push(`Veränderung 7 Tage: ${weight.change7d.deltaKg} kg`);
    if (weight.change30d.deltaKg !== null) lines.push(`Veränderung 30 Tage: ${weight.change30d.deltaKg} kg`);
    const latestBia = (metricsRes.data ?? [])[0];
    if (latestBia?.body_fat_pct) lines.push(`Körperfett: ${num(latestBia.body_fat_pct)} % (BIA-Schätzung der Waage, nicht exakt)`);
  } else {
    lines.push('');
    lines.push('GEWICHT: noch keine Messung eingetragen');
  }

  // ── Training ──────────────────────────────────────────────────────
  const sessions = sessionsRes.data ?? [];
  const thisWeek = sessions.filter((s) => {
    const key = (s.completed_at as string).slice(0, 10);
    return key >= week.start && key <= week.end;
  });
  lines.push('');
  lines.push('TRAINING');
  lines.push(`Diese Woche: ${thisWeek.filter((s) => s.kind !== 'mini').length} von ${targets.weeklyTrainingGoal} vollen Einheiten, ${thisWeek.filter((s) => s.kind === 'mini').length} Mini-Sessions`);
  if (sessions.length > 0) {
    lines.push('Letzte Einheiten:');
    for (const s of sessions.slice(0, 5)) {
      const date = (s.completed_at as string).slice(0, 10);
      const mins = Math.round(num(s.duration_seconds) / 60);
      lines.push(`  ${date}: ${s.day_name}${s.kind === 'mini' ? ' (Mini)' : ''}, ${mins} Min`);
    }
  } else {
    lines.push('Noch kein abgeschlossenes Training.');
  }

  // ── Saved meals ───────────────────────────────────────────────────
  const recipes = recipesRes.data ?? [];
  if (recipes.length > 0) {
    lines.push('');
    lines.push(`Gespeicherte Rezepte: ${recipes.map((r) => r.name).join(', ')}`);
  }

  return lines.join('\n');
}
