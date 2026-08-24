/**
 * Equipment and training focus (§32/§33).
 *
 * FORGE must not assume a gym, and must not assume the home setup either.
 * Both are configuration, and both feed the mini-session and plan suggestions.
 */

export type EquipmentId =
  | 'none'
  | 'bodyweight'
  | 'bands'
  | 'pullup_bar'
  | 'dumbbells'
  | 'barbell'
  | 'gym'
  | 'cardio_machines'
  | 'kettlebell';

export type TrainingFocusId =
  | 'full_body'
  | 'upper_body'
  | 'chest'
  | 'back'
  | 'arms'
  | 'shoulders'
  | 'legs'
  | 'core'
  | 'endurance';

export const EQUIPMENT: { id: EquipmentId; label: string; icon: string }[] = [
  { id: 'bodyweight', label: 'Körpergewicht', icon: '🤸' },
  { id: 'bands', label: 'Widerstandsbänder', icon: '🎗️' },
  { id: 'pullup_bar', label: 'Klimmzugstange', icon: '🏗️' },
  { id: 'dumbbells', label: 'Kurzhanteln', icon: '🏋️' },
  { id: 'kettlebell', label: 'Kettlebell', icon: '🔔' },
  { id: 'barbell', label: 'Langhantel', icon: '🏋️‍♂️' },
  { id: 'cardio_machines', label: 'Cardio-Geräte', icon: '🚴' },
  { id: 'gym', label: 'Fitnessstudio', icon: '🏢' },
  { id: 'none', label: 'Kein Equipment', icon: '∅' },
];

export const TRAINING_FOCUS: { id: TrainingFocusId; label: string }[] = [
  { id: 'full_body', label: 'Ganzkörper' },
  { id: 'upper_body', label: 'Oberkörper' },
  { id: 'chest', label: 'Brust' },
  { id: 'back', label: 'Rücken' },
  { id: 'arms', label: 'Arme' },
  { id: 'shoulders', label: 'Schultern' },
  { id: 'legs', label: 'Beine' },
  { id: 'core', label: 'Core' },
  { id: 'endurance', label: 'Ausdauer' },
];

export function isEquipmentId(value: string): value is EquipmentId {
  return EQUIPMENT.some((item) => item.id === value);
}

export function isTrainingFocusId(value: string): value is TrainingFocusId {
  return TRAINING_FOCUS.some((item) => item.id === value);
}

export function equipmentLabel(id: EquipmentId): string {
  return EQUIPMENT.find((item) => item.id === id)?.label ?? id;
}

export function focusLabel(id: TrainingFocusId): string {
  return TRAINING_FOCUS.find((item) => item.id === id)?.label ?? id;
}

/**
 * Whether a plan or exercise requiring `needed` is doable with what the user has.
 * A gym membership implies the free-weight equipment inside it.
 */
export function canPerform(available: readonly EquipmentId[], needed: EquipmentId): boolean {
  if (needed === 'none' || needed === 'bodyweight') return true;
  if (available.includes(needed)) return true;
  if (available.includes('gym')) {
    return needed === 'dumbbells' || needed === 'barbell' || needed === 'cardio_machines' || needed === 'kettlebell' || needed === 'pullup_bar';
  }
  return false;
}

/**
 * Maps the free-text `equipment` field on the exercise database onto our ids,
 * so plan suggestions can be filtered by what the user actually owns.
 */
export function equipmentFromExerciseLabel(label: string): EquipmentId {
  const needle = label.toLowerCase();
  if (needle.includes('band')) return 'bands';
  // 'Stange' is what the exercise table calls a pull-up bar.
  if (needle.includes('stange') || needle.includes('klimmzug') || needle.includes('pull-up') || needle.includes('pullup')) return 'pullup_bar';
  if (needle.includes('kurzhantel') || needle.includes('dumbbell')) return 'dumbbells';
  if (needle.includes('langhantel') || needle.includes('barbell')) return 'barbell';
  if (needle.includes('kettlebell')) return 'kettlebell';
  if (needle.includes('maschine') || needle.includes('machine') || needle.includes('kabel') || needle.includes('cable')) return 'gym';
  return 'bodyweight';
}
