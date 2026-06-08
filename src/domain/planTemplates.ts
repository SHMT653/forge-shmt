export type TemplateExercise = {
  name: string;
  targetSets: number;
  targetReps: string;
};

export type TemplateDay = {
  name: string;
  exercises: TemplateExercise[];
};

export type PlanTemplate = {
  id: string;
  name: string;
  focus: string;
  description: string;
  days: TemplateDay[];
};

const ex = (name: string, targetSets: number, targetReps: string): TemplateExercise => ({
  name,
  targetSets,
  targetReps,
});

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'muskelaufbau',
    name: 'Muskelaufbau',
    focus: 'Kraft & Aufbau',
    description: 'Klassischer 3er-Split für stetigen Muskelaufbau.',
    days: [
      {
        name: 'Push',
        exercises: [
          ex('Bankdrücken', 4, '6-10'),
          ex('Schulterdrücken', 3, '8-12'),
          ex('Dips', 3, '8-12'),
          ex('Seitheben', 3, '12-15'),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          ex('Klimmzüge', 4, '6-10'),
          ex('Rudern vorgebeugt', 4, '8-12'),
          ex('Latzug', 3, '10-12'),
          ex('Bizepscurls', 3, '10-12'),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          ex('Kniebeugen', 4, '6-10'),
          ex('Beinpresse', 3, '10-12'),
          ex('Beinbeuger', 3, '10-12'),
          ex('Wadenheben', 4, '12-15'),
        ],
      },
    ],
  },
  {
    id: 'fettabbau',
    name: 'Fettabbau',
    focus: 'Definition & Cardio',
    description: 'Ganzkörper-Training mit hoher Dichte für maximalen Kalorienverbrauch.',
    days: [
      {
        name: 'Ganzkörper A',
        exercises: [
          ex('Kniebeugen', 3, '12-15'),
          ex('Liegestütze', 3, '12-15'),
          ex('Rudern Kurzhantel', 3, '12-15'),
          ex('Ausfallschritte', 3, '12 / Seite'),
          ex('Plank', 3, '45 sek'),
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          ex('Kreuzheben', 3, '10-12'),
          ex('Schulterdrücken', 3, '12-15'),
          ex('Klimmzüge', 3, 'so viele wie möglich'),
          ex('Burpees', 3, '12-15'),
          ex('Mountain Climbers', 3, '40 sek'),
        ],
      },
    ],
  },
  {
    id: 'anfaenger',
    name: 'Anfänger',
    focus: 'Grundlagen aufbauen',
    description: 'Einfacher Einstieg mit den wichtigsten Grundübungen.',
    days: [
      {
        name: 'Ganzkörper',
        exercises: [
          ex('Kniebeugen', 3, '10-12'),
          ex('Liegestütze (Knie optional)', 3, '8-12'),
          ex('Rudern Kurzhantel', 3, '10-12'),
          ex('Plank', 3, '20-30 sek'),
        ],
      },
    ],
  },
  {
    id: 'zuhause',
    name: 'Zuhause',
    focus: 'Bodyweight & Bänder',
    description: 'Effektives Training ohne Geräte – ideal für die Wohnung.',
    days: [
      {
        name: 'Oberkörper',
        exercises: [
          ex('Liegestütze', 4, '10-15'),
          ex('Diamant-Liegestütze', 3, '8-12'),
          ex('Rudern mit Band', 4, '12-15'),
          ex('Pike Push-ups', 3, '8-12'),
        ],
      },
      {
        name: 'Unterkörper',
        exercises: [
          ex('Kniebeugen', 4, '15-20'),
          ex('Ausfallschritte', 3, '12 / Seite'),
          ex('Glute Bridges', 3, '15-20'),
          ex('Wadenheben', 4, '20'),
        ],
      },
    ],
  },
  {
    id: 'gym',
    name: 'Gym',
    focus: 'Geräte & freie Gewichte',
    description: 'Klassischer Studio-Split mit Maschinen und Langhantel.',
    days: [
      {
        name: 'Brust & Trizeps',
        exercises: [
          ex('Bankdrücken', 4, '6-10'),
          ex('Schrägbankdrücken', 3, '8-10'),
          ex('Butterfly', 3, '10-12'),
          ex('Trizepsdrücken am Kabel', 3, '10-12'),
        ],
      },
      {
        name: 'Rücken & Bizeps',
        exercises: [
          ex('Latzug', 4, '8-10'),
          ex('Rudern sitzend', 3, '8-10'),
          ex('Kreuzheben', 3, '6-8'),
          ex('Bizepscurls', 3, '10-12'),
        ],
      },
      {
        name: 'Beine & Schultern',
        exercises: [
          ex('Kniebeugen', 4, '6-10'),
          ex('Beinpresse', 3, '10-12'),
          ex('Schulterdrücken Maschine', 3, '8-12'),
          ex('Seitheben', 3, '12-15'),
        ],
      },
    ],
  },
  {
    id: 'baender',
    name: 'Bänder',
    focus: 'Mobil & gelenkschonend',
    description: 'Widerstandsband-Training für unterwegs oder Reha-Phasen.',
    days: [
      {
        name: 'Ganzkörper mit Band',
        exercises: [
          ex('Kniebeugen mit Band', 3, '15-20'),
          ex('Rudern mit Band', 3, '15-20'),
          ex('Schulterdrücken mit Band', 3, '12-15'),
          ex('Glute Bridges mit Band', 3, '15-20'),
          ex('Bizepscurls mit Band', 3, '15-20'),
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'Push Pull Legs',
    focus: 'Klassischer 6er-Split',
    description: 'Hohe Frequenz durch Wiederholung des Push-Pull-Legs-Zyklus.',
    days: [
      {
        name: 'Push',
        exercises: [
          ex('Bankdrücken', 4, '6-10'),
          ex('Schulterdrücken', 4, '8-10'),
          ex('Schrägbankdrücken Kurzhantel', 3, '8-12'),
          ex('Trizeps-Dips', 3, '10-12'),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          ex('Kreuzheben', 4, '5-8'),
          ex('Klimmzüge', 4, '6-10'),
          ex('Rudern vorgebeugt', 3, '8-12'),
          ex('Face Pulls', 3, '12-15'),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          ex('Kniebeugen', 4, '6-10'),
          ex('Rumänisches Kreuzheben', 3, '8-10'),
          ex('Beinpresse', 3, '10-12'),
          ex('Wadenheben', 4, '12-15'),
        ],
      },
    ],
  },
  {
    id: 'oberkoerper-unterkoerper',
    name: 'Oberkörper Unterkörper',
    focus: '4er-Split',
    description: 'Bewährter Split für Trainierende mit etwas Erfahrung.',
    days: [
      {
        name: 'Oberkörper A',
        exercises: [
          ex('Bankdrücken', 4, '6-10'),
          ex('Rudern vorgebeugt', 4, '8-10'),
          ex('Schulterdrücken', 3, '8-12'),
          ex('Klimmzüge', 3, '6-10'),
        ],
      },
      {
        name: 'Unterkörper A',
        exercises: [
          ex('Kniebeugen', 4, '6-10'),
          ex('Rumänisches Kreuzheben', 3, '8-10'),
          ex('Beinpresse', 3, '10-12'),
          ex('Wadenheben', 4, '12-15'),
        ],
      },
      {
        name: 'Oberkörper B',
        exercises: [
          ex('Schrägbankdrücken', 4, '8-10'),
          ex('Latzug', 3, '8-12'),
          ex('Seitheben', 3, '12-15'),
          ex('Bizepscurls', 3, '10-12'),
        ],
      },
      {
        name: 'Unterkörper B',
        exercises: [
          ex('Kreuzheben', 4, '5-8'),
          ex('Ausfallschritte', 3, '10 / Seite'),
          ex('Beinbeuger', 3, '10-12'),
          ex('Plank', 3, '45 sek'),
        ],
      },
    ],
  },
];
