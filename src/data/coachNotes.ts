import { getSupabaseClient } from '@/services/supabase/client';
import type { CoachNote } from '@/domain/types';

/**
 * Long-lived facts the coach should remember (§35) — "ich trainiere zuhause",
 * "keine Laktose". Kept small on purpose: this is memory, not a diary.
 */
export async function listCoachNotes(userId: string, limit = 40): Promise<CoachNote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('forge_coach_notes')
    .select('id, kind, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: (row.kind === 'preference' || row.kind === 'constraint' ? row.kind : 'fact'),
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function addCoachNote(userId: string, content: string, kind: CoachNote['kind'] = 'fact'): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_coach_notes').insert({ user_id: userId, content, kind });
  if (error) throw error;
}

export async function deleteCoachNote(userId: string, id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('forge_coach_notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
