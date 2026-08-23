// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExerciseFormSvg } from '@/web/components/ExerciseFormSvg';
import { EXERCISES } from '@/domain/exerciseDatabase';
import { guideFor } from '@/domain/exerciseGuide';

describe('every exercise gets a form figure', () => {
  it('draws something for all 176 of them', () => {
    for (const entry of EXERCISES) {
      const guide = guideFor(entry);
      const { container } = render(
        <ExerciseFormSvg pattern={guide.pattern} patternLabel={guide.patternLabel} />,
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
    const { container: move } = render(<ExerciseFormSvg pattern="squat" patternLabel="Kniebeuge" />);
    expect(move.querySelectorAll('figure').length).toBe(2);
    cleanup();

    const { container: hold } = render(<ExerciseFormSvg pattern="core-hold" patternLabel="Halten" />);
    expect(hold.querySelectorAll('figure').length).toBe(1);
  });

  it('names the positions rather than leaving them to be guessed', () => {
    render(<ExerciseFormSvg pattern="hinge" patternLabel="Hüftbeuge" />);
    expect(screen.getByText('Aufgerichtet')).toBeTruthy();
    expect(screen.getByText('Hüfte nach hinten')).toBeTruthy();
  });

  it('describes itself for screen readers', () => {
    render(<ExerciseFormSvg pattern="squat" patternLabel="Kniebeuge" />);
    expect(screen.getByRole('img', { name: /Kniebeuge/ })).toBeTruthy();
  });
});
