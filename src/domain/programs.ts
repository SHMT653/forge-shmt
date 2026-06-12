// Specific goal IDs — stored in DB as program_id text column
export type ProgramId =
  // Fett & Abnehmen
  | 'bauchfett'
  | 'gewicht-verlieren'
  | 'sixpack'
  | 'schlank-definiert'
  // Aufbau & Stärke
  | 'muskeln-aufbauen'
  | 'staerker-werden'
  | 'masse-aufbauen'
  | 'breiter-oberkoerper'
  // Körper formen
  | 'recomp'
  | 'po-beine'
  | 'arme-definieren'
  | 'athletisch'
  // Fitness & Gesundheit
  | 'ausdauer'
  | 'gesund-bleiben'
  | 'mehr-energie'
  | 'stressabbau';

// The 4 underlying tracking "base programs" used by dashboard logic
export type BaseProgram = 'abnehmen' | 'aufbau' | 'komposition' | 'fitness';

export type FastingProtocol = '16:8' | '18:6' | '14:10' | '5:2';

export type Program = {
  id: ProgramId;
  base: BaseProgram;
  icon: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  tip: string;       // one concrete quick tip shown on dashboard
  accentColor: string;
};

export type GoalCategory = {
  id: string;
  label: string;
  icon: string;
  programs: Program[];
};

