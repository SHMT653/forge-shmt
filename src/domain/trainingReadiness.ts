import { dateKeyAddDays } from './dates';
import type { Soreness } from './types';

/**
 * Whether today is a good day to train, and why.
 *
 * The point is that "train today" is not a guess. Two things decide it:
 *
 *  1. How much slack the week still has. With three sessions to go and three
 *     days left, every remaining day is a training day and there is no rest day
 *     to spend. With three to go and six days left there are three rest days
 *     available, so soreness gets to win the argument.
 *  2. What the body has been reporting. Strong soreness today is a rest day
 *     regardless. Several days of medium-to-strong soreness in a row means the
 *     load has outrun recovery, and one light day does not undo that — so the
 *     recommendation drops to a short session rather than jumping straight back
 *     to a full one.
 *
 * Everything here is arithmetic over data FORGE already holds, and the reason
 * is returned alongside the verdict so the screen can show the maths instead of
 * an unexplained nudge.
 */

export type ReadinessState =
  | 'running'      // a session is open right now
  | 'done-today'   // already trained
  | 'rest'         // recovery is the better call
  | 'optional'     // weekly target met; anything more is bonus
  | 'due'          // a good day, and the week needs it
  | 'mandatory';   // no rest day left if the target is to hold

export type Readiness = {
  state: ReadinessState;
  headline: string;
  /** The reasoning, in one sentence. */
  detail: string;
  /** Whether to offer the start button prominently. */
  offerStart: boolean;
  /** A short session is the better fit today. */
  preferMini: boolean;
  /** Rest days still affordable this week. Negative means the target is out of reach. */
  slack: number;
  daysSinceLast: number | null;
};

export type ReadinessInput = {
  today: string;
  /** Inclusive week end, as a date key. */
  weekEnd: string;
  fullWorkoutsThisWeek: number;
  miniSessionsThisWeek: number;
  weeklyTarget: number;
  lastWorkoutDate: string | null;
  trainedToday: boolean;
  hasActiveSession: boolean;
  /** One entry per recorded day, any order. */
  sorenessHistory: readonly { date: string; soreness: Soreness | null }[];
  plannedDayName: string | null;
};

/** Whole days between two date keys, positive when `to` is later. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Days of medium-or-worse soreness running back from yesterday, unbroken.
 *
 * Counted from yesterday rather than today, because today's answer is judged on
 * its own; this is about what came before it. A day with nothing recorded ends
 * the streak — an absent answer is not evidence of soreness.
 */
export function sorenessStreak(
  history: readonly { date: string; soreness: Soreness | null }[],
  today: string,
): number {
  const byDate = new Map(history.map((entry) => [entry.date, entry.soreness]));
  let streak = 0;
  for (let back = 1; back <= 14; back += 1) {
    const level = byDate.get(dateKeyAddDays(today, -back));
    if (level === 'medium' || level === 'strong') streak += 1;
    else break;
  }
  return streak;
}

