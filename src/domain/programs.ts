export type ProgramId = 'abnehmen' | 'aufbau' | 'komposition' | 'fitness';
export type FastingProtocol = '16:8' | '18:6' | '14:10' | '5:2';

export type Program = {
  id: ProgramId;
  icon: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  accentColor: string;
};

export const PROGRAMS: Program[] = [
  {
    id: 'abnehmen',
    icon: '🔥',
    title: 'Abnehmen',
    tagline: 'Kaloriendefizit & Fettverbrennung',
    description: 'Du nimmst ab, indem du konsequent weniger Kalorien isst als du verbrennst. Die App hilft dir dabei, dein Defizit im Blick zu behalten, Cardio zu tracken und optional Intervallfasten zu nutzen.',
    highlights: ['Kaloriendefizit täglich sichtbar', 'Cardio-Verbrennung eingerechnet', 'Optionales Intervallfasten', 'Protein schützt Muskulatur'],
    accentColor: '#d96060',
  },
  {
    id: 'aufbau',
    icon: '💪',
    title: 'Muskelaufbau',
    tagline: 'Progressive Überladung & Protein',
    description: 'Muskeln entstehen durch konsequentes Krafttraining, ausreichend Protein und einem leichten Kalorienüberschuss. Die App trackt deine Gewichtsfortschritte und erinnert dich an deine Proteinziele.',
    highlights: ['Proteinziel täglich im Fokus', 'Kraftfortschritt per Übung', 'Trainingskonsistenz tracken', 'Leichter Kalorienüberschuss'],
    accentColor: '#7b5cf0',
  },
  {
    id: 'komposition',
    icon: '⚖️',
    title: 'Body Recomposition',
    tagline: 'Fett abbauen & Muskeln aufbauen',
    description: 'Gleichzeitig Fett abbauen und Muskeln aufbauen — mit sehr hoher Proteinzufuhr, gezieltem Training und ausgeglichenen Kalorien. Langsamer, aber nachhaltiger Fortschritt.',
    highlights: ['Ausgeglichener Kalorienplan', 'Sehr hohe Proteinzufuhr', 'Kraft- & Ausdauertraining', 'Langfristige Veränderung'],
    accentColor: '#c9a227',
  },
  {
    id: 'fitness',
    icon: '🏃',
    title: 'Fit & Gesund',
    tagline: 'Aktiv bleiben & Wohlbefinden',
    description: 'Kein extremes Ziel — du willst einfach gesund, aktiv und ausgeglichen leben. Regelmäßiges Training, guter Schlaf und gesunde Gewohnheiten stehen im Vordergrund.',
    highlights: ['Regelmäßige Bewegung', 'Ausgewogene Ernährung', 'Schlaf & Erholung', 'Langfristige Gewohnheiten'],
    accentColor: '#5ba4e8',
  },
];

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

export function getProgram(id: ProgramId | null | undefined): Program | null {
  return PROGRAMS.find((p) => p.id === id) ?? null;
}

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
