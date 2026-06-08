export type DefaultHabit = {
  key: string;
  label: string;
  unit: string;
  target: number;
};

export const DEFAULT_HABITS: DefaultHabit[] = [
  { key: 'water', label: 'Wasser', unit: 'L', target: 2.5 },
  { key: 'sleep', label: 'Schlaf', unit: 'Std', target: 7 },
  { key: 'steps', label: 'Schritte', unit: 'Schritte', target: 8000 },
  { key: 'training', label: 'Training', unit: '', target: 1 },
  { key: 'protein', label: 'Protein', unit: 'g', target: 150 },
];