export const PROGRAMS: Program[] = [
  // ── Fett & Abnehmen ─────────────────────────────────────────────
  {
    id: 'bauchfett',
    base: 'abnehmen',
    icon: '🔥',
    title: 'Bauchfett verbrennen',
    tagline: 'Gezieltes Kaloriendefizit + Cardio',
    description: 'Bauchfett lässt sich nicht isoliert wegtrainieren — aber du kannst durch konsequentes Kaloriendefizit und regelmäßiges Cardio deinen Körperfettanteil senken. Das Bauchfett verschwindet dabei oft als erstes.',
    highlights: ['Tägliches Kaloriendefizit im Blick', 'Cardio-Kalorien werden eingerechnet', 'Intervallfasten beschleunigt Fettabbau', 'Bauchübungen bauen Muskeln auf — Fett geht durchs Defizit'],
    tip: 'Heute 20+ Min Cardio = mehr Bauchfett-Verbrennung',
    accentColor: '#d96060',
  },
  {
    id: 'gewicht-verlieren',
    base: 'abnehmen',
    icon: '⬇️',
    title: 'Gewicht verlieren',
    tagline: 'Weniger essen als du verbrennst',
    description: 'Kaloriendefizit ist das einzige Prinzip das funktioniert. 500 kcal weniger pro Tag = ca. 0,5 kg pro Woche. Die App berechnet dein Defizit täglich aus Essen, Verbrennung und Aktivität.',
    highlights: ['Automatische Defizit-Berechnung', 'Gewichtsverlauf wird getrackt', 'Proteinziel schützt Muskeln', 'Keine Crash-Diät — nachhaltig'],
    tip: 'Ziel: 300–500 kcal Defizit täglich',
    accentColor: '#e07b3a',
  },
  {
    id: 'sixpack',
    base: 'abnehmen',
    icon: '🎯',
    title: 'Sixpack erreichen',
    tagline: 'Körperfett unter 12% für Männer / 20% für Frauen',
    description: 'Ein Sixpack ist zu 80% Ernährung. Du hast schon Bauchmuskeln — sie werden nur von Körperfett verdeckt. Das Ziel: sehr niedriger Körperfettanteil durch striktes Defizit + Krafttraining.',
    highlights: ['Strenges Kaloriendefizit notwendig', 'Hohes Protein für Muskelerhalt', 'Kombiniere Kraft- und Cardiotraining', 'Geduld: Dieser Weg dauert Monate'],
    tip: 'Protein hoch halten — mindestens 2g pro kg Körpergewicht',
    accentColor: '#d96060',
  },
  {
    id: 'schlank-definiert',
    base: 'abnehmen',
    icon: '✨',
    title: 'Schlank & Definiert',
    tagline: 'Toned, lean, muskulös',
    description: 'Nicht einfach "dünn" werden — sondern einen definierten, athletischen Look entwickeln. Kombination aus leichtem Defizit, hohem Protein und konsequentem Krafttraining.',
    highlights: ['Leichtes Kaloriendefizit', 'Sehr hohe Proteinzufuhr', 'Krafttraining 3–4× pro Woche', 'Langsam aber nachhaltig'],
    tip: 'Weniger essen, mehr Protein — das ist die Formel',
    accentColor: '#c9a227',
  },

  // ── Aufbau & Stärke ─────────────────────────────────────────────
  {
    id: 'muskeln-aufbauen',
    base: 'aufbau',
    icon: '💪',
    title: 'Muskeln aufbauen',
    tagline: 'Progressive Überladung + Protein',
    description: 'Muskeln wachsen durch konsequente Belastungssteigerung im Training und ausreichend Protein als Baumaterial. Ein leichter Kalorienüberschuss unterstützt das Wachstum.',
    highlights: ['Proteinziel täglich im Fokus', 'Gewichtssteigerung wird gefeiert (PR!)', 'Leichter Kalorienüberschuss: +200–300 kcal', 'Schlaf & Erholung sind Training'],
    tip: 'Steiger jede Woche Gewicht oder Wiederholungen',
    accentColor: '#7b5cf0',
  },
  {
    id: 'staerker-werden',
    base: 'aufbau',
    icon: '🏋️',
    title: 'Stärker werden',
    tagline: 'Compound-Lifts & Progressive Überladung',
    description: 'Maximalkraft durch Fokus auf Grundübungen: Kniebeuge, Kreuzheben, Bankdrücken, Klimmzüge. Niedriger Rep-Bereich (3–6), schweres Gewicht, lange Erholung.',
    highlights: ['Compound-Übungen priorisieren', 'Schwer & wenige Wiederholungen', 'PRs werden getrackt und gefeiert', 'Ausreichend Protein & Kalorien'],
    tip: 'Heute schwerer als letzte Woche — jedes Mal',
    accentColor: '#7b5cf0',
  },
  {
    id: 'masse-aufbauen',
    base: 'aufbau',
    icon: '📈',
    title: 'Masse aufbauen (Bulk)',
    tagline: 'Kalorienüberschuss & intensives Training',
    description: 'Maximales Muskelwachstum durch echten Kalorienüberschuss. Mehr essen, schwer trainieren, viel schlafen. Akzeptiere etwas Fettaufbau — der kommt beim Definieren weg.',
    highlights: ['Kalorienüberschuss: +400–600 kcal', 'Höchstes Protein (2–2,5g/kg)', 'Schweres Volumentraining', 'Gewichtszunahme wird getrackt'],
    tip: 'Iss genug — Muskeln brauchen Brennstoff',
    accentColor: '#5ba4e8',
  },
  {
    id: 'breiter-oberkoerper',
    base: 'aufbau',
    icon: '🦅',
    title: 'Breiter Oberkörper',
    tagline: 'V-Form: Schultern, Rücken, Brust',
    description: 'Schulterbreite und Latzug-Muskeln erzeugen die V-Form. Fokus auf: Schulterdrücken, Seitheben, Latziehen, Klimmzüge, Bankdrücken. Plus ausreichend Protein.',
    highlights: ['Schultern & Rücken priorisieren', 'Klimmzüge & Latzug täglich', 'Protein für Muskelaufbau', 'Fortschritt sichtbar durch Maßnehmen'],
    tip: 'Schultern + Rücken — das macht den Unterschied',
    accentColor: '#7b5cf0',
  },

  // ── Körper formen ────────────────────────────────────────────────
  {
    id: 'recomp',
    base: 'komposition',
    icon: '⚖️',
    title: 'Body Recomposition',
    tagline: 'Gleichzeitig Fett verlieren & Muskeln aufbauen',
    description: 'Das "Heilige Gral" des Fitness. Möglich, aber langsam. Funktioniert am besten für Anfänger oder nach einer Pause. Sehr hohe Proteinzufuhr + ausgeglichene Kalorien + Krafttraining.',
    highlights: ['Ausgeglichener Kalorienplan', 'Sehr hohes Protein (2–2,5g/kg)', 'Geduld: Monate, nicht Wochen', 'Messung durch Fotos & Maße'],
    tip: 'Dein Körper verändert sich — auch wenn die Waage gleich bleibt',
    accentColor: '#c9a227',
  },
  {
    id: 'po-beine',
    base: 'komposition',
    icon: '🍑',
    title: 'Po & Beine straffen',
    tagline: 'Glutes, Quads & Hamstrings aufbauen',
    description: 'Trainiere gezielt Gesäß und Beine mit Kniebeugen, Hip Thrusts, Romanian Deadlifts und Ausfallschritten. Kombiniert mit leichtem Defizit wird der Bereich definierter.',
    highlights: ['Kniebeugen, Hip Thrust, RDL', 'Leichtes Kaloriendefizit', 'Protein für Muskelentwicklung', 'Ergebnis in 6–12 Wochen sichtbar'],
    tip: 'Hip Thrusts sind die effektivste Glute-Übung — priorisiere sie',
    accentColor: '#d96060',
  },
  {
    id: 'arme-definieren',
    base: 'komposition',
    icon: '💪',
    title: 'Arme definieren',
    tagline: 'Bizeps, Trizeps & Schultern',
    description: 'Definierte Arme entstehen durch Kombination aus Muskelaufbau (Curls, Pushdowns, Dips) und niedrigem Körperfettanteil. Beides gleichzeitig — das ist Body Recomp.',
    highlights: ['Izolationsübungen für Arme', 'Leichtes Kaloriendefizit', 'Protein schützt Muskel', 'Konsistenz ist alles'],
    tip: 'Bi + Tri immer am Ende des Trainings — mit guter Form',
    accentColor: '#7b5cf0',
  },
  {
    id: 'athletisch',
    base: 'komposition',
    icon: '🏅',
    title: 'Athletischer Körper',
    tagline: 'Kraft + Ausdauer + Beweglichkeit',
    description: 'Der Allrounder: stark, fit und beweglich. Kombination aus Krafttraining, Cardio und Mobilität. Kein Extremziel — ein nachhaltiger, funktioneller Körper.',
    highlights: ['Mix aus Kraft & Cardio', 'Ausgeglichene Kalorien', 'Hohe Proteinzufuhr', 'Mobilität nicht vergessen'],
    tip: 'Kombiniere heute Training und 20 Min Cardio',
    accentColor: '#5ba4e8',
  },

  // ── Fitness & Gesundheit ─────────────────────────────────────────
  {
    id: 'ausdauer',
    base: 'fitness',
    icon: '🏃',
    title: 'Ausdauer steigern',
    tagline: '5 km, 10 km, Halbmarathon — dein Ziel',
    description: 'Cardio-Fitness aufbauen durch konsequentes Training: Laufen, Radfahren, Schwimmen. Progressiv steigern, Puls tracken, Erholung ernst nehmen.',
    highlights: ['Cardio-Sessions werden getrackt', 'Kalorienverbrennung sichtbar', 'Progressiv steigern', 'Ausreichend Essen für Performance'],
    tip: 'Heute 30 Min Cardio — deine Ausdauer wächst mit jeder Einheit',
    accentColor: '#6bd9ad',
  },
  {
    id: 'gesund-bleiben',
    base: 'fitness',
    icon: '🌿',
    title: 'Fit & Gesund bleiben',
    tagline: 'Aktiv, ausgeglichen, langfristig',
    description: 'Kein extremes Ziel — einfach dauerhaft gesund und fit bleiben. Regelmäßige Bewegung, gute Gewohnheiten, ausgewogene Ernährung. Der nachhaltigste Ansatz.',
    highlights: ['Regelmäßige Bewegung 3× pro Woche', 'Ausgewogene Ernährung', 'Gewohnheiten tracken', 'Schlaf & Erholung priorisieren'],
    tip: 'Eine gute Gewohnheit heute — langfristig der größte Gewinn',
    accentColor: '#6bd9ad',
  },
  {
    id: 'mehr-energie',
    base: 'fitness',
    icon: '⚡',
    title: 'Mehr Energie im Alltag',
    tagline: 'Weniger Müdigkeit, mehr Leistung',
    description: 'Energie kommt aus gutem Schlaf, ausreichend Wasser, regelmäßiger Bewegung und stabiler Ernährung. Weniger Zucker, mehr Proteine und Bewegung = spürbar mehr Energie.',
    highlights: ['Wasser-Gewohnheit tracken', 'Bewegung verbessert Energie sofort', 'Schlaf als Priorität', 'Stabile Blutzucker durch Protein'],
    tip: 'Heute 2 Gläser Wasser extra — du wirst es spüren',
    accentColor: '#c9a227',
  },
  {
    id: 'stressabbau',
    base: 'fitness',
    icon: '🧘',
    title: 'Stress abbauen',
    tagline: 'Bewegung als mentale Medizin',
    description: 'Sport ist das beste Antidepressivum. Regelmäßiges Training senkt Cortisol, verbessert Schlaf und Stimmung. Fokus auf Konsistenz, nicht Intensität.',
    highlights: ['Täglich etwas bewegen — auch 10 Min', 'Schlafgewohnheit tracken', 'Atemübungen & Mobilität', 'Kein Perfektionismus — Dranbleiben zählt'],
    tip: 'Auch ein kurzes Training hilft gegen Stress — leg jetzt los',
    accentColor: '#6bd9ad',
  },
];

