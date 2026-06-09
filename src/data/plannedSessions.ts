import { getSupabaseServerClient } from '@/services/supabase/serverClient';

export type PlannedSession = {
  id:           string;
  userId:       string;
  planDate:     string;  // "YYYY-MM-DD"
  planDayId:    string | null;
  planDayName:  string;
  planName:     string;
  neoEventId:   string | null;
  plannedStart: string | null; // "HH:MM"
  plannedEnd:   string | null;
  status:       'scheduled' | 'no_slot' | 'skipped';
};

type Row = {
  id: string;
  user_id: string;
  plan_date: string;
  plan_day_id: string | null;
  plan_day_name: string;
  plan_name: string;
  neo_event_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
};

function toPlannedSession(row: Row): PlannedSession {
  return {
    id:           row.id,
    userId:       row.user_id,
    planDate:     row.plan_date,
    planDayId:    row.plan_day_id,
    planDayName:  row.plan_day_name,
    planName:     row.plan_name,
    neoEventId:   row.neo_event_id,
    plannedStart: row.planned_start,
    plannedEnd:   row.planned_end,
    status:       row.status as PlannedSession['status'],
  };
}

/** Get the planned session for a specific user + date (server-side, bypasses RLS) */
export async function getPlannedSession(userId: string, date: string): Promise<PlannedSession | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('forge_planned_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', date)
    .maybeSingle();
  if (error) throw error;
  return data ? toPlannedSession(data as Row) : null;
}

/** Upsert a planned session (insert or update by user_id + plan_date) */
export async function upsertPlannedSession(session: {
  userId:      string;
  planDate:    string;
  planDayId:   string | null;
  planDayName: string;
  planName:    string;
  neoEventId:  string | null;
  plannedStart: string | null;
  plannedEnd:   string | null;
  status:      PlannedSession['status'];
}): Promise<PlannedSession> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('forge_planned_sessions')
    .upsert(
      {
        user_id:       session.userId,
        plan_date:     session.planDate,
        plan_day_id:   session.planDayId,
        plan_day_name: session.planDayName,
        plan_name:     session.planName,
        neo_event_id:  session.neoEventId,
        planned_start: session.plannedStart,
        planned_end:   session.plannedEnd,
        status:        session.status,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'user_id,plan_date' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return toPlannedSession(data as Row);
}

/** List all user IDs that have an active training plan (for the cron job) */
export async function listUsersWithActivePlans(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('forge_training_plans')
    .select('user_id')
    .eq('is_active', true);
  if (error) throw error;
  // Deduplicate (a user should only have one active plan, but be safe)
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
}

/** Get the active plan + days for a user (for the cron job) */
export async function getActivePlanForUser(userId: string): Promise<{
  planId: string; planName: string;
  days: { id: string; name: string; orderIndex: number }[];
  completedSessionCount: number;
} | null> {
  const supabase = getSupabaseServerClient();

  // Active plan
  const { data: plan, error: planError } = await supabase
    .from('forge_training_plans')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  // Plan days
  const { data: days, error: daysError } = await supabase
    .from('forge_plan_days')
    .select('id, name, order_index')
    .eq('plan_id', plan.id)
    .order('order_index', { ascending: true });
  if (daysError) throw daysError;

  // Completed sessions for this plan (to determine rotation position)
  const { count, error: countError } = await supabase
    .from('forge_workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('plan_id', plan.id)
    .not('completed_at', 'is', null);
  if (countError) throw countError;

  return {
    planId:   plan.id,
    planName: plan.name,
    days:     (days ?? []).map((d: { id: string; name: string; order_index: number }) => ({
      id:         d.id,
      name:       d.name,
      orderIndex: d.order_index,
    })),
    completedSessionCount: count ?? 0,
  };
}
