import { describe, expect, it } from 'vitest';
import { buildDayStatus, buildHeadline, buildInsights, isDayInProgress, scoreDay, type CoachContext } from '@/domain/coach';
import { resolveTargets } from '@/domain/goalPhase';
import { summarizeWeight } from '@/domain/weightTrend';
import { GOALS_DEFAULTS } from '@/data/profile';

const targets = resolveTargets({
  ...GOALS_DEFAULTS,
  caloriesMin: 1900,
  caloriesMax: 2100,
  proteinMin: 130,
  proteinMax: 160,
  stepsGoal: 8000,
  waterGoalMl: 2500,
  sleepGoalH: 8,
  phaseType: 'cut',
});

function context(patch: Partial<CoachContext> = {}): CoachContext {
  return {
    today: '2026-08-21',
    hour: 15,
    targets,
    nutrition: { kcal: 1540, proteinG: 118, carbsG: 140, fatG: 45, quality: 'verified', entryCount: 3 },
    metrics: { steps: 6420, waterMl: 1750, sleepH: 8.3 },
    training: {
      trainedToday: false,
      hasActiveSession: false,
      lastWorkoutDate: '2026-08-20',
      lastWorkoutName: 'Push',
      fullWorkoutsThisWeek: 1,
      miniSessionsThisWeek: 0,
      plannedDayName: 'Push',
      weeklyTarget: 3,
    },
    soreness: null,
    weight: summarizeWeight([]),
    weekly: { avgKcal: 2060, avgProtein: 142, avgSteps: 7420, daysWithData: 5 },
    ...patch,
  };
}

describe('isDayInProgress', () => {
  it('treats the evening as the point where the day is judged', () => {
    expect(isDayInProgress(15)).toBe(true);
    expect(isDayInProgress(22)).toBe(false);
  });
});

describe('buildDayStatus (§8)', () => {
  it('returns exactly the six tracked dimensions', () => {
    const items = buildDayStatus(context());
    expect(items.map((i) => i.key)).toEqual(['calories', 'protein', 'steps', 'water', 'training', 'sleep']);
  });

  it('stays neutral on nutrition when nothing was logged', () => {
    const items = buildDayStatus(context({ nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, quality: 'verified', entryCount: 0 } }));
    expect(items.find((i) => i.key === 'calories')?.tone).toBe('neutral');
  });

  it('goes red only when clearly over the range', () => {
    const over = buildDayStatus(context({ nutrition: { ...context().nutrition, kcal: 2800 } }));
    expect(over.find((i) => i.key === 'calories')?.tone).toBe('red');
    const slightly = buildDayStatus(context({ nutrition: { ...context().nutrition, kcal: 2200 } }));
    expect(slightly.find((i) => i.key === 'calories')?.tone).toBe('yellow');
  });

  it('never marks high protein as a problem', () => {
    const items = buildDayStatus(context({ nutrition: { ...context().nutrition, proteinG: 200 } }));
    expect(items.find((i) => i.key === 'protein')?.tone).toBe('green');
  });
});

describe('buildHeadline — the tone rules (§6/§16/§32)', () => {
  it('says what is still missing on a normal day', () => {
    const text = buildHeadline(context());
    expect(text).toContain('Protein');
    expect(text).toMatch(/\d+ g Protein/);
  });

  it('relativises a heavy day against the week instead of scolding', () => {
    const text = buildHeadline(context({ nutrition: { ...context().nutrition, kcal: 2800 } }));
    expect(text).toContain('über deinem Zielbereich');
    expect(text).toContain('Wochen');
    // No blame, no compensation instruction.
    expect(text.toLowerCase()).not.toContain('versagt');
    expect(text.toLowerCase()).not.toContain('musst');
  });

  it('treats under-eating as a problem, not a win (§16)', () => {
    const text = buildHeadline(
      context({ hour: 22, nutrition: { ...context().nutrition, kcal: 1200, proteinG: 60 } }),
    );
    expect(text).toContain('deutlich unter');
    expect(text).toContain('sinnvoll');
  });

  it('invites a first entry when the day is empty', () => {
    const text = buildHeadline(
      context({
        nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, quality: 'verified', entryCount: 0 },
        metrics: { steps: 0, waterMl: 0, sleepH: 0 },
      }),
    );
    expect(text).toContain('Noch nichts eingetragen');
  });

  it('acknowledges a finished protein target', () => {
    const text = buildHeadline(context({ nutrition: { ...context().nutrition, kcal: 1500, proteinG: 150 } }));
    expect(text).toContain('Protein sitzt');
  });
});

describe('buildInsights', () => {
  it('sorts by priority so the most useful line is first', () => {
    const insights = buildInsights(context());
    const priorities = insights.map((i) => i.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  it('recommends recovery over training on strong soreness (§22)', () => {
    const insights = buildInsights(context({ soreness: 'strong' }));
    const top = insights[0];
    expect(top?.kind).toBe('recovery');
    expect(top?.text).toContain('Recovery');
  });

  it('still allows training on light soreness', () => {
    const insights = buildInsights(context({ soreness: 'light' }));
    const training = insights.find((i) => i.id === 'train-today');
    expect(training?.text).toContain('kein Grund zu pausieren');
  });

  it('prioritises resuming a running session above everything else', () => {
    const insights = buildInsights(context({ training: { ...context().training, hasActiveSession: true } }));
    expect(insights[0]?.id).toBe('session-running');
  });

  it('stops nagging once the weekly training target is met', () => {
    const insights = buildInsights(context({ training: { ...context().training, fullWorkoutsThisWeek: 3 } }));
    expect(insights.find((i) => i.id === 'train-today')).toBeUndefined();
    expect(insights.find((i) => i.id === 'week-target-hit')).toBeDefined();
  });

  it('reports the weekly calorie average as the meaningful figure (§58)', () => {
    const insight = buildInsights(context()).find((i) => i.id === 'weekly-kcal');
    expect(insight?.text).toContain('2.060');
    expect(insight?.text).toContain('im Zielbereich');
  });

  it('withholds a weekly claim when there is too little data', () => {
    const insights = buildInsights(context({ weekly: { avgKcal: 2060, avgProtein: 142, avgSteps: 7420, daysWithData: 2 } }));
    expect(insights.find((i) => i.id === 'weekly-kcal')).toBeUndefined();
  });

  it('offers to start tracking weight when there is no trend yet', () => {
    const insight = buildInsights(context()).find((i) => i.id === 'weight-none');
    expect(insight?.href).toBe('/progress');
  });
});

describe('scoreDay (§31)', () => {
  it('scores a strong day highly', () => {
    const result = scoreDay(
      context({
        hour: 22,
        nutrition: { kcal: 1980, proteinG: 148, carbsG: 180, fatG: 60, quality: 'verified', entryCount: 4 },
        metrics: { steps: 8240, waterMl: 2400, sleepH: 8.2 },
        training: { ...context().training, trainedToday: true },
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('never shames a weak day', () => {
    const result = scoreDay(
      context({
        hour: 22,
        nutrition: { kcal: 3200, proteinG: 40, carbsG: 300, fatG: 140, quality: 'verified', entryCount: 2 },
        metrics: { steps: 900, waterMl: 200, sleepH: 5 },
      }),
    );
    expect(result.score).toBeLessThan(6);
    // The message must stay factual — no blame, and always the weekly frame.
    expect(result.summary).toContain('Woche');
    expect(result.summary.toLowerCase()).not.toMatch(/versag|schlecht|diszipl/);
  });

  it('keeps the score inside 0–10', () => {
    const result = scoreDay(context());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});