export function assessReadiness(input: ReadinessInput): Readiness {
  const daysSinceLast = input.lastWorkoutDate ? daysBetween(input.lastWorkoutDate, input.today) : null;
  const daysLeft = Math.max(1, daysBetween(input.today, input.weekEnd) + 1);
  const remaining = Math.max(0, input.weeklyTarget - input.fullWorkoutsThisWeek);
  const slack = daysLeft - remaining;

  const todaySoreness = input.sorenessHistory.find((e) => e.date === input.today)?.soreness ?? null;
  const streak = sorenessStreak(input.sorenessHistory, input.today);

  const base = { slack, daysSinceLast };

  if (input.hasActiveSession) {
    return {
      ...base, state: 'running', offerStart: false, preferMini: false,
      headline: 'Dein Training läuft',
      detail: 'Du kannst da weitermachen, wo du aufgehört hast.',
    };
  }

  if (input.trainedToday) {
    return {
      ...base, state: 'done-today', offerStart: false, preferMini: false,
      headline: 'Heute erledigt',
      detail: `${input.fullWorkoutsThisWeek} von ${input.weeklyTarget} Einheiten diese Woche. Jetzt zählen Protein und Schlaf.`,
    };
  }

  // Strong soreness is a rest day whatever the week looks like. Training
  // through it costs more days than it buys (§22).
  if (todaySoreness === 'strong') {
    return {
      ...base, state: 'rest', offerStart: false, preferMini: true,
      headline: 'Heute besser Recovery',
      detail: slack > 0
        ? `Starker Muskelkater, und die Woche hat noch ${slack} ${slack === 1 ? 'Ruhetag' : 'Ruhetage'} Luft. Spazieren oder Mobility.`
        : 'Starker Muskelkater. Das Wochenziel ist knapp — eine Mini-Session ist heute die bessere Wette als eine harte Einheit.',
    };
  }

  // Recovery does not reset on Monday. If the last full session was yesterday
  // and the body reports soreness today, the next hard session waits even when
  // the weekly counter just rolled over.
  if (daysSinceLast === 1 && todaySoreness === 'medium') {
    return {
      ...base, state: 'rest', offerStart: false, preferMini: true,
      headline: 'Heute Recovery statt Training',
      detail: 'Gestern trainiert und heute Muskelkater. Schlaf, Protein, Schritte und Mobility bringen heute mehr als die nächste harte Einheit.',
    };
  }

  if (daysSinceLast === 1 && todaySoreness === 'light' && slack > 0) {
    return {
      ...base, state: 'rest', offerStart: true, preferMini: true,
      headline: 'Locker bleiben',
      detail: `Gestern trainiert, heute leichter Muskelkater. Wenn du etwas machst, dann kurz — die Woche hat noch ${slack} ${slack === 1 ? 'Ruhetag' : 'Ruhetage'} Luft.`,
    };
  }

  // Sustained soreness: the load has outrun recovery, and one light day does
  // not settle that. Only overruled when the week has no slack left.
  if (streak >= 3 && slack > 0) {
    return {
      ...base, state: 'rest', offerStart: true, preferMini: true,
      headline: 'Lieber kurz halten',
      detail: `${streak} Tage in Folge mit deutlichem Muskelkater. Heute eine Mini-Session — die Woche hat noch ${slack} ${slack === 1 ? 'Tag' : 'Tage'} Luft.`,
    };
  }

  if (remaining === 0) {
    return {
      ...base, state: 'optional', offerStart: true, preferMini: false,
      headline: 'Wochenziel steht',
      detail: `${input.fullWorkoutsThisWeek} von ${input.weeklyTarget} Einheiten. Alles Weitere ist Bonus, kein Muss.`,
    };
  }

  // No rest day left: every remaining day has to carry a session.
  if (slack <= 0) {
    return {
      ...base, state: 'mandatory', offerStart: true, preferMini: todaySoreness === 'medium',
      headline: input.plannedDayName ? `Heute: ${input.plannedDayName}` : 'Heute ist Trainingstag',
      // slack <= 0 means remaining >= daysLeft, so there are only two honest
      // cases here: exactly enough days left, or already too few.
      detail: slack === 0
        ? `Noch ${remaining} ${remaining === 1 ? 'Einheit' : 'Einheiten'} bei ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'} — kein Ruhetag mehr drin, heute zählt.`
        : `Noch ${remaining} Einheiten bei ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'}: das Wochenziel wird nicht mehr voll. Nimm mit, was geht — die nächste Woche zählt genauso.`,
    };
  }

  const restNote =
    daysSinceLast === null ? 'Noch kein Training aufgezeichnet.'
    : daysSinceLast === 0 ? 'Letzte Einheit war heute.'
    : daysSinceLast === 1 ? 'Ein Tag Pause liegt hinter dir.'
    : `${daysSinceLast} Tage Pause liegen hinter dir.`;

  return {
    ...base,
    state: 'due',
    offerStart: true,
    preferMini: todaySoreness === 'medium',
    headline: input.plannedDayName ? `Guter Tag für ${input.plannedDayName}` : 'Guter Tag zum Trainieren',
    detail: `${restNote} Noch ${remaining} von ${input.weeklyTarget} Einheiten, ${slack} ${slack === 1 ? 'Ruhetag' : 'Ruhetage'} Puffer.`,
  };
}
