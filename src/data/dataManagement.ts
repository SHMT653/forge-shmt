import { getSupabaseClient } from '@/services/supabase/client';
import { deleteProgressPhoto, listProgressPhotos } from './progress';

/**
 * Deleting what FORGE has stored, on purpose and in pieces.
 *
 * The default is the opposite of this file: nothing expires, nothing is pruned,
 * and a day from two years ago is still readable. That only works as a promise
 * if there is also a way out — so this is it, and it is deliberately explicit
 * about what each choice removes.
 *
 * Settings are never touched. Targets, equipment and the training plan are
 * configuration, not history; wiping them would turn "delete my data" into
 * "reset the app", which is a different request.
 */

export type DataScope = 'nutrition' | 'training' | 'body' | 'photos' | 'foods' | 'metrics';

export type ScopeInfo = {
  scope: DataScope;
  label: string;
  /** What exactly goes, in plain words. */
  detail: string;
};

export const DATA_SCOPES: ScopeInfo[] = [
  { scope: 'nutrition', label: 'Ernährung',        detail: 'Alle Mahlzeiten und Tagessummen.' },
  { scope: 'training',  label: 'Trainings',        detail: 'Alle Einheiten mit Sätzen und Gewichten. Deine Pläne bleiben.' },
  { scope: 'body',      label: 'Gewicht & Maße',   detail: 'Alle Wiegedaten, Umfänge und BIA-Werte.' },
  { scope: 'photos',    label: 'Fortschrittsbilder', detail: 'Alle Bilder, auch aus dem Speicher.' },
  { scope: 'foods',     label: 'Eigene Lebensmittel', detail: 'Deine gespeicherte Lebensmittel-Datenbank.' },
  { scope: 'metrics',   label: 'Schritte, Schlaf, Trinken', detail: 'Alle Tageswerte und Check-ins.' },
];

/**
 * Tables per scope, child rows first.
 *
 * Most children cascade from their parent, but they are listed anyway: a
 * cascade that was never created would otherwise leave orphans behind and the
 * deletion would look complete when it was not.
 */
const TABLES: Record<DataScope, string[]> = {
  nutrition: ['forge_meal_entries', 'forge_nutrition_logs'],
  training: ['forge_session_sets', 'forge_session_exercises', 'forge_workout_sessions', 'forge_planned_sessions'],
  body: ['forge_body_metrics'],
  photos: ['forge_progress_photos'],
  foods: ['forge_food_items'],
  metrics: ['forge_habit_logs', 'forge_daily_health', 'forge_daily_checkins'],
};

/** Tables whose rows belong to the user through a parent row, not directly. */
const VIA_PARENT: Record<string, { parent: string; column: string; parentColumn: string }> = {
  forge_session_exercises: { parent: 'forge_workout_sessions', column: 'session_id', parentColumn: 'id' },
  forge_habit_logs: { parent: 'forge_habits', column: 'habit_id', parentColumn: 'id' },
};

export type DeleteResult = {
  scope: DataScope;
  /** Tables that reported an error, if any. Empty means everything went. */
  failed: string[];
};

async function deleteTable(userId: string, table: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const link = VIA_PARENT[table];
  if (link) {
    const { data: parents } = await supabase.from(link.parent).select(link.parentColumn).eq('user_id', userId);
    const ids = (parents ?? []).map((row) => (row as unknown as Record<string, unknown>)[link.parentColumn] as string);
    if (ids.length === 0) return true;
    const { error } = await supabase.from(table).delete().in(link.column, ids);
    return !error;
  }

  // forge_session_sets hangs two levels down, so it is reached through its
  // exercises rather than a user column it does not have.
  if (table === 'forge_session_sets') {
    const { data: sessions } = await supabase.from('forge_workout_sessions').select('id').eq('user_id', userId);
    const sessionIds = (sessions ?? []).map((row) => row.id as string);
    if (sessionIds.length === 0) return true;
    const { data: exercises } = await supabase
      .from('forge_session_exercises').select('id').in('session_id', sessionIds);
    const exerciseIds = (exercises ?? []).map((row) => row.id as string);
    if (exerciseIds.length === 0) return true;
    const { error } = await supabase.from(table).delete().in('session_exercise_id', exerciseIds);
    return !error;
  }

  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  return !error;
}

export async function deleteScope(userId: string, scope: DataScope): Promise<DeleteResult> {
  const failed: string[] = [];

  // Photos own files in storage as well as rows; the files go first, because a
  // deleted row is a lost path and the file would be unreachable forever.
  if (scope === 'photos') {
    const photos = await listProgressPhotos(userId);
    for (const photo of photos) {
      try {
        await deleteProgressPhoto(userId, photo.id, photo.storagePath);
      } catch {
        failed.push('forge_progress_photos');
      }
    }
    return { scope, failed: [...new Set(failed)] };
  }

  for (const table of TABLES[scope]) {
    const ok = await deleteTable(userId, table);
    if (!ok) failed.push(table);
  }
  return { scope, failed };
}

export async function deleteScopes(userId: string, scopes: readonly DataScope[]): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];
  for (const scope of scopes) {
    results.push(await deleteScope(userId, scope));
  }
  return results;
}
