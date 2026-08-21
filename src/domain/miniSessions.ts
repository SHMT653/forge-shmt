/**
 * Mini sessions (§19) built from what the user actually owns (§33).
 *
 * The previous version hard-coded push-ups and planks, which is only correct
 * for one particular home setup. This picks from the available equipment so a
 * gym user and a bodyweight user both get something they can do right now.
 */

import { canPerform, type EquipmentId } from './equipment';

export type MiniExercise = { name: string; sets: number; targetReps: string };

type Candidate = MiniExercise & { needs: EquipmentId };

const CANDIDATES: Candidate[] = [
  { name: 'Liegestütze', sets: 3, targetReps: '8-12', needs: 'bodyweight' },
  { name: 'Kniebeugen', sets: 3, targetReps: '12-15', needs: 'bodyweight' },
  { name: 'Plank', sets: 2, targetReps: '45-60', needs: 'bodyweight' },
  { name: 'Klimmzüge', sets: 3, targetReps: '4-8', needs: 'pullup_bar' },
  { name: 'Band Rows', sets: 3, targetReps: '10-15', needs: 'bands' },
  { name: 'Bizepscurls', sets: 3, targetReps: '10-15', needs: 'dumbbells' },
  { name: 'Kettlebell Swings', sets: 3, targetReps: '12-15', needs: 'kettlebell' },
];

export type MiniSession = { name: string; exercises: MiniExercise[] };

/**
 * A short session that takes five to eight minutes. Never empty: bodyweight
 * work needs no equipment, so there is always something to fall back on.
 */
export function suggestMiniSession(equipment: readonly EquipmentId[]): MiniSession {
  const usable = CANDIDATES.filter((candidate) => canPerform(equipment, candidate.needs));
  const chosen = usable.slice(0, 3).map(({ name, sets, targetReps }) => ({ name, sets, targetReps }));

  return {
    name: 'Quick Session',
    exercises: chosen.length > 0 ? chosen : [{ name: 'Liegestütze', sets: 3, targetReps: '8-12' }],
  };
}
