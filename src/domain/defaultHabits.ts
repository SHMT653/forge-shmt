export type DefaultHabit = {
  key: string;
  label: string;
  unit: string;
  target: number;
  /** true = always show even if user removes it, tapped as binary */
  pinned?: boolean;
  /** true = show +1-glass button instead of free-text input (250ml increments) */
  waterMode?: boolean;
};

export const DEFAULT_HABITS: DefaultHabit[] = [
  { key: 'water',   label: 'Wasser',         unit: 'ml', target: 2500, waterMode: true },
  { key: 'kreatin', label: 'Kreatin',         unit: '',   target: 1,   pinned: true },
  { key: 'protein', label: 'Protein Powder',  unit: '',   target: 1,   pinned: true },
  { key: 'sleep',   label: 'Schlaf',          unit: 'Std', target: 7 },
  { key: 'steps',   label: 'Schritte',        unit: 'Schritte', target: 8000 },
  { key: 'training', label: 'Training',       unit: '',   target: 1 },
];
