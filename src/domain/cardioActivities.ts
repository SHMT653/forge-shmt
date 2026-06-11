// MET values from the 2011 Compendium of Physical Activities (Ainsworth et al.)
// Formula: kcal = MET × weight_kg × duration_min / 60

export type CardioActivity = {
  id: string;
  name: string;
  icon: string;
  met: number;
  category: string;
  hasDistance: boolean;
  description: string;
};

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  // ── Laufen & Gehen ─────────────────────────────────────────────────────
  {
    id: 'walk_5',
    name: 'Spazieren (5 km/h)',
    icon: '🚶',
    met: 3.5,
    category: 'Laufen',
    hasDistance: true,
    description: 'Normales Gehtempo, leichte Belastung',
  },
  {
    id: 'walk_6',
    name: 'Zügiges Gehen (6 km/h)',
    icon: '🚶',
    met: 4.3,
    category: 'Laufen',
    hasDistance: true,
    description: 'Schnelles Gehtempo, Puls leicht erhöht',
  },
  {
    id: 'jog_8',
    name: 'Joggen (8 km/h)',
    icon: '🏃',
    met: 8.3,
    category: 'Laufen',
    hasDistance: true,
    description: 'Lockeres Lauftempo, Dauerlauf-Pace',
  },
  {
    id: 'run_10',
    name: 'Laufen (10 km/h)',
    icon: '🏃',
    met: 10.0,
    category: 'Laufen',
    hasDistance: true,
    description: 'Mittlere Laufgeschwindigkeit',
  },
  {
    id: 'run_12',
    name: 'Laufen (12 km/h)',
    icon: '🏃',
    met: 11.8,
    category: 'Laufen',
    hasDistance: true,
    description: 'Zügiges Lauftempo, hohe Intensität',
  },
  {
    id: 'run_14',
    name: 'Laufen (14 km/h)',
    icon: '⚡',
    met: 14.0,
    category: 'Laufen',
    hasDistance: true,
    description: 'Schnelllauf, sehr hohe Intensität',
  },
  // ── Radfahren ──────────────────────────────────────────────────────────
  {
    id: 'bike_easy',
    name: 'Radfahren locker (< 16 km/h)',
    icon: '🚴',
    met: 4.0,
    category: 'Radfahren',
    hasDistance: true,
    description: 'Gemütliche Radtour, wenig Steigung',
  },
  {
    id: 'bike_15',
    name: 'Radfahren moderat (16–19 km/h)',
    icon: '🚴',
    met: 5.8,
    category: 'Radfahren',
    hasDistance: true,
    description: 'Moderate Belastung, gutes Tempo',
  },
  {
    id: 'bike_20',
    name: 'Radfahren zügig (20–22 km/h)',
    icon: '🚴',
    met: 7.5,
    category: 'Radfahren',
    hasDistance: true,
    description: 'Hohes Tempo, für Geübte',
  },
  {
    id: 'bike_25',
    name: 'Radfahren schnell (23–26 km/h)',
    icon: '🚴',
    met: 10.0,
    category: 'Radfahren',
    hasDistance: true,
    description: 'Sehr hohes Tempo, sportliches Fahren',
  },
  {
    id: 'spin',
    name: 'Spinning / Indoor-Bike',
    icon: '🚵',
    met: 8.5,
    category: 'Radfahren',
    hasDistance: false,
    description: 'Intensives Indoor-Cycling mit hohem Widerstand',
  },
  // ── Schwimmen ──────────────────────────────────────────────────────────
  {
    id: 'swim_easy',
    name: 'Schwimmen (moderat)',
    icon: '🏊',
    met: 6.0,
    category: 'Schwimmen',
    hasDistance: false,
    description: 'Lockeres Schwimmen, Erholung oder Technikarbeit',
  },
  {
    id: 'swim_hard',
    name: 'Schwimmen (intensiv, Kraulen)',
    icon: '🏊',
    met: 9.8,
    category: 'Schwimmen',
    hasDistance: false,
    description: 'Schnelles Kraulen, maximale Intensität',
  },
  // ── Geräte / Maschinen ─────────────────────────────────────────────────
  {
    id: 'elliptical',
    name: 'Cross-Trainer / Elliptical',
    icon: '🔄',
    met: 5.0,
    category: 'Geräte',
    hasDistance: false,
    description: 'Gelenkschonendes Ausdauertraining, ganzer Körper',
  },
  {
    id: 'rowing_mod',
    name: 'Ruderergometer (moderat)',
    icon: '🚣',
    met: 7.0,
    category: 'Geräte',
    hasDistance: false,
    description: 'Rudern bei mittlerer Intensität, ganzer Körper',
  },
  {
    id: 'rowing_hard',
    name: 'Ruderergometer (intensiv)',
    icon: '🚣',
    met: 8.5,
    category: 'Geräte',
    hasDistance: false,
    description: 'Intensives Rudern, hohe Herzfrequenz',
  },
  {
    id: 'stair',
    name: 'Stairmaster / Treppensteigen',
    icon: '🪜',
    met: 6.0,
    category: 'Geräte',
    hasDistance: false,
    description: 'Effektives Bein- und Ausdauertraining',
  },
  {
    id: 'treadmill_incline',
    name: 'Laufband mit Steigung',
    icon: '⛰️',
    met: 9.0,
    category: 'Geräte',
    hasDistance: false,
    description: 'Inkliniertes Laufen, höherer Kalorienverbrauch',
  },
  // ── Hochintensiv ───────────────────────────────────────────────────────
  {
    id: 'hiit',
    name: 'HIIT',
    icon: '💥',
    met: 8.0,
    category: 'Hochintensiv',
    hasDistance: false,
    description: 'Hochintensives Intervalltraining, Nachbrenneffekt',
  },
  {
    id: 'jump_rope',
    name: 'Seilspringen',
    icon: '🪢',
    met: 11.8,
    category: 'Hochintensiv',
    hasDistance: false,
    description: 'Sehr effektiv, hohe kcal-Verbrennung pro Minute',
  },
  {
    id: 'burpees',
    name: 'Burpees',
    icon: '💪',
    met: 8.0,
    category: 'Hochintensiv',
    hasDistance: false,
    description: 'Ganzkörper-Übung, maximale Intensität',
  },
  // ── Kampfsport ─────────────────────────────────────────────────────────
  {
    id: 'boxing',
    name: 'Boxen / Sandsack',
    icon: '🥊',
    met: 7.8,
    category: 'Kampfsport',
    hasDistance: false,
    description: 'Boxtraining am Sandsack oder Sparring',
  },
  {
    id: 'martial',
    name: 'Kampfsport / MMA',
    icon: '🥋',
    met: 9.8,
    category: 'Kampfsport',
    hasDistance: false,
    description: 'Intensives Kampfsporttraining',
  },
  // ── Sanft / Aktiv ──────────────────────────────────────────────────────
  {
    id: 'yoga',
    name: 'Yoga (Hatha)',
    icon: '🧘',
    met: 2.5,
    category: 'Sanft',
    hasDistance: false,
    description: 'Entspannend und dehnend, niedriger Kalorienverbrauch',
  },
  {
    id: 'yoga_power',
    name: 'Power Yoga / Vinyasa',
    icon: '🧘',
    met: 4.0,
    category: 'Sanft',
    hasDistance: false,
    description: 'Dynamisches Yoga, mittlere Intensität',
  },
  {
    id: 'pilates',
    name: 'Pilates',
    icon: '🤸',
    met: 3.0,
    category: 'Sanft',
    hasDistance: false,
    description: 'Stärkung von Core und Stabilisationsmuskeln',
  },
  {
    id: 'dance',
    name: 'Tanzen / Zumba',
    icon: '💃',
    met: 4.8,
    category: 'Sanft',
    hasDistance: false,
    description: 'Tanzen macht Spaß und verbrennt ordentlich Kalorien',
  },
  {
    id: 'hike',
    name: 'Wandern',
    icon: '🥾',
    met: 5.3,
    category: 'Sanft',
    hasDistance: true,
    description: 'Wandern in der Natur, moderat bis intensiv je nach Gelände',
  },
];

export const CARDIO_CATEGORIES = [...new Set(CARDIO_ACTIVITIES.map((a) => a.category))];

/** kcal = MET × weight_kg × duration_min / 60  (Ainsworth et al., 2011 Compendium) */
export function calcKcalBurned(met: number, weightKg: number, durationMinutes: number): number {
  return Math.round(met * weightKg * (durationMinutes / 60));
}
