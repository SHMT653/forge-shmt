// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExerciseFormSvg, figureFor } from '@/web/components/ExerciseFormSvg';
import { EXERCISES, findExercise } from '@/domain/exerciseDatabase';
import { guideFor } from '@/domain/exerciseGuide';

describe('every exercise gets a form figure', () => {
  it('draws something for all 176 of them', () => {
    for (const entry of EXERCISES) {
      const guide = guideFor(entry);
      const { container } = render(
        <ExerciseFormSvg name={entry.name} pattern={guide.pattern} patternLabel={guide.patternLabel} />,
      );
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length, entry.name).toBeGreaterThan(0);
      // Every figure needs a head, a torso and at least one limb chain.
      expect(container.querySelectorAll('circle').length, entry.name).toBeGreaterThan(0);
      expect(container.querySelectorAll('polyline').length, entry.name).toBeGreaterThan(0);
      cleanup();
    }
  });

  it('shows two positions for a movement and one for a hold', () => {
    const { container: move } = render(<ExerciseFormSvg name="Test" pattern="squat" patternLabel="Kniebeuge" />);
    expect(move.querySelectorAll('figure').length).toBe(2);
    cleanup();

    const { container: hold } = render(<ExerciseFormSvg name="Test" pattern="core-hold" patternLabel="Halten" />);
    expect(hold.querySelectorAll('figure').length).toBe(1);
  });

  it('names the positions rather than leaving them to be guessed', () => {
    render(<ExerciseFormSvg name="Test" pattern="hinge" patternLabel="Hüftbeuge" />);
    expect(screen.getByText('Aufgerichtet')).toBeTruthy();
    expect(screen.getByText('Hüfte nach hinten')).toBeTruthy();
  });

  it('describes itself for screen readers', () => {
    render(<ExerciseFormSvg name="Test" pattern="squat" patternLabel="Kniebeuge" />);
    expect(screen.getByRole('img', { name: /Kniebeuge/ })).toBeTruthy();
  });

});

describe('exercises that need their own picture get one', () => {
  const own = (name: string) => {
    const entry = findExercise(name)!;
    const pattern = guideFor(entry).pattern;
    return figureFor(name, pattern) !== figureFor('__nothing__', pattern);
  };

  it('does not put a push-up on a bench', () => {
    // The pattern is right for the cues and wrong for the picture: push-ups and
    // bench press share every coaching point and no body position at all.
    expect(own('Liegestütze')).toBe(true);
    expect(own('Knie-Liegestütze')).toBe(true);
    expect(own('Bankdrücken')).toBe(false);
  });

  it('separates a seated pulldown from hanging off a bar', () => {
    expect(own('Latziehen (weiter Griff)')).toBe(true);
    expect(own('Klimmzüge')).toBe(false);
  });

  it('separates a leg press from a barbell squat', () => {
    expect(own('Beinpresse')).toBe(true);
    expect(own('Kniebeugen')).toBe(false);
  });

  it('gives the exercises that look like nothing else their own figure', () => {
    for (const name of [
      'Pike Push-ups', 'Dips (Brust)', 'Australian Pull-ups', 'Sitzrudern (Kabel)',
      'Beinheben hängend', 'Step-ups', 'Kettlebell Swing', 'Nordic Curl',
      'Seitlicher Plank', 'Hollow Body Hold', 'Fahrrad mittel', 'Rudergerät',
      'Schwimmen', 'Skull Crushers', 'Brust-Presse Maschine',
    ]) {
      expect(own(name), name).toBe(true);
    }
  });

  it('leaves a side plank looking different from a plank', () => {
    const plank = figureFor('Plank', 'core-hold');
    const side = figureFor('Seitlicher Plank', 'core-hold');
    expect(JSON.stringify(plank)).not.toBe(JSON.stringify(side));
    // The raised free arm is what makes it readable side-on.
    expect(side?.start.joints.handB).toBeTruthy();
  });

  it('points the motion arrow along the joint that actually moved', () => {
    const { container } = render(
      <ExerciseFormSvg name="Kniebeugen" pattern="squat" patternLabel="Kniebeuge" />,
    );
    // Second panel only: the start position has nothing to point at yet.
    expect(container.querySelectorAll('marker').length).toBe(2);
    expect(container.querySelectorAll('path[marker-end]').length).toBe(1);
  });

  it('leaves a hold without an arrow, because nothing moves', () => {
    const { container } = render(
      <ExerciseFormSvg name="Plank" pattern="core-hold" patternLabel="Halten" />,
    );
    expect(container.querySelectorAll('path[marker-end]').length).toBe(0);
  });
});
