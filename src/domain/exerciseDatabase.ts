import { canPerform, type EquipmentId } from './equipment';

export type ExerciseType = 'strength' | 'cardio';

export type MuscleKey =
  | 'chest' | 'front-delt' | 'side-delt' | 'rear-delt'
  | 'lats' | 'rhomboids' | 'traps' | 'lower-back'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'abs' | 'obliques';

export type ExerciseEntry = {
  name: string;
  muscle: string;
  equipment: 'Langhantel' | 'Kurzhantel' | 'Maschine' | 'Kabel' | 'Körpergewicht' | 'Stange' | 'Band' | 'Kettlebell' | 'Ausdauer';
  defaultSets: number;
  defaultReps: string;
  muscles: MuscleKey[];
  machineInfo?: string;
  type?: ExerciseType;
  met?: number;
  hasDistance?: boolean;
};

export const EXERCISES: ExerciseEntry[] = [
  // ── Brust ────────────────────────────────────────────────────────────
  { name: 'Bankdrücken',              muscle: 'Brust',     equipment: 'Langhantel',    defaultSets: 4, defaultReps: '6-10',  muscles: ['chest', 'front-delt', 'triceps'] },
  { name: 'Schrägbankdrücken',        muscle: 'Brust',     equipment: 'Langhantel',    defaultSets: 4, defaultReps: '8-12',  muscles: ['chest', 'front-delt', 'triceps'] },
  { name: 'Flachbank KH-Drücken',     muscle: 'Brust',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['chest', 'front-delt', 'triceps'] },
  { name: 'Schrägbank KH-Drücken',    muscle: 'Brust',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['chest', 'front-delt', 'triceps'] },
  { name: 'Fliegende (Kurzhantel)',    muscle: 'Brust',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['chest'] },
  { name: 'Kabelfliegende',           muscle: 'Brust',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['chest'], machineInfo: 'Kabelturm — beide Seiten auf Schulterhöhe' },
  { name: 'Kabelfliegende oben',      muscle: 'Brust',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['chest'], machineInfo: 'Kabelturm — Rollen oben, Zugrichtung nach unten zur Hüfte' },
  { name: 'Kabelfliegende unten',     muscle: 'Brust',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['chest'], machineInfo: 'Kabelturm — Rollen unten, Zugrichtung nach oben zur Brust' },
  { name: 'Pec-Deck / Butterfly',     muscle: 'Brust',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '12-15', muscles: ['chest'], machineInfo: 'Butterfly-Maschine / Pec-Deck: Arme auf Polstern zusammenführen' },
  { name: 'Brust-Presse Maschine',    muscle: 'Brust',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '10-12', muscles: ['chest', 'front-delt', 'triceps'], machineInfo: 'Chest Press Machine: Sitz so einstellen, dass Griffe auf Brusthöhe sind' },
  { name: 'Dips (Brust)',             muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-15',  muscles: ['chest', 'triceps', 'front-delt'] },
  { name: 'Liegestütze',              muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-20', muscles: ['chest', 'triceps', 'front-delt'] },

  // ── Rücken ───────────────────────────────────────────────────────────
  { name: 'Klimmzüge',                muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 4, defaultReps: '6-10',  muscles: ['lats', 'biceps', 'rhomboids'] },
  { name: 'Latziehen (weiter Griff)', muscle: 'Rücken',    equipment: 'Kabel',         defaultSets: 4, defaultReps: '8-12',  muscles: ['lats', 'biceps'], machineInfo: 'Latzug-Maschine — weiter Griff, Stange zur oberen Brust ziehen' },
  { name: 'Latziehen (enger Griff)',  muscle: 'Rücken',    equipment: 'Kabel',         defaultSets: 3, defaultReps: '10-12', muscles: ['lats', 'biceps', 'rhomboids'], machineInfo: 'Latzug-Maschine — enger Parallelgriff oder umgekehrter Griff' },
  { name: 'Langhantel-Rudern',        muscle: 'Rücken',    equipment: 'Langhantel',    defaultSets: 4, defaultReps: '8-10',  muscles: ['lats', 'rhomboids', 'rear-delt'] },
  { name: 'Kurzhantel-Rudern',        muscle: 'Rücken',    equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['lats', 'rhomboids', 'rear-delt'] },
  { name: 'Sitzrudern (Kabel)',       muscle: 'Rücken',    equipment: 'Kabel',         defaultSets: 3, defaultReps: '10-12', muscles: ['lats', 'rhomboids', 'rear-delt'], machineInfo: 'Kabelturm — Rollen unten, Parallelgriff oder V-Griff, zur Bauch ziehen' },
  { name: 'Rudern Maschine',          muscle: 'Rücken',    equipment: 'Maschine',      defaultSets: 3, defaultReps: '10-12', muscles: ['lats', 'rhomboids', 'rear-delt'], machineInfo: 'Row Machine / Rudermaschine: Brust an Polster, Griffe zur Brust ziehen' },
  { name: 'T-Bar Rudern',             muscle: 'Rücken',    equipment: 'Langhantel',    defaultSets: 4, defaultReps: '8-10',  muscles: ['lats', 'rhomboids', 'rear-delt'] },
  { name: 'Kreuzheben',               muscle: 'Rücken',    equipment: 'Langhantel',    defaultSets: 4, defaultReps: '5-8',   muscles: ['lower-back', 'hamstrings', 'glutes', 'traps'] },
  { name: 'Rumänisches Kreuzheben',   muscle: 'Rücken',    equipment: 'Langhantel',    defaultSets: 3, defaultReps: '8-12',  muscles: ['hamstrings', 'glutes', 'lower-back'] },
  { name: 'Hyperextension',           muscle: 'Rücken',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '12-15', muscles: ['lower-back', 'glutes'] },
  { name: 'Rückenstrecker Maschine',  muscle: 'Rücken',    equipment: 'Maschine',      defaultSets: 3, defaultReps: '12-15', muscles: ['lower-back'], machineInfo: 'Lower Back Machine / Back Extension Machine: Polster auf Höhe der Hüfte' },
  { name: 'Facepull',                 muscle: 'Rücken',    equipment: 'Kabel',         defaultSets: 3, defaultReps: '15-20', muscles: ['rear-delt', 'rhomboids', 'traps'], machineInfo: 'Kabelturm — Rolle auf Augenhöhe, Seil mit zwei Griffen zum Gesicht ziehen' },

  // ── Schultern ────────────────────────────────────────────────────────
  { name: 'Schulterdrücken (LH)',     muscle: 'Schultern', equipment: 'Langhantel',    defaultSets: 4, defaultReps: '6-10',  muscles: ['front-delt', 'side-delt', 'triceps'] },
  { name: 'Schulterdrücken (KH)',     muscle: 'Schultern', equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '8-12',  muscles: ['front-delt', 'side-delt', 'triceps'] },
  { name: 'Schulterdrücken Maschine', muscle: 'Schultern', equipment: 'Maschine',      defaultSets: 3, defaultReps: '10-12', muscles: ['front-delt', 'side-delt', 'triceps'], machineInfo: 'Shoulder Press Machine: Sitz so einstellen, dass Griffe auf Schulterhöhe sind' },
  { name: 'Seitheben (KH)',           muscle: 'Schultern', equipment: 'Kurzhantel',    defaultSets: 4, defaultReps: '12-15', muscles: ['side-delt'] },
  { name: 'Seitheben (Kabel)',        muscle: 'Schultern', equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['side-delt'], machineInfo: 'Kabelturm — Rolle unten, seitlich vom Körper nach oben ziehen (Schulter = 90°)' },
  { name: 'Frontheben (KH)',          muscle: 'Schultern', equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['front-delt'] },
  { name: 'Frontheben (Kabel)',       muscle: 'Schultern', equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['front-delt'], machineInfo: 'Kabelturm — Rolle unten, Griff nach vorne und oben bis Schulterhöhe' },
  { name: 'Upright Row',              muscle: 'Schultern', equipment: 'Langhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['side-delt', 'front-delt', 'traps'] },
  { name: 'Arnold Press',             muscle: 'Schultern', equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['front-delt', 'side-delt', 'triceps'] },
  { name: 'Hintere Schulter Maschine', muscle: 'Schultern', equipment: 'Maschine',    defaultSets: 3, defaultReps: '12-15', muscles: ['rear-delt', 'rhomboids'], machineInfo: 'Pec-Deck umgekehrt / Rear Delt Fly Machine: Arme werden nach hinten gespreizt' },

  // ── Beine ────────────────────────────────────────────────────────────
  { name: 'Kniebeugen',               muscle: 'Beine',     equipment: 'Langhantel',    defaultSets: 4, defaultReps: '5-8',   muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Front Squat',              muscle: 'Beine',     equipment: 'Langhantel',    defaultSets: 4, defaultReps: '6-8',   muscles: ['quads', 'glutes'] },
  { name: 'Goblet Squat',             muscle: 'Beine',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-15', muscles: ['quads', 'glutes'] },
  { name: 'Beinpresse',               muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 4, defaultReps: '10-12', muscles: ['quads', 'glutes', 'hamstrings'], machineInfo: 'Leg Press Machine: Füße hüftbreit auf Fußplatte, Knie nicht vollständig strecken' },
  { name: 'Beinpresse 45°',           muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 4, defaultReps: '10-12', muscles: ['quads', 'glutes', 'hamstrings'], machineInfo: '45° Beinpresse (Sled): Rücken flach an Lehne, tiefe Kniebeuge möglich' },
  { name: 'Ausfallschritte (LH)',     muscle: 'Beine',     equipment: 'Langhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Ausfallschritte (KH)',     muscle: 'Beine',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Beinstrecker',             muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '12-15', muscles: ['quads'], machineInfo: 'Leg Extension Machine: Rücken gerade, Polster auf Höhe der Knöchel' },
  { name: 'Bein-Curl liegend',        muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '12-15', muscles: ['hamstrings'], machineInfo: 'Lying Leg Curl Machine: Bauch auf Polster, Kniekehle exakt am Scharniergelenk' },
  { name: 'Bein-Curl sitzend',        muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '12-15', muscles: ['hamstrings'], machineInfo: 'Seated Leg Curl Machine: Rücken gerade, Polster auf Knöcheln' },
  { name: 'Hip Thrust',               muscle: 'Beine',     equipment: 'Langhantel',    defaultSets: 3, defaultReps: '10-15', muscles: ['glutes', 'hamstrings'] },
  { name: 'Glute Kickback Kabel',     muscle: 'Beine',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['glutes'], machineInfo: 'Kabelturm — Fußmanschette an Rolle unten, Bein nach hinten strecken' },
  { name: 'Adduktoren Maschine',      muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '15-20', muscles: ['quads'], machineInfo: 'Adductor Machine: Innenoberschenkel, Polster von außen nach innen zusammendrücken' },
  { name: 'Abduktoren Maschine',      muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '15-20', muscles: ['glutes'], machineInfo: 'Abductor Machine: Außenoberschenkel & Gesäß, Polster von innen nach außen drücken' },
  { name: 'Wadenheben stehend',       muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 4, defaultReps: '15-20', muscles: ['calves'], machineInfo: 'Standing Calf Raise Machine: Schulterpolster aufsetzen, volle Streckung & Absenkung' },
  { name: 'Wadenheben sitzend',       muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '15-20', muscles: ['calves'], machineInfo: 'Seated Calf Raise Machine: Kniepolster fest aufsetzen, langsam senken' },
  { name: 'Bulgarian Split Squat',    muscle: 'Beine',     equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['quads', 'glutes'] },
  { name: 'Sumo Kreuzheben',          muscle: 'Beine',     equipment: 'Langhantel',    defaultSets: 4, defaultReps: '6-8',   muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Hacken-Kniebeugen',        muscle: 'Beine',     equipment: 'Maschine',      defaultSets: 3, defaultReps: '10-15', muscles: ['quads', 'glutes'], machineInfo: 'Hack Squat Machine: Rücken flach an Lehne, Füße schulterbreit, tief in die Knie' },
  { name: 'Cable Pull-Through',       muscle: 'Beine',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['glutes', 'hamstrings'], machineInfo: 'Kabelturm — Rolle unten, rückwärts stehen, Seil zwischen den Beinen durchziehen' },

  // ── Bizeps ───────────────────────────────────────────────────────────
  { name: 'LH-Curls',                 muscle: 'Bizeps',    equipment: 'Langhantel',    defaultSets: 4, defaultReps: '8-12',  muscles: ['biceps'] },
  { name: 'KH-Curls',                 muscle: 'Bizeps',    equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['biceps'] },
  { name: 'Hammer Curls',             muscle: 'Bizeps',    equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['biceps', 'forearms'] },
  { name: 'Prediger-Curls (LH)',      muscle: 'Bizeps',    equipment: 'Langhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['biceps'] },
  { name: 'Konzentrations-Curl',      muscle: 'Bizeps',    equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['biceps'] },
  { name: 'Kabel-Curl Stange',        muscle: 'Bizeps',    equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['biceps'], machineInfo: 'Kabelturm — Rolle unten, gerade Stange oder SZ-Stange anhängen' },
  { name: 'Kabel-Curl',               muscle: 'Bizeps',    equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['biceps'], machineInfo: 'Kabelturm — Rolle unten, Karabiner-Griff, ein Arm nach dem anderen' },
  { name: 'Reverse Curls',            muscle: 'Bizeps',    equipment: 'Langhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['biceps', 'forearms'] },
  { name: 'Zottman Curls',            muscle: 'Bizeps',    equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '10-12', muscles: ['biceps', 'forearms'] },

  // ── Trizeps ──────────────────────────────────────────────────────────
  { name: 'Trizepsdrücken Seil',      muscle: 'Trizeps',   equipment: 'Kabel',         defaultSets: 4, defaultReps: '12-15', muscles: ['triceps'], machineInfo: 'Kabelturm — Rolle oben, Seilgriff, Ellbogen seitlich am Körper fixieren' },
  { name: 'Trizepsdrücken Stange',    muscle: 'Trizeps',   equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['triceps'], machineInfo: 'Kabelturm — Rolle oben, gerade Stange oder V-Bar, Ellbogen eng am Körper' },
  { name: 'Skull Crushers',           muscle: 'Trizeps',   equipment: 'Langhantel',    defaultSets: 3, defaultReps: '8-12',  muscles: ['triceps'] },
  { name: 'Trizeps-Kickback',         muscle: 'Trizeps',   equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['triceps'] },
  { name: 'Overhead Extension Kabel', muscle: 'Trizeps',   equipment: 'Kabel',         defaultSets: 3, defaultReps: '12-15', muscles: ['triceps'], machineInfo: 'Kabelturm — Rolle unten oder oben, über Kopf strecken (langer Trizepskopf)' },
  { name: 'Dips (Trizeps)',           muscle: 'Trizeps',   equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['triceps', 'chest'] },
  { name: 'Trizepsstrecken KH',       muscle: 'Trizeps',   equipment: 'Kurzhantel',    defaultSets: 3, defaultReps: '12-15', muscles: ['triceps'] },
  { name: 'Close-Grip Bankdrücken',   muscle: 'Trizeps',   equipment: 'Langhantel',    defaultSets: 4, defaultReps: '8-10',  muscles: ['triceps', 'chest'] },

  // ── Bauch / Core ─────────────────────────────────────────────────────
  { name: 'Crunches',                 muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-25', muscles: ['abs'] },
  { name: 'Plank',                    muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '30-60s', muscles: ['abs', 'obliques'] },
  { name: 'Seitlicher Plank',         muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '30s',   muscles: ['obliques'] },
  { name: 'Russian Twists',           muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-30', muscles: ['abs', 'obliques'] },
  { name: 'Beinheben hängend',        muscle: 'Bauch',     equipment: 'Stange',        defaultSets: 3, defaultReps: '10-15', muscles: ['abs'] },
  { name: 'Ab-Roller',                muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-12',  muscles: ['abs', 'obliques'] },
  { name: 'Kabelziehen Bauch',        muscle: 'Bauch',     equipment: 'Kabel',         defaultSets: 3, defaultReps: '15-20', muscles: ['abs'], machineInfo: 'Kabelturm — Rolle oben, Seil über Kopf, Rumpf nach vorne beugen (Kniend)' },
  { name: 'Mountain Climbers',        muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-30', muscles: ['abs', 'obliques'] },
  { name: 'Reverse Crunches',         muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-20', muscles: ['abs'] },

  // ── Cardio / Ausdauer ────────────────────────────────────────────────
  { name: 'Spazierengehen',           muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'calves'],      type: 'cardio', met: 3.5, hasDistance: true },
  { name: 'Joggen 8 km/h',            muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'calves', 'glutes'], type: 'cardio', met: 8.3, hasDistance: true },
  { name: 'Laufen 10 km/h',           muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '20 Min', muscles: ['quads', 'calves', 'glutes'], type: 'cardio', met: 10.0, hasDistance: true },
  { name: 'Laufen 12 km/h',           muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '20 Min', muscles: ['quads', 'calves', 'glutes'], type: 'cardio', met: 11.8, hasDistance: true },
  { name: 'Fahrrad leicht',           muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '40 Min', muscles: ['quads', 'glutes'],      type: 'cardio', met: 4.0, hasDistance: true },
  { name: 'Fahrrad mittel',           muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'glutes', 'calves'], type: 'cardio', met: 5.8, hasDistance: true },
  { name: 'Fahrrad intensiv',         muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '20 Min', muscles: ['quads', 'glutes', 'calves'], type: 'cardio', met: 10.0, hasDistance: true },
  { name: 'Spinning',                 muscle: 'Cardio',    equipment: 'Maschine', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'glutes'],      type: 'cardio', met: 8.5, machineInfo: 'Spinning-Bike / Indoor Cycling Rad' },
  { name: 'Ellipsentrainer',          muscle: 'Cardio',    equipment: 'Maschine', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'glutes', 'calves'], type: 'cardio', met: 5.0, machineInfo: 'Cross-Trainer / Ellipsentrainer: Ganzkörper-Ausdauer mit geringer Gelenkbelastung' },
  { name: 'Laufband',                 muscle: 'Cardio',    equipment: 'Maschine', defaultSets: 1, defaultReps: '30 Min', muscles: ['quads', 'calves', 'glutes'], type: 'cardio', met: 8.3, hasDistance: true, machineInfo: 'Laufband: Geschwindigkeit in km/h einstellen, leichte Neigung für mehr Intensität' },
  { name: 'Rudergerät',               muscle: 'Cardio',    equipment: 'Maschine', defaultSets: 1, defaultReps: '20 Min', muscles: ['lats', 'rhomboids', 'quads', 'glutes'], type: 'cardio', met: 7.0, machineInfo: 'Rowing Ergometer: Ganzkörper, Zug mit Rücken + Beinen + Armen' },
  { name: 'Stairmaster',              muscle: 'Cardio',    equipment: 'Maschine', defaultSets: 1, defaultReps: '20 Min', muscles: ['quads', 'glutes', 'calves'], type: 'cardio', met: 6.0, machineInfo: 'Step Mill / Stairmaster: Treppensteigen simuliert, hoch effektiv für Gesäß und Waden' },
  { name: 'HIIT',                     muscle: 'Cardio',    equipment: 'Körpergewicht', defaultSets: 1, defaultReps: '20 Min', muscles: ['quads', 'glutes', 'abs'], type: 'cardio', met: 8.0 },
  { name: 'Seilspringen',             muscle: 'Cardio',    equipment: 'Körpergewicht', defaultSets: 1, defaultReps: '15 Min', muscles: ['calves', 'quads', 'abs'], type: 'cardio', met: 11.8 },
  { name: 'Schwimmen',                muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '30 Min', muscles: ['lats', 'chest', 'quads'], type: 'cardio', met: 6.0, hasDistance: true },
  { name: 'Wandern',                  muscle: 'Cardio',    equipment: 'Ausdauer', defaultSets: 1, defaultReps: '60 Min', muscles: ['quads', 'glutes', 'calves'], type: 'cardio', met: 5.3, hasDistance: true },

  // ══════════════════════════════════════════════════════════════════════
  // Home training — bodyweight, bands, pull-up bar, kettlebell
  //
  // The original table was built around a gym: 74 of 97 entries needed a
  // machine, cable or loaded bar. Someone training at home with bands and a
  // bar had four usable exercises for chest, back and legs combined. The
  // block below closes that, with progressions so the same movement can grow
  // with the lifter instead of being replaced.
  // ══════════════════════════════════════════════════════════════════════

  // ── Brust: Körpergewicht, vom Einstieg zur schweren Variante ─────────
  { name: 'Knie-Liegestütze',          muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-15',  muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Einstieg: Knie am Boden, Körper von Kopf bis Knie in einer Linie' },
  { name: 'Liegestütze erhöht',        muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Hände auf Tisch oder Bank — leichter als am Boden' },
  { name: 'Breite Liegestütze',        muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['chest', 'front-delt', 'triceps'] },
  { name: 'Feet Elevated Push-ups',    muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '6-12',  muscles: ['chest', 'front-delt', 'triceps'], machineInfo: 'Füße erhöht auf Stuhl oder Bett — mehr Last auf der oberen Brust' },
  { name: 'Archer Push-ups',           muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '4-8',   muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Gewicht auf eine Seite verlagern, anderer Arm bleibt gestreckt — Vorstufe zum einarmigen' },
  { name: 'Negative Liegestütze',      muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '5-8',   muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Nur die Absenkphase, 4–5 Sekunden langsam' },
  { name: 'Explosive Liegestütze',     muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 4, defaultReps: '5-8',   muscles: ['chest', 'triceps', 'front-delt'] },
  { name: 'Dips zwischen Stühlen',     muscle: 'Brust',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '6-12',  muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Zwei stabile Stühle oder Stuhllehnen' },
  { name: 'Band-Brustpresse',          muscle: 'Brust',     equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Band hinter dem Rücken, Enden in den Händen, nach vorne drücken' },
  { name: 'Band-Fliegende',            muscle: 'Brust',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['chest'], machineInfo: 'Band hinter dem Rücken, Arme fast gestreckt zusammenführen' },
  { name: 'Liegestütze mit Band',      muscle: 'Brust',     equipment: 'Band',          defaultSets: 3, defaultReps: '8-12',  muscles: ['chest', 'triceps', 'front-delt'], machineInfo: 'Band über den Rücken, Enden unter den Händen — Widerstand steigt nach oben hin' },

  // ── Rücken: Stange und Band ──────────────────────────────────────────
  { name: 'Klimmzüge Untergriff',      muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 4, defaultReps: '5-10',  muscles: ['lats', 'biceps', 'rhomboids'], machineInfo: 'Handflächen zu dir — mehr Bizeps als beim Obergriff' },
  { name: 'Klimmzüge Neutralgriff',    muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 4, defaultReps: '5-10',  muscles: ['lats', 'biceps', 'rhomboids'], machineInfo: 'Handflächen zueinander — schulterschonendste Variante' },
  { name: 'Klimmzüge weiter Griff',    muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 4, defaultReps: '4-8',   muscles: ['lats', 'rhomboids', 'biceps'] },
  { name: 'Negative Klimmzüge',        muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 3, defaultReps: '3-6',   muscles: ['lats', 'biceps'], machineInfo: 'Oben starten, 5 Sekunden langsam ablassen — der Weg zum ersten Klimmzug' },
  { name: 'Australian Pull-ups',       muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 3, defaultReps: '8-15',  muscles: ['rhomboids', 'lats', 'biceps'], machineInfo: 'Stange auf Hüfthöhe, Körper schräg darunter — Einstieg ins Ziehen' },
  { name: 'Scapula Pulls',             muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 3, defaultReps: '8-12',  muscles: ['rhomboids', 'traps', 'lats'], machineInfo: 'Arme gestreckt, nur die Schulterblätter nach unten ziehen' },
  { name: 'Dead Hang',                 muscle: 'Rücken',    equipment: 'Stange',        defaultSets: 3, defaultReps: '20-45', muscles: ['lats', 'forearms', 'traps'], machineInfo: 'Reines Hängen — Griffkraft und Schultermobilität' },
  { name: 'Band-Rudern',               muscle: 'Rücken',    equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['rhomboids', 'lats', 'biceps'], machineInfo: 'Band um einen festen Punkt oder um die Füße, zum Bauch ziehen' },
  { name: 'Band-Latzug',               muscle: 'Rücken',    equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['lats', 'biceps'], machineInfo: 'Band oben befestigen, im Knien zur Brust ziehen' },
  { name: 'Band Face Pulls',           muscle: 'Rücken',    equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['rear-delt', 'traps', 'rhomboids'], machineInfo: 'Auf Gesichtshöhe zum Kopf ziehen, Ellbogen hoch — Gegenspieler zum vielen Drücken' },
  { name: 'Band Straight-Arm Pulldown', muscle: 'Rücken',   equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['lats'], machineInfo: 'Arme gestreckt von oben zur Hüfte ziehen' },
  { name: 'Einarmiges Band-Rudern',    muscle: 'Rücken',    equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['lats', 'rhomboids', 'biceps'] },
  { name: 'Superman',                  muscle: 'Rücken',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '12-20', muscles: ['lower-back', 'glutes'] },
  { name: 'Reverse Snow Angels',       muscle: 'Rücken',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '12-20', muscles: ['rear-delt', 'traps', 'rhomboids'], machineInfo: 'Bauchlage, Arme knapp über dem Boden kreisen' },
  { name: 'Y-T-W Raises',              muscle: 'Rücken',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-12',  muscles: ['rear-delt', 'traps', 'rhomboids'], machineInfo: 'Bauchlage, Arme nacheinander in Y-, T- und W-Position heben' },

  // ── Beine: Körpergewicht und Band ────────────────────────────────────
  { name: 'Ausfallschritte',           muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Rückwärts-Ausfallschritte', muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['glutes', 'quads', 'hamstrings'], machineInfo: 'Knieschonender als der Ausfallschritt nach vorne' },
  { name: 'Bulgarian Split Squat (KG)', muscle: 'Beine',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-12',  muscles: ['quads', 'glutes', 'hamstrings'], machineInfo: 'Hinterer Fuß erhöht auf Stuhl oder Sofa' },
  { name: 'Pistol Squat',              muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '3-8',   muscles: ['quads', 'glutes'], machineInfo: 'Einbeinige Kniebeuge — erst an einer Stütze üben' },
  { name: 'Step-ups',                  muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-15', muscles: ['quads', 'glutes'], machineInfo: 'Stuhl oder Treppenstufe, kontrolliert ablassen' },
  { name: 'Glute Bridge',              muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '12-20', muscles: ['glutes', 'hamstrings'] },
  { name: 'Einbeinige Glute Bridge',   muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '8-15',  muscles: ['glutes', 'hamstrings'] },
  { name: 'Nordic Curl',               muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '4-8',   muscles: ['hamstrings', 'glutes'], machineInfo: 'Füße fixieren, Oberkörper langsam nach vorne ablassen — sehr fordernd' },
  { name: 'Wall Sit',                  muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '30-60', muscles: ['quads', 'glutes'] },
  { name: 'Wadenheben (Körpergewicht)', muscle: 'Beine',    equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-25', muscles: ['calves'], machineInfo: 'Auf einer Stufe, Ferse tief ablassen' },
  { name: 'Jump Squats',               muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 4, defaultReps: '8-12',  muscles: ['quads', 'glutes', 'calves'] },
  { name: 'Cossack Squat',             muscle: 'Beine',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '6-10',  muscles: ['quads', 'glutes', 'hamstrings'], machineInfo: 'Seitliche Kniebeuge — auch Mobilität für die Hüfte' },
  { name: 'Band-Kniebeugen',           muscle: 'Beine',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['quads', 'glutes'], machineInfo: 'Band unter den Füßen, Enden auf Schulterhöhe' },
  { name: 'Band Romanian Deadlift',    muscle: 'Beine',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['hamstrings', 'glutes', 'lower-back'] },
  { name: 'Band Kickbacks',            muscle: 'Beine',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['glutes', 'hamstrings'] },
  { name: 'Band Lateral Walks',        muscle: 'Beine',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['glutes'], machineInfo: 'Band um die Oberschenkel, seitliche Schritte in der Hocke' },
  { name: 'Band-Beincurl',             muscle: 'Beine',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['hamstrings'] },

  // ── Schultern ────────────────────────────────────────────────────────
  { name: 'Pike Push-ups',             muscle: 'Schultern', equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '6-12',  muscles: ['front-delt', 'triceps', 'side-delt'], machineInfo: 'Hüfte hoch, Kopf Richtung Boden — die Schulter-Liegestütze' },
  { name: 'Pike Push-ups erhöht',      muscle: 'Schultern', equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '5-10',  muscles: ['front-delt', 'triceps'], machineInfo: 'Füße erhöht — Vorstufe zum Handstand-Drücken' },
  { name: 'Handstand Push-ups (Wand)', muscle: 'Schultern', equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '3-8',   muscles: ['front-delt', 'triceps', 'traps'] },
  { name: 'Band-Schulterdrücken',      muscle: 'Schultern', equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['front-delt', 'triceps', 'side-delt'] },
  { name: 'Band-Seitheben',            muscle: 'Schultern', equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['side-delt'] },
  { name: 'Band-Frontheben',           muscle: 'Schultern', equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['front-delt'] },
  { name: 'Band Reverse Fly',          muscle: 'Schultern', equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['rear-delt', 'rhomboids'] },
  { name: 'Band-Aufrechtes Rudern',    muscle: 'Schultern', equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['side-delt', 'traps'] },

  // ── Arme ─────────────────────────────────────────────────────────────
  { name: 'Diamant-Liegestütze',       muscle: 'Trizeps',   equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '6-12',  muscles: ['triceps', 'chest', 'front-delt'], machineInfo: 'Hände unter der Brust zu einer Raute' },
  { name: 'Bench Dips',                muscle: 'Trizeps',   equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-20', muscles: ['triceps', 'front-delt'], machineInfo: 'Hände auf einer Bank hinter dem Rücken' },
  { name: 'Band-Trizepsdrücken',       muscle: 'Trizeps',   equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['triceps'] },
  { name: 'Band Overhead Extension',   muscle: 'Trizeps',   equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['triceps'] },
  { name: 'Band-Bizepscurls',          muscle: 'Bizeps',    equipment: 'Band',          defaultSets: 3, defaultReps: '12-20', muscles: ['biceps', 'forearms'] },
  { name: 'Band Hammer Curls',         muscle: 'Bizeps',    equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['biceps', 'forearms'] },
  { name: 'Band Concentration Curl',   muscle: 'Bizeps',    equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['biceps'] },
  { name: 'Chin-up Negatives',         muscle: 'Bizeps',    equipment: 'Stange',        defaultSets: 3, defaultReps: '3-6',   muscles: ['biceps', 'lats'], machineInfo: 'Untergriff, langsam ablassen' },

  // ── Rumpf ────────────────────────────────────────────────────────────
  { name: 'Hollow Body Hold',          muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-45', muscles: ['abs'], machineInfo: 'Unterer Rücken bleibt am Boden gepresst' },
  { name: 'V-Ups',                     muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-20', muscles: ['abs'] },
  { name: 'Bicycle Crunches',          muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '15-30', muscles: ['abs', 'obliques'] },
  { name: 'Beinheben liegend',         muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-20', muscles: ['abs'] },
  { name: 'Flutter Kicks',             muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '20-40', muscles: ['abs'] },
  { name: 'Dead Bug',                  muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-16', muscles: ['abs'], machineInfo: 'Gegenüberliegende Arm- und Beinseite langsam strecken' },
  { name: 'Bird Dog',                  muscle: 'Bauch',     equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '10-16', muscles: ['abs', 'lower-back', 'glutes'] },
  { name: 'Plank mit Schulterberührung', muscle: 'Bauch',   equipment: 'Körpergewicht', defaultSets: 3, defaultReps: '16-24', muscles: ['abs', 'obliques', 'front-delt'] },
  { name: 'Knieheben hängend',         muscle: 'Bauch',     equipment: 'Stange',        defaultSets: 3, defaultReps: '8-15',  muscles: ['abs'], machineInfo: 'Leichter als gestreckte Beine' },
  { name: 'Toes to Bar',               muscle: 'Bauch',     equipment: 'Stange',        defaultSets: 3, defaultReps: '5-12',  muscles: ['abs', 'lats'] },
  { name: 'Pallof Press',              muscle: 'Bauch',     equipment: 'Band',          defaultSets: 3, defaultReps: '10-15', muscles: ['obliques', 'abs'], machineInfo: 'Band seitlich befestigt, vor der Brust nach vorne drücken ohne sich zu drehen' },
  { name: 'Band Wood Chop',            muscle: 'Bauch',     equipment: 'Band',          defaultSets: 3, defaultReps: '12-15', muscles: ['obliques', 'abs'] },

  // ── Kettlebell ───────────────────────────────────────────────────────
  { name: 'Kettlebell Swing',          muscle: 'Beine',     equipment: 'Kettlebell',    defaultSets: 4, defaultReps: '12-20', muscles: ['glutes', 'hamstrings', 'lower-back'], machineInfo: 'Hüftstoß, nicht Armheben — die Kugel schwingt von selbst' },
  { name: 'Goblet Squat (Kettlebell)', muscle: 'Beine',     equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '10-15', muscles: ['quads', 'glutes'] },
  { name: 'Kettlebell Romanian Deadlift', muscle: 'Beine',  equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '10-15', muscles: ['hamstrings', 'glutes', 'lower-back'] },
  { name: 'Kettlebell Rudern',         muscle: 'Rücken',    equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '8-12',  muscles: ['lats', 'rhomboids', 'biceps'] },
  { name: 'Kettlebell Schulterdrücken', muscle: 'Schultern', equipment: 'Kettlebell',   defaultSets: 3, defaultReps: '6-12',  muscles: ['front-delt', 'triceps'] },
  { name: 'Turkish Get-up',            muscle: 'Bauch',     equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '3-5',   muscles: ['abs', 'front-delt', 'glutes'], machineInfo: 'Vom Liegen zum Stand mit ausgestrecktem Arm — langsam und kontrolliert' },
  { name: 'Farmers Walk',              muscle: 'Rücken',    equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '30-60', muscles: ['traps', 'forearms', 'abs'] },
  { name: 'Kettlebell Halo',           muscle: 'Schultern', equipment: 'Kettlebell',    defaultSets: 3, defaultReps: '8-12',  muscles: ['front-delt', 'side-delt', 'traps'] },

];

export type ExerciseSearchOptions = {
  limit?: number;
  /**
   * What the user actually owns. Exercises they can perform rank first —
   * with 176 entries an unranked list buries the ten push-up variations under
   * cable and machine work the user has no access to.
   */
  available?: readonly EquipmentId[];
};

/** Maps a table equipment label onto the user's equipment profile. */
function requiredEquipment(entry: ExerciseEntry): EquipmentId {
  switch (entry.equipment) {
    case 'Band': return 'bands';
    case 'Stange': return 'pullup_bar';
    case 'Kurzhantel': return 'dumbbells';
    case 'Langhantel': return 'barbell';
    case 'Kettlebell': return 'kettlebell';
    case 'Maschine':
    case 'Kabel': return 'gym';
    default: return 'bodyweight';
  }
}

/** True when the user's equipment covers this exercise. */
export function canPerformExercise(entry: ExerciseEntry, available: readonly EquipmentId[]): boolean {
  return canPerform(available, requiredEquipment(entry));
}

function matchScore(entry: ExerciseEntry, needle: string): number {
  const name = entry.name.toLowerCase();
  if (name === needle) return 100;
  if (name.startsWith(needle)) return 85;
  if (name.includes(needle)) return 70;
  if (entry.muscle.toLowerCase().includes(needle)) return 45;
  if (entry.equipment.toLowerCase().includes(needle)) return 35;
  return 0;
}

export function searchExercises(query: string, options: ExerciseSearchOptions = {}): ExerciseEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const limit = options.limit ?? 8;
  const available = options.available;

  const scored: { entry: ExerciseEntry; score: number }[] = [];
  for (const entry of EXERCISES) {
    const score = matchScore(entry, needle);
    if (score === 0) continue;
    // A doable exercise outranks an equally good match the user cannot do,
    // without hiding the latter entirely — a gym visit is always possible.
    const bonus = available && available.length > 0 && canPerformExercise(entry, available) ? 30 : 0;
    scored.push({ entry, score: score + bonus });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

export type ExerciseFilter = {
  /** Free text over name, muscle and equipment. */
  query?: string;
  /** Muscle group label as used in the table ('Brust', 'Rücken', …). */
  muscle?: string;
  /** Equipment label as used in the table ('Band', 'Körpergewicht', …). */
  equipment?: string;
  /** Restrict to what the user owns, rather than merely ranking it first. */
  onlyAvailable?: boolean;
  available?: readonly EquipmentId[];
  limit?: number;
};

/**
 * Browsing rather than searching: the filters a user reaches for when they do
 * not already know the exercise name.
 */
export function filterExercises(filter: ExerciseFilter = {}): ExerciseEntry[] {
  const { query, muscle, equipment, onlyAvailable, available, limit = 200 } = filter;
  const needle = query?.trim().toLowerCase() ?? '';

  const matches = EXERCISES.filter((entry) => {
    if (muscle && entry.muscle !== muscle) return false;
    if (equipment && entry.equipment !== equipment) return false;
    if (onlyAvailable && available && !canPerformExercise(entry, available)) return false;
    if (needle && matchScore(entry, needle) === 0) return false;
    return true;
  });

  // With a query, relevance decides; without one, doable exercises come first
  // and the rest keeps table order, which groups by muscle.
  if (needle) {
    return matches
      .map((entry) => ({ entry, score: matchScore(entry, needle) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  if (available && available.length > 0 && !onlyAvailable) {
    return [...matches]
      .sort((a, b) => Number(canPerformExercise(b, available)) - Number(canPerformExercise(a, available)))
      .slice(0, limit);
  }

  return matches.slice(0, limit);
}

/** Distinct muscle group labels, in table order. */
export const MUSCLE_GROUPS = [...new Set(EXERCISES.map((entry) => entry.muscle))];

/** Distinct equipment labels, in table order. */
export const EQUIPMENT_LABELS = [...new Set(EXERCISES.map((entry) => entry.equipment))];

/** Browse by muscle group, again preferring what the user can actually do. */
export function exercisesForMuscle(
  muscle: string,
  options: ExerciseSearchOptions = {},
): ExerciseEntry[] {
  const limit = options.limit ?? 20;
  const available = options.available;

  return EXERCISES.filter((entry) => entry.muscle === muscle)
    .sort((a, b) => {
      if (!available || available.length === 0) return 0;
      const doableA = canPerformExercise(a, available) ? 1 : 0;
      const doableB = canPerformExercise(b, available) ? 1 : 0;
      return doableB - doableA;
    })
    .slice(0, limit);
}

export function findExercise(name: string): ExerciseEntry | undefined {
  return EXERCISES.find((e) => e.name === name);
}
