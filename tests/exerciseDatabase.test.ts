import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_LABELS, EXERCISES, MUSCLE_GROUPS, canPerformExercise, exercisesForMuscle,
  filterExercises, findExercise, foldExerciseText, normalizeMuscles, searchExercises,
} from '@/domain/exerciseDatabase';
import { MUSCLE_LABEL } from '@/domain/trainingAnalysis';
import { equipmentFromExerciseLabel, type EquipmentId } from '@/domain/equipment';

describe('data integrity', () => {
  it('has no duplicate names', () => {
    // findExercise resolves by name, so a duplicate silently shadows the
    // second entry and misattributes it in the volume analysis.
    const seen = new Map<string, number>();
    for (const entry of EXERCISES) seen.set(entry.name, (seen.get(entry.name) ?? 0) + 1);
    expect([...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name)).toEqual([]);
  });

  it('gives every strength exercise at least one muscle', () => {
    const missing = EXERCISES.filter((e) => e.muscle !== 'Cardio' && e.muscles.length === 0);
    expect(missing.map((e) => e.name)).toEqual([]);
  });

  it('gives every exercise a sensible set and rep default', () => {
    const bad = EXERCISES.filter((e) => e.defaultSets < 1 || e.defaultSets > 6 || !/\d/.test(e.defaultReps));
    expect(bad.map((e) => e.name)).toEqual([]);
  });

  it('covers home training, not just a gym', () => {
    const homeCapable = EXERCISES.filter((e) =>
      e.equipment === 'Körpergewicht' || e.equipment === 'Band' || e.equipment === 'Stange',
    );
    // The original table had 15 of these, which is not a training plan.
    expect(homeCapable.length).toBeGreaterThan(60);
  });

  it('offers bodyweight or band work for every major muscle group', () => {
    for (const muscle of ['Brust', 'Rücken', 'Beine', 'Schultern', 'Bizeps', 'Trizeps', 'Bauch']) {
      const home = EXERCISES.filter(
        (e) => e.muscle === muscle && (e.equipment === 'Körpergewicht' || e.equipment === 'Band' || e.equipment === 'Stange'),
      );
      expect(home.length, `${muscle} braucht Heim-Übungen`).toBeGreaterThan(0);
    }
  });
});

describe('searchExercises', () => {
  it('ranks an exact name above a partial match', () => {
    const results = searchExercises('Liegestütze');
    expect(results[0]?.name).toBe('Liegestütze');
  });

  it('finds by muscle group', () => {
    expect(searchExercises('Brust').length).toBeGreaterThan(0);
  });

  it('finds by equipment', () => {
    const results = searchExercises('Band');
    expect(results.every((e) => e.equipment === 'Band' || e.name.toLowerCase().includes('band'))).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(searchExercises('   ')).toEqual([]);
  });

  it('puts what the user owns first without hiding the rest', () => {
    const home = searchExercises('Brust', { available: ['bodyweight', 'bands'], limit: 5 });
    // The first hit must be something a home trainer can actually do.
    expect(canPerformExercise(home[0]!, ['bodyweight', 'bands'])).toBe(true);
  });

  it('is unaffected by equipment when none is configured', () => {
    expect(searchExercises('Bankdrücken', { available: [] })[0]?.name).toBe('Bankdrücken');
  });

  it('honours the limit', () => {
    expect(searchExercises('e', { limit: 3 })).toHaveLength(3);
  });
});

describe('canPerformExercise', () => {
  it('lets bodyweight work through with no equipment at all', () => {
    const pushup = findExercise('Liegestütze')!;
    expect(canPerformExercise(pushup, [])).toBe(true);
  });

  it('requires a bar for pull-ups', () => {
    const pullup = findExercise('Klimmzüge')!;
    expect(canPerformExercise(pullup, ['bodyweight'])).toBe(false);
    expect(canPerformExercise(pullup, ['bodyweight', 'pullup_bar'])).toBe(true);
  });

  it('requires a band for band work', () => {
    const row = findExercise('Band-Rudern')!;
    expect(canPerformExercise(row, ['bodyweight'])).toBe(false);
    expect(canPerformExercise(row, ['bands'])).toBe(true);
  });

  it('treats a gym as covering machines and cables', () => {
    const machine = EXERCISES.find((e) => e.equipment === 'Maschine')!;
    expect(canPerformExercise(machine, ['gym'])).toBe(true);
    expect(canPerformExercise(machine, ['bodyweight', 'bands'])).toBe(false);
  });
});

