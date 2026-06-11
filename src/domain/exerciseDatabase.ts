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
  equipment: 'Langhantel' | 'Kurzhantel' | 'Maschine' | 'Kabel' | 'Körpergewicht' | 'Stange' | 'Ausdauer';
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
];

export function searchExercises(query: string, limit = 8): ExerciseEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return EXERCISES.filter(
    (e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q)
  ).slice(0, limit);
}

export function findExercise(name: string): ExerciseEntry | undefined {
  return EXERCISES.find((e) => e.name === name);
}