export const GOAL_CATEGORIES: GoalCategory[] = [
  {
    id: 'fett',
    label: 'Fett verbrennen',
    icon: '🔥',
    programs: PROGRAMS.filter((p) => ['bauchfett', 'gewicht-verlieren', 'sixpack', 'schlank-definiert'].includes(p.id)),
  },
  {
    id: 'aufbau',
    label: 'Aufbauen & Stärker',
    icon: '💪',
    programs: PROGRAMS.filter((p) => ['muskeln-aufbauen', 'staerker-werden', 'masse-aufbauen', 'breiter-oberkoerper'].includes(p.id)),
  },
  {
    id: 'formen',
    label: 'Körper formen',
    icon: '⚖️',
    programs: PROGRAMS.filter((p) => ['recomp', 'po-beine', 'arme-definieren', 'athletisch'].includes(p.id)),
  },
  {
    id: 'gesundheit',
    label: 'Fitness & Gesundheit',
    icon: '🌿',
    programs: PROGRAMS.filter((p) => ['ausdauer', 'gesund-bleiben', 'mehr-energie', 'stressabbau'].includes(p.id)),
  },
];

/** Maps a specific goal to its underlying base program for dashboard tracking logic */
export function getBaseProgram(id: ProgramId | null | undefined): BaseProgram | null {
  if (!id) return null;
  return PROGRAMS.find((p) => p.id === id)?.base ?? null;
}