describe('exercisesForMuscle', () => {
  it('returns only that muscle group', () => {
    expect(exercisesForMuscle('Brust').every((e) => e.muscle === 'Brust')).toBe(true);
  });

  it('sorts doable exercises to the front', () => {
    const list = exercisesForMuscle('Brust', { available: ['bodyweight'] });
    expect(canPerformExercise(list[0]!, ['bodyweight'])).toBe(true);
  });
});

describe('equipmentFromExerciseLabel', () => {
  it('maps the table labels onto the equipment profile', () => {
    expect(equipmentFromExerciseLabel('Band')).toBe('bands');
    // Regression: 'Stange' fell through to bodyweight, so pull-up work looked
    // doable with no bar at all.
    expect(equipmentFromExerciseLabel('Stange')).toBe('pullup_bar');
    expect(equipmentFromExerciseLabel('Kettlebell')).toBe('kettlebell');
    expect(equipmentFromExerciseLabel('Maschine')).toBe('gym');
    expect(equipmentFromExerciseLabel('Körpergewicht')).toBe('bodyweight');
  });
});

describe('filterExercises — browsing rather than searching', () => {
  it('narrows to a muscle group', () => {
    const results = filterExercises({ muscle: 'Brust' });
    expect(results.length).toBeGreaterThan(10);
    expect(results.every((e) => e.muscle === 'Brust')).toBe(true);
  });

  it('narrows to an equipment type', () => {
    const results = filterExercises({ equipment: 'Band' });
    expect(results.length).toBeGreaterThan(20);
    expect(results.every((e) => e.equipment === 'Band')).toBe(true);
  });

  it('combines both filters', () => {
    const results = filterExercises({ muscle: 'Rücken', equipment: 'Stange' });
    expect(results.every((e) => e.muscle === 'Rücken' && e.equipment === 'Stange')).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('can hide what the user cannot do, rather than just ranking it', () => {
    const home: EquipmentId[] = ['bodyweight', 'bands', 'pullup_bar'];
    const results = filterExercises({ onlyAvailable: true, available: home });
    expect(results.every((e) => canPerformExercise(e, home))).toBe(true);
    // A home setup must still have a real selection to work with.
    expect(results.length).toBeGreaterThan(70);
  });

  it('returns everything when no filter is set', () => {
    expect(filterExercises({ limit: 500 }).length).toBe(EXERCISES.length);
  });

  it('applies the free-text query alongside the filters', () => {
    const results = filterExercises({ muscle: 'Brust', query: 'liegestütze' });
    expect(results.every((e) => e.muscle === 'Brust')).toBe(true);
    expect(results[0]?.name.toLowerCase()).toContain('liegestütze');
  });

  it('returns nothing rather than everything for an impossible combination', () => {
    expect(filterExercises({ muscle: 'Brust', equipment: 'Ausdauer' })).toEqual([]);
  });

  it('exposes the filter options that actually exist in the table', () => {
    expect(MUSCLE_GROUPS).toContain('Brust');
    expect(EQUIPMENT_LABELS).toContain('Band');
    expect(EQUIPMENT_LABELS).toContain('Kettlebell');
    // No duplicates in the chip rows.
    expect(new Set(MUSCLE_GROUPS).size).toBe(MUSCLE_GROUPS.length);
    expect(new Set(EQUIPMENT_LABELS).size).toBe(EQUIPMENT_LABELS.length);
  });
});

describe('search survives how German is actually typed', () => {
  it('finds an umlaut name typed without the umlaut', () => {
    // Regression: "klimmzug" scored zero against "Klimmzüge" because the
    // comparison broke at the umlaut, so the search looked broken.
    expect(searchExercises('klimmzug').map((e) => e.name)).toContain('Klimmzüge');
    expect(searchExercises('ruecken').length).toBeGreaterThan(0);
    expect(searchExercises('rucken').length).toBeGreaterThan(0);
  });

  it('finds a singular when the entry is plural', () => {
    expect(searchExercises('liegestutz').map((e) => e.name)).toContain('Liegestütze');
  });

  it('still finds the correctly spelled name', () => {
    expect(searchExercises('Klimmzüge')[0]?.name).toBe('Klimmzüge');
    expect(searchExercises('Rücken').length).toBeGreaterThan(0);
  });

  it('folds both sides identically so nothing is lost', () => {
    expect(foldExerciseText('Klimmzüge')).toBe(foldExerciseText('klimmzuege'));
    expect(foldExerciseText('Schrägbankdrücken')).toBe(foldExerciseText('schragbankdrucken'));
  });

  it('applies the same tolerance when browsing', () => {
    expect(filterExercises({ query: 'klimmzug' }).map((e) => e.name)).toContain('Klimmzüge');
  });
});

describe('muscle regions are specific enough to act on', () => {
  const muscles = (name: string) => findExercise(name)?.muscles ?? [];

  it('distinguishes the chest heads by pressing angle', () => {
    // Feet elevated tilts the torso head-down: an incline press path.
    expect(muscles('Feet Elevated Push-ups')).toContain('chest-upper');
    // Flat push-ups sit in the middle.
    expect(muscles('Liegestütze')).toContain('chest-mid');
    expect(muscles('Liegestütze')).not.toContain('chest-upper');
    // Dips put the arm behind the torso: the lower head.
    expect(muscles('Dips (Brust)')).toContain('chest-lower');
  });

  it('reads hands-elevated push-ups as the easier, lower-chest variant', () => {
    expect(muscles('Liegestütze erhöht')).toContain('chest-lower');
  });

  it('does not mistake an eccentric rep for a decline angle', () => {
    // "Negative Liegestütze" is eccentric-only, not a decline.
    expect(muscles('Negative Liegestütze')).toContain('chest-mid');
    expect(muscles('Negative Liegestütze')).not.toContain('chest-lower');
  });

  it('reads the cable fly direction, not the word in the name', () => {
    // Pulleys high means the hands travel down — that is the lower pec.
    expect(muscles('Kabelfliegende oben')).toContain('chest-lower');
    expect(muscles('Kabelfliegende unten')).toContain('chest-upper');
  });

  it('reserves the triceps long head for overhead and behind-the-body work', () => {
    expect(muscles('Band Overhead Extension')).toContain('triceps-long');
    // A close-grip press does not stretch the long head.
    expect(muscles('Diamant-Liegestütze')).toContain('triceps-lateral');
    expect(muscles('Diamant-Liegestütze')).not.toContain('triceps-long');
  });

  it('separates hip flexion from trunk flexion in the abs', () => {
    expect(muscles('Beinheben hängend')).toContain('abs-lower');
    expect(muscles('Beinheben hängend')).not.toContain('abs-upper');
    expect(muscles('Crunches')).toContain('abs-upper');
  });

  it('reaches gluteus medius only through abduction work', () => {
    expect(muscles('Band Lateral Walks')).toContain('glute-med');
    expect(muscles('Kniebeugen')).not.toContain('glute-med');
  });

  it('credits the brachialis on neutral and reverse grips', () => {
    expect(muscles('Band Hammer Curls')).toContain('brachialis');
    expect(muscles('Band-Bizepscurls')).not.toContain('brachialis');
  });

  it('separates upper and mid trapezius by movement', () => {
    expect(muscles('Farmers Walk')).toContain('traps-upper');
    expect(muscles('Band Face Pulls')).toContain('traps-mid');
  });

  it('uses only valid region keys everywhere', () => {
    const valid = new Set(Object.keys(MUSCLE_LABEL));
    const bad = EXERCISES.flatMap((e) => e.muscles.filter((m) => !valid.has(m)));
    expect(bad).toEqual([]);
  });

  it('never repeats a region within one exercise', () => {
    const dupes = EXERCISES.filter((e) => new Set(e.muscles).size !== e.muscles.length);
    expect(dupes.map((e) => e.name)).toEqual([]);
  });
});

describe('normalizeMuscles keeps older records readable', () => {
  it('maps the coarse keys onto regions', () => {
    expect(normalizeMuscles(['chest'])).toEqual(['chest-mid']);
    expect(normalizeMuscles(['abs'])).toEqual(['abs-upper', 'abs-lower']);
    expect(normalizeMuscles(['glutes'])).toEqual(['glute-max']);
    expect(normalizeMuscles(['triceps'])).toEqual(['triceps-lateral']);
  });

  it('passes current keys through untouched', () => {
    expect(normalizeMuscles(['chest-upper', 'lats'])).toEqual(['chest-upper', 'lats']);
  });

  it('drops anything unknown instead of rendering a blank region', () => {
    expect(normalizeMuscles(['nonsense', 'lats'])).toEqual(['lats']);
  });

  it('does not duplicate when old and new keys overlap', () => {
    expect(normalizeMuscles(['chest', 'chest-mid'])).toEqual(['chest-mid']);
  });
});
