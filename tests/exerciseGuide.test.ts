import { describe, expect, it } from 'vitest';
import { EXERCISES, findExercise } from '@/domain/exerciseDatabase';
import { guideFor, patternOf } from '@/domain/exerciseGuide';

function guide(name: string) {
  const entry = findExercise(name);
  if (!entry) throw new Error(`missing exercise: ${name}`);
  return guideFor(entry);
}

describe('every exercise gets usable guidance', () => {
  it('covers all of them with steps, mistakes and a tempo cue', () => {
    for (const entry of EXERCISES) {
      const g = guideFor(entry);
      expect(g.steps.length, entry.name).toBeGreaterThan(1);
      expect(g.mistakes.length, entry.name).toBeGreaterThan(1);
      expect(g.tempo.length, entry.name).toBeGreaterThan(10);
      expect(g.summary.length, entry.name).toBeGreaterThan(20);
    }
  });

  it('names one primary muscle and lists the rest as assisting', () => {
    const g = guide('Bankdrücken');
    expect(g.primary).toEqual(['chest-mid']);
    expect(g.secondary).toContain('front-delt');
    expect(g.secondary).toContain('triceps-lateral');
    expect(g.primaryLabels[0]).toBeTruthy();
  });
});

describe('movement patterns are read correctly', () => {
  it('separates elbow flexion from knee flexion', () => {
    // "Curl" appears in both; getting this wrong would tell someone doing leg
    // curls to keep their elbows at their sides.
    expect(patternOf(findExercise('KH-Curls')!)).toBe('curl');
    expect(patternOf(findExercise('Bein-Curl liegend')!)).toBe('knee-flexion');
    expect(patternOf(findExercise('Nordic Curl')!)).toBe('knee-flexion');
  });

  it('treats dips as a press, not an elbow isolation', () => {
    expect(patternOf(findExercise('Dips (Trizeps)')!)).toBe('horizontal-push');
    expect(patternOf(findExercise('Trizeps-Kickback')!)).toBe('triceps-extension');
  });

  it('reads an upright row as a raise, not a row', () => {
    expect(patternOf(findExercise('Upright Row')!)).toBe('raise');
    expect(patternOf(findExercise('Band-Aufrechtes Rudern')!)).toBe('raise');
    expect(patternOf(findExercise('Langhantel-Rudern')!)).toBe('horizontal-pull');
  });

  it('distinguishes a kickback of the hip from one of the triceps', () => {
    expect(patternOf(findExercise('Band Kickbacks')!)).toBe('hip-abduction');
    expect(patternOf(findExercise('Trizeps-Kickback')!)).toBe('triceps-extension');
  });

  it('reads holds as holds', () => {
    expect(patternOf(findExercise('Plank')!)).toBe('core-hold');
    expect(patternOf(findExercise('Wall Sit')!)).toBe('iso-hold');
    expect(patternOf(findExercise('Dead Hang')!)).toBe('iso-hold');
    // The ab-roller resists extension; it does not curl the spine.
    expect(patternOf(findExercise('Ab-Roller')!)).toBe('core-hold');
    expect(patternOf(findExercise('Crunches')!)).toBe('core-flexion');
  });

  it('separates vertical from horizontal pulling', () => {
    expect(patternOf(findExercise('Klimmzüge')!)).toBe('vertical-pull');
    expect(patternOf(findExercise('Australian Pull-ups')!)).toBe('horizontal-pull');
  });

  it('separates overhead from flat pressing', () => {
    expect(patternOf(findExercise('Pike Push-ups')!)).toBe('vertical-push');
    expect(patternOf(findExercise('Liegestütze')!)).toBe('horizontal-push');
  });

  it('reads every cardio entry as cardio', () => {
    for (const entry of EXERCISES.filter((e) => e.muscle === 'Cardio')) {
      expect(patternOf(entry), entry.name).toBe('cardio');
    }
  });

  it('warns about the back on hinges, where it actually matters', () => {
    const g = guide('Kreuzheben');
    expect(g.pattern).toBe('hinge');
    expect(g.mistakes.join(' ')).toMatch(/Rücken/);
  });
});
