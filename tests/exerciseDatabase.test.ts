import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_LABELS, EXERCISES, MUSCLE_GROUPS, canPerformExercise, exercisesForMuscle,
  filterExercises, findExercise, searchExercises,
} from '@/domain/exerciseDatabase';
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
