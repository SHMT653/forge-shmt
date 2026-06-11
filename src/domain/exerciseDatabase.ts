export type ExerciseEntry = {
  name: string;
  muscle: string;
  equipment: 'Langhantel' | 'Kurzhantel' | 'Maschine' | 'Kabel' | 'Körpergewicht' | 'Stange';
  defaultSets: number;
  defaultReps: string;
};

export const EXERCISES: ExerciseEntry[] = [
  // ── Brust ────────────────────────────────────────────────────────────
  { name: 'Bankdrücken',              muscle: 'Brust',     equipment: 'Langhantel',  defaultSets: 4, defaultReps: '6-10' },
  { name: 'Schrägbankdrücken',        muscle: 'Brust',     equipment: 'Langhantel',  defaultSets: 4, defaultReps: '8-12' },
  { name: 'Flachbank KH-Drücken',     muscle: 'Brust',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Schrägbank KH-Drücken',    muscle: 'Brust',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Fliegende (Kurzhantel)',    muscle: 'Brust',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Kabelfliegende',           muscle: 'Brust',     equipment: 'Kabel',       defaultSets: 3, defaultReps: '12-15' },
  { name: 'Pec-Deck',                 muscle: 'Brust',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '12-15' },
  { name: 'Dips (Brust)',             muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-15' },
  { name: 'Liegestütze',              muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-20' },

  // ── Rücken ───────────────────────────────────────────────────────────
  { name: 'Klimmzüge',                muscle: 'Rücken',    equipment: 'Stange',      defaultSets: 4, defaultReps: '6-10' },
  { name: 'Latziehen (weiter Griff)', muscle: 'Rücken',    equipment: 'Kabel',       defaultSets: 4, defaultReps: '8-12' },
  { name: 'Latziehen (enger Griff)',  muscle: 'Rücken',    equipment: 'Kabel',       defaultSets: 3, defaultReps: '10-12' },
  { name: 'Langhantel-Rudern',        muscle: 'Rücken',    equipment: 'Langhantel',  defaultSets: 4, defaultReps: '8-10' },
  { name: 'Kurzhantel-Rudern',        muscle: 'Rücken',    equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Sitzrudern (Kabel)',       muscle: 'Rücken',    equipment: 'Kabel',       defaultSets: 3, defaultReps: '10-12' },
  { name: 'T-Bar Rudern',             muscle: 'Rücken',    equipment: 'Langhantel',  defaultSets: 4, defaultReps: '8-10' },
  { name: 'Kreuzheben',               muscle: 'Rücken',    equipment: 'Langhantel',  defaultSets: 4, defaultReps: '5-8' },
  { name: 'Rumänisches Kreuzheben',   muscle: 'Rücken',    equipment: 'Langhantel',  defaultSets: 3, defaultReps: '8-12' },
  { name: 'Hyperextension',           muscle: 'Rücken',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '12-15' },
  { name: 'Facepull',                 muscle: 'Rücken',    equipment: 'Kabel',       defaultSets: 3, defaultReps: '15-20' },

  // ── Schultern ────────────────────────────────────────────────────────
  { name: 'Schulterdrücken (LH)',     muscle: 'Schultern', equipment: 'Langhantel',  defaultSets: 4, defaultReps: '6-10' },
  { name: 'Schulterdrücken (KH)',     muscle: 'Schultern', equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '8-12' },
  { name: 'Schulterdrücken Maschine', muscle: 'Schultern', equipment: 'Maschine',    defaultSets: 3, defaultReps: '10-12' },
  { name: 'Seitheben (KH)',           muscle: 'Schultern', equipment: 'Kurzhantel',  defaultSets: 4, defaultReps: '12-15' },
  { name: 'Seitheben (Kabel)',        muscle: 'Schultern', equipment: 'Kabel',       defaultSets: 3, defaultReps: '12-15' },
  { name: 'Frontheben (KH)',          muscle: 'Schultern', equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Upright Row',              muscle: 'Schultern', equipment: 'Langhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Arnold Press',             muscle: 'Schultern', equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Hintere Schulter Maschine', muscle: 'Schultern', equipment: 'Maschine',   defaultSets: 3, defaultReps: '12-15' },

  // ── Beine ────────────────────────────────────────────────────────────
  { name: 'Kniebeugen',               muscle: 'Beine',     equipment: 'Langhantel',  defaultSets: 4, defaultReps: '5-8' },
  { name: 'Front Squat',              muscle: 'Beine',     equipment: 'Langhantel',  defaultSets: 4, defaultReps: '6-8' },
  { name: 'Goblet Squat',             muscle: 'Beine',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-15' },
  { name: 'Beinpresse',               muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 4, defaultReps: '10-12' },
  { name: 'Ausfallschritte (LH)',     muscle: 'Beine',     equipment: 'Langhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Ausfallschritte (KH)',     muscle: 'Beine',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Beinstrecker',             muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '12-15' },
  { name: 'Bein-Curl liegend',        muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '12-15' },
  { name: 'Bein-Curl sitzend',        muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '12-15' },
  { name: 'Hip Thrust',               muscle: 'Beine',     equipment: 'Langhantel',  defaultSets: 3, defaultReps: '10-15' },
  { name: 'Wadenheben stehend',       muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 4, defaultReps: '15-20' },
  { name: 'Wadenheben sitzend',       muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '15-20' },
  { name: 'Bulgarian Split Squat',    muscle: 'Beine',     equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Sumo Kreuzheben',          muscle: 'Beine',     equipment: 'Langhantel',  defaultSets: 4, defaultReps: '6-8' },
  { name: 'Hacken-Kniebeugen',        muscle: 'Beine',     equipment: 'Maschine',    defaultSets: 3, defaultReps: '10-15' },

  // ── Bizeps ───────────────────────────────────────────────────────────
  { name: 'LH-Curls',                 muscle: 'Bizeps',    equipment: 'Langhantel',  defaultSets: 4, defaultReps: '8-12' },
  { name: 'KH-Curls',                 muscle: 'Bizeps',    equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Hammer Curls',             muscle: 'Bizeps',    equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Prediger-Curls (LH)',      muscle: 'Bizeps',    equipment: 'Langhantel',  defaultSets: 3, defaultReps: '10-12' },
  { name: 'Konzentrations-Curl',      muscle: 'Bizeps',    equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Kabel-Curl',               muscle: 'Bizeps',    equipment: 'Kabel',       defaultSets: 3, defaultReps: '12-15' },
  { name: 'Reverse Curls',            muscle: 'Bizeps',    equipment: 'Langhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Zottman Curls',            muscle: 'Bizeps',    equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '10-12' },

  // ── Trizeps ──────────────────────────────────────────────────────────
  { name: 'Trizepsdrücken Kabel',     muscle: 'Trizeps',   equipment: 'Kabel',       defaultSets: 4, defaultReps: '10-15' },
  { name: 'Skull Crushers',           muscle: 'Trizeps',   equipment: 'Langhantel',  defaultSets: 3, defaultReps: '8-12' },
  { name: 'Trizeps-Kickback',         muscle: 'Trizeps',   equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Dips (Trizeps)',           muscle: 'Trizeps',   equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15' },
  { name: 'Trizepsstrecken KH',       muscle: 'Trizeps',   equipment: 'Kurzhantel',  defaultSets: 3, defaultReps: '12-15' },
  { name: 'Close-Grip Bankdrücken',   muscle: 'Trizeps',   equipment: 'Langhantel',  defaultSets: 4, defaultReps: '8-10' },
  { name: 'Trizepsdrücken Seil',      muscle: 'Trizeps',   equipment: 'Kabel',       defaultSets: 3, defaultReps: '12-15' },

  // ── Bauch / Core ─────────────────────────────────────────────────────
  { name: 'Crunches',                 muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-25' },
  { name: 'Plank',                    muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '30-60s' },
  { name: 'Seitlicher Plank',         muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '30s' },
  { name: 'Russian Twists',           muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-30' },
  { name: 'Beinheben hängend',        muscle: 'Bauch',     equipment: 'Stange',      defaultSets: 3, defaultReps: '10-15' },
  { name: 'Ab-Roller',                muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-12' },
  { name: 'Kabelziehen Bauch',        muscle: 'Bauch',     equipment: 'Kabel',       defaultSets: 3, defaultReps: '15-20' },
  { name: 'Mountain Climbers',        muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-30' },
  { name: 'Reverse Crunches',         muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-20' },
];

export function searchExercises(query: string, limit = 8): ExerciseEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISES.filter(
    (e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
  ).slice(0, limit);
}
