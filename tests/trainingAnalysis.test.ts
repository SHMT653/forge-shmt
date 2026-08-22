import { describe, expect, it } from 'vitest';
import {
  analyseMuscleLoad, regionBalance, suggestNextFocus, trainingInsights, type SessionSummary,
} from '@/domain/trainingAnalysis';

function session(date: string, exercises: [string, number][]): SessionSummary {
  return { date, exercises: exercises.map(([name, completedSets]) => ({ name, completedSets })) };
}

const TODAY = '2026-08-22';

describe('analyseMuscleLoad', () => {
  it('counts the primary muscle fully and assisting ones at a discount', () => {
    // Bankdrücken is chest primary, front-delt and triceps assisting.
    const loads = analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 4]])], TODAY);
    const chest = loads.find((l) => l.muscle === 'chest');
    const triceps = loads.find((l) => l.muscle === 'triceps');
    expect(chest?.sets).toBe(4);
    expect(triceps?.sets).toBeLessThan(4);
    expect(triceps?.sets).toBeGreaterThan(0);
  });

  it('adds volume across sessions', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-18', [['Bankdrücken', 4]]), session('2026-08-21', [['Liegestütze', 3]])],
      TODAY,
    );
    expect(loads.find((l) => l.muscle === 'chest')?.sets).toBe(7);
  });

  it('ignores exercises with no completed sets', () => {
    const loads = analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 0]])], TODAY);
    expect(loads).toEqual([]);
  });

  it('tracks how long ago each muscle was trained', () => {
    const loads = analyseMuscleLoad([session('2026-08-15', [['Bankdrücken', 3]])], TODAY);
    expect(loads.find((l) => l.muscle === 'chest')?.daysSince).toBe(7);
  });

  it('uses the most recent session for recency, not the first', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-10', [['Bankdrücken', 3]]), session('2026-08-21', [['Bankdrücken', 3]])],
      TODAY,
    );
    expect(loads.find((l) => l.muscle === 'chest')?.daysSince).toBe(1);
  });

  it('flags too little and too much volume', () => {
    const low = analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 2]])], TODAY);
    expect(low.find((l) => l.muscle === 'chest')?.status).toBe('low');

    const high = analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 30]])], TODAY);
    expect(high.find((l) => l.muscle === 'chest')?.status).toBe('high');
  });

  it('calls a normal week good', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-18', [['Bankdrücken', 4]]), session('2026-08-21', [['Schrägbankdrücken', 4]])],
      TODAY,
    );
    expect(loads.find((l) => l.muscle === 'chest')?.status).toBe('good');
  });

  it('skips exercises it does not know rather than guessing', () => {
    expect(analyseMuscleLoad([session('2026-08-20', [['Irgendwas Erfundenes', 5]])], TODAY)).toEqual([]);
  });
});

describe('regionBalance', () => {
  it('splits volume into shares that add up', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-20', [['Bankdrücken', 4], ['Klimmzüge', 4], ['Kniebeugen', 4]])],
      TODAY,
    );
    const balance = regionBalance(loads);
    const total = balance.reduce((sum, b) => sum + b.share, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThanOrEqual(101);
  });

  it('always reports all four regions, even at zero', () => {
    const balance = regionBalance(analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 4]])], TODAY));
    expect(balance.map((b) => b.region)).toEqual(['push', 'pull', 'legs', 'core']);
    expect(balance.find((b) => b.region === 'legs')?.sets).toBe(0);
  });
});

describe('trainingInsights', () => {
  it('refuses to judge a plan from too few sessions', () => {
    const loads = analyseMuscleLoad([session('2026-08-20', [['Bankdrücken', 4]])], TODAY);
    const insights = trainingInsights(loads, regionBalance(loads), 1);
    expect(insights[0]?.id).toBe('too-little-data');
    expect(insights).toHaveLength(1);
  });

  it('spots a push-heavy week', () => {
    const loads = analyseMuscleLoad(
      [
        session('2026-08-18', [['Bankdrücken', 5], ['Schrägbankdrücken', 5]]),
        session('2026-08-20', [['Liegestütze', 5], ['Dips (Brust)', 4]]),
      ],
      TODAY,
    );
    const insights = trainingInsights(loads, regionBalance(loads), 2);
    expect(insights.some((i) => i.id === 'push-heavy')).toBe(true);
  });

  it('warns about excessive volume rather than praising it', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-18', [['Bankdrücken', 15]]), session('2026-08-20', [['Liegestütze', 15]])],
      TODAY,
    );
    const insights = trainingInsights(loads, regionBalance(loads), 2);
    const warn = insights.find((i) => i.id === 'high-volume');
    expect(warn?.severity).toBe('warn');
    expect(warn?.text).toContain('Regeneration');
  });

  it('mentions neglected legs without being prescriptive about it', () => {
    const loads = analyseMuscleLoad(
      [
        session('2026-08-18', [['Bankdrücken', 5], ['Klimmzüge', 5]]),
        session('2026-08-20', [['Schrägbankdrücken', 4], ['Latziehen (weiter Griff)', 4]]),
      ],
      TODAY,
    );
    const insights = trainingInsights(loads, regionBalance(loads), 2);
    const legs = insights.find((i) => i.id === 'legs-light');
    expect(legs?.text).toContain('Wenn das Absicht ist');
  });

  it('says so plainly when nothing is wrong', () => {
    const loads = analyseMuscleLoad(
      [
        session('2026-08-17', [['Bankdrücken', 4], ['Klimmzüge', 4], ['Kniebeugen', 4]]),
        session('2026-08-20', [['Schrägbankdrücken', 4], ['Langhantelrudern', 4], ['Beinpresse', 4]]),
      ],
      TODAY,
    );
    const insights = trainingInsights(loads, regionBalance(loads), 2);
    expect(insights.some((i) => i.severity === 'warn')).toBe(false);
  });
});

describe('suggestNextFocus', () => {
  it('points at the region that has been waiting longest', () => {
    const loads = analyseMuscleLoad(
      [session('2026-08-21', [['Bankdrücken', 5]]), session('2026-08-08', [['Kniebeugen', 4]])],
      TODAY,
    );
    expect(suggestNextFocus(loads, null)?.region).toBe('legs');
  });

  it('recommends recovery first on heavy soreness', () => {
    const loads = analyseMuscleLoad([session('2026-08-21', [['Bankdrücken', 5]])], TODAY);
    expect(suggestNextFocus(loads, 'strong')?.reason).toContain('Bewegung');
  });

  it('returns nothing without any history', () => {
    expect(suggestNextFocus([], null)).toBeNull();
  });
});