export function getProgram(id: ProgramId | null | undefined): Program | null {
  return PROGRAMS.find((p) => p.id === id) ?? null;
}

export type FastingEntry = {
  id: FastingProtocol;
  title: string;
  shortTitle: string;
  description: string;
  fastHours: number;
  eatHours: number;
  is52: boolean;
};

export const FASTING_PROTOCOLS: FastingEntry[] = [
  {
    id: '14:10',
    title: '14:10 — Sanft',
    shortTitle: '14:10',
    description: '14 Stunden fasten, 10 Stunden essen. Ideal für Einsteiger und aktive Sportler — einfach umzusetzen.',
    fastHours: 14,
    eatHours: 10,
    is52: false,
  },
  {
    id: '16:8',
    title: '16:8 — Classic',
    shortTitle: '16:8',
    description: '16 Stunden fasten, 8 Stunden essen. Die beliebteste IF-Methode — wirksam und gut verträglich.',
    fastHours: 16,
    eatHours: 8,
    is52: false,
  },
  {
    id: '18:6',
    title: '18:6 — Intensiv',
    shortTitle: '18:6',
    description: '18 Stunden fasten, 6 Stunden essen. Mehr Zeit im Fastenzustand für beschleunigte Fettverbrennung.',
    fastHours: 18,
    eatHours: 6,
    is52: false,
  },
  {
    id: '5:2',
    title: '5:2 — Wochenfasten',
    shortTitle: '5:2',
    description: '5 Tage normal essen, 2 Tage auf ca. 500 kcal reduzieren. Flexible Fastentage frei wählbar.',
    fastHours: 0,
    eatHours: 0,
    is52: true,
  },
];

export function getFasting(id: FastingProtocol | null | undefined): FastingEntry | null {
  return FASTING_PROTOCOLS.find((p) => p.id === id) ?? null;
}

export type FastingStatus = {
  isEating: boolean;
  minutesUntilChange: number;
  eatStartHour: number;
  eatEndHour: number;
};

export function getFastingStatus(protocol: FastingEntry, startHour: number): FastingStatus {
  if (protocol.is52) {
    return { isEating: true, minutesUntilChange: 0, eatStartHour: startHour, eatEndHour: startHour };
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const eatStart = startHour * 60;
  const eatEnd = ((startHour + protocol.eatHours) % 24) * 60;
  const eatEndHour = (startHour + protocol.eatHours) % 24;

  let isEating: boolean;
  if (eatEnd > eatStart) {
    isEating = currentMins >= eatStart && currentMins < eatEnd;
  } else {
    isEating = currentMins >= eatStart || currentMins < eatEnd;
  }

  let minutesUntilChange: number;
  if (isEating) {
    minutesUntilChange = eatEnd > currentMins
      ? eatEnd - currentMins
      : 24 * 60 - currentMins + eatEnd;
  } else {
    minutesUntilChange = eatStart > currentMins
      ? eatStart - currentMins
      : 24 * 60 - currentMins + eatStart;
  }

  return { isEating, minutesUntilChange, eatStartHour: startHour, eatEndHour };
}

export function fmtHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} Min`;
  return `${h}:${String(m).padStart(2, '0')} h`;
}
