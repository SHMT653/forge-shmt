import { getSupabaseClient } from '@/services/supabase/client';
import type { Habit, HabitLog } from '@/domain/types';
import { DEFAULT_HABITS } from '@/domain/defaultHabits';

function toHabit(row: { id: string; key: string; label: string; unit: string; target: number; order_index: number; active: boolean }): Habit {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    unit: row.unit,
    target: Number(row.target),
    orderIndex: row.order_index,
    active: row.active,
  };
}

export async function listHabits(userId: string): Promise<Habit[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_habits')
    .select('id, key, label, unit, target, order_index, active')
    .eq('user_id', userId)
    .eq('active', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toHabit);
}

/** Seeds the default habit set for a user the first time they open Habits.
 *  Also ensures pinned habits (kreatin, protein) always exist even for old users. */
export async function ensureDefaultHabits(userId: string): Promise<Habit[]> {
  const existing = await listHabits(userId);

  if (existing.length === 0) {
    // First-time user: seed all defaults
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('forge_habits')
      .insert(
        DEFAULT_HABITS.map((habit, index) => ({
          user_id: userId,
          key: habit.key,
          label: habit.label,
          unit: habit.unit,
          target: habit.target,
          order_index: index,
        })),
      )
      .select('id, key, label, unit, target, order_index, active');
    if (error) throw error;
    return (data ?? []).map(toHabit);
  }

  // Existing user: ensure pinned habits (kreatin, protein) are present
  const pinnedDefaults = DEFAULT_HABITS.filter((d) => d.pinned);
  const existingKeys = new Set(existing.map((h) => h.key));
  const missing = pinnedDefaults.filter((d) => !existingKeys.has(d.key));

  let updated = existing;

  if (missing.length > 0) {
    const supabase = getSupabaseClient();
    const maxOrder = Math.max(...existing.map((h) => h.orderIndex), existing.length - 1);
    const { data, error } = await supabase
      .from('forge_habits')
      .insert(
        missing.map((habit, i) => ({
          user_id: userId,
          key: habit.key,
          label: habit.label,
          unit: habit.unit,
          target: habit.target,
          order_index: maxOrder + 1 + i,
        })),
      )
      .select('id, key, label, unit, target, order_index, active');
    if (error) throw error;
    updated = [...existing, ...(data ?? []).map(toHabit)];
  }

  // Fix stale targets: if a default habit's stored target doesn't match the canonical
  // value (e.g. water was stored as 2.5 instead of 2500), update it and reset any
  // log that was set to the old (wrong) target by the legacy binary toggle.
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const fixPromises: Promise<unknown>[] = [];
  for (const habit of updated) {
    const def = DEFAULT_HABITS.find((d) => d.key === habit.key);
    if (def && habit.target !== def.target) {
      const oldTarget = habit.target;
      fixPromises.push(
        Promise.resolve(supabase.from('forge_habits').update({ target: def.target }).eq('id', habit.id)),
      );
      // Reset today's log if it was set to the stale target (binary toggle artifact)
      fixPromises.push(
        Promise.resolve(
          supabase
            .from('forge_habit_logs')
            .update({ value: 0, completed: false })
            .eq('habit_id', habit.id)
            .eq('log_date', today)
            .eq('value', oldTarget),
        ),
      );
      habit.target = def.target;
    }
  }
  await Promise.all(fixPromises);

  // Water-specific: reset today's log if value < 250 (legacy liter value, not ml)
  const waterHabit = updated.find((h) => h.key === 'water');
  if (waterHabit) {
    const { data: wlog } = await supabase
      .from('forge_habit_logs')
      .select('value')
      .eq('habit_id', waterHabit.id)
      .eq('user_id', userId)
      .eq('log_date', today)
      .maybeSingle();
    if (wlog && Number(wlog.value) > 0 && Number(wlog.value) < 250) {
      await supabase
        .from('forge_habit_logs')
        .update({ value: 0, completed: false })
        .eq('habit_id', waterHabit.id)
        .eq('log_date', today);
    }
  }

  return updated;
}

export async function listHabitLogsForRange(userId: string, fromDate: string): Promise<HabitLog[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_habit_logs')
    .select('habit_id, log_date, value, completed')
    .eq('user_id', userId)
    .gte('log_date', fromDate);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    habitId: row.habit_id,
    logDate: row.log_date,
    value: Number(row.value),
    completed: row.completed,
  }));
}

export async function setHabitLog(
  userId: string,
  habitId: string,
  logDate: string,
  value: number,
  completed: boolean,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('forge_habit_logs')
    .upsert(
      { user_id: userId, habit_id: habitId, log_date: logDate, value, completed },
      { onConflict: 'habit_id,log_date' },
    );
  if (error) throw error;
}
