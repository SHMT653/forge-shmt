import type { DayContext, DayScore, DayStatusItem } from './dayEvaluation';
import type { Readiness } from './trainingReadiness';

export type NextMoveActionKind =
  | 'resume-workout'
  | 'start-workout'
  | 'mini-session'
  | 'progress'
  | 'entry'
  | 'cardio'
  | 'nutrition'
  | 'none';

export type NextMove = {
  tone: 'violet' | 'teal' | 'gold' | 'danger' | 'muted';
  title: string;
  detail: string;
  primary: { kind: NextMoveActionKind; label: string };
  secondary?: { kind: NextMoveActionKind; label: string } | undefined;
  chips: string[];
};

export type NextMoveInput = {
  ctx: DayContext;
  readiness: Readiness;
  dayScore: DayScore;
  dayStatus: readonly DayStatusItem[];
  weighInDue: boolean;
  photoDue: boolean;
  activeSessionId: string | null;
};

function statusTone(items: readonly DayStatusItem[], key: DayStatusItem['key']): DayStatusItem['tone'] | null {
  return items.find((item) => item.key === key)?.tone ?? null;
}

function pct(value: number, target: number): number {
  if (target <= 0) return 1;
  return value / target;
}

export function buildNextMove(input: NextMoveInput): NextMove {
  const { ctx, readiness, dayScore, dayStatus, weighInDue, photoDue, activeSessionId } = input;
  const hour = ctx.hour;
  const proteinShare = pct(ctx.nutrition.proteinG, ctx.targets.protein.min);
  const waterShare = pct(ctx.metrics.waterMl, ctx.targets.waterMl);
  const stepsShare = pct(ctx.metrics.steps, ctx.targets.steps);
  const chips = [
    `${Math.round(dayScore.score * 10) / 10}/10`,
    `${ctx.training.fullWorkoutsThisWeek}/${ctx.training.weeklyTarget} Training`,
    `${Math.round(proteinShare * 100)}% Protein`,
  ];

  if (readiness.state === 'running' && activeSessionId) {
    return {
      tone: 'violet',
      title: 'Nicht offen liegen lassen',
      detail: 'Ein begonnenes Training zählt erst richtig, wenn du es sauber beendest oder bewusst abbrichst.',
      primary: { kind: 'resume-workout', label: 'Weiter trainieren' },
      chips: ['läuft', ...chips.slice(1)],
    };
  }

  if (readiness.state === 'rest') {
    return {
      tone: 'gold',
      title: 'Recovery ist heute der Plan',
      detail: readiness.preferMini
        ? 'Muskelkater ist ein Signal, kein Hindernis. Kurz bewegen, Protein treffen, Schlaf priorisieren.'
        : 'Heute holt dein Körper Anpassung nach. Halte Ernährung und Schritte ruhig stabil.',
      primary: readiness.offerStart
        ? { kind: 'mini-session', label: 'Kurz bewegen' }
        : { kind: 'nutrition', label: 'Recovery sichern' },
      secondary: weighInDue || photoDue ? { kind: 'progress', label: 'Check-in' } : undefined,
      chips: ['Recovery', ...chips],
    };
  }

  if (readiness.offerStart && (readiness.state === 'mandatory' || readiness.state === 'due')) {
    return {
      tone: readiness.state === 'mandatory' ? 'danger' : 'violet',
      title: readiness.state === 'mandatory' ? 'Heute zählt wirklich' : 'Trainingsfenster nutzen',
      detail: readiness.preferMini
        ? 'Die Woche braucht Bewegung, aber dein Körper meldet Last. Mini zuerst ist die bessere Wette.'
        : `${readiness.headline}. Erst Training, danach wirkt der restliche Tag leichter.`,
      primary: { kind: readiness.preferMini ? 'mini-session' : 'start-workout', label: readiness.preferMini ? 'Mini starten' : 'Einheit starten' },
      secondary: readiness.preferMini ? { kind: 'start-workout', label: 'Voll trainieren' } : { kind: 'entry', label: 'Pre-Workout loggen' },
      chips,
    };
  }

  if (weighInDue || photoDue) {
    return {
      tone: 'teal',
      title: 'Progress zuerst festhalten',
      detail: weighInDue && photoDue
        ? 'Gewicht und Bilder sind dran. Erst messen, dann trainieren oder essen tracken.'
        : weighInDue
          ? 'Der Wochenwert ist heute fällig. Eine Messung reicht, Trends machen den Rest.'
          : 'Foto-Tag. Gleiche Pose, gleiches Licht, dann wieder raus aus dem Kopf.',
      primary: { kind: 'progress', label: 'Progress öffnen' },
      secondary: readiness.offerStart ? { kind: readiness.preferMini ? 'mini-session' : 'start-workout', label: readiness.preferMini ? 'Mini danach' : 'Training danach' } : undefined,
      chips: [weighInDue ? 'Wiegen' : 'Fotos', ...chips],
    };
  }

  if (proteinShare < 0.72 && hour >= 12) {
    return {
      tone: 'teal',
      title: 'Protein-Lücke schließen',
      detail: `Du bist bei ${Math.round(ctx.nutrition.proteinG)} g von ${ctx.targets.protein.min} g. Jetzt proteinreich essen macht den Abend entspannter.`,
      primary: { kind: 'entry', label: 'Essen eintragen' },
      secondary: { kind: 'nutrition', label: 'Ernährung öffnen' },
      chips,
    };
  }

  if (waterShare < 0.55 && hour >= 13) {
    return {
      tone: 'teal',
      title: 'Hydration nachziehen',
      detail: 'Wasser ist gerade der billigste Performance-Hebel. Ein Glas jetzt, eins später.',
      primary: { kind: 'entry', label: 'Wasser loggen' },
      chips: [`${Math.round(waterShare * 100)}% Wasser`, ...chips],
    };
  }

  if (stepsShare < 0.65 && hour >= 16 && statusTone(dayStatus, 'steps') !== 'green') {
    return {
      tone: 'gold',
      title: 'Schritte retten den Tag',
      detail: `${Math.round(ctx.metrics.steps).toLocaleString('de-DE')} Schritte stehen. 15 bis 25 Minuten gehen reichen oft, damit der Score kippt.`,
      primary: { kind: 'cardio', label: 'Cardio öffnen' },
      secondary: { kind: 'entry', label: 'Schritte loggen' },
      chips: [`${Math.round(stepsShare * 100)}% Schritte`, ...chips],
    };
  }

  if (readiness.offerStart && readiness.state === 'optional') {
    return {
      tone: 'muted',
      title: 'Bonus, kein Muss',
      detail: 'Das Wochenziel steht. Eine Einheit ist möglich, aber heute musst du nichts erzwingen.',
      primary: { kind: 'mini-session', label: 'Mini als Bonus' },
      secondary: { kind: 'entry', label: 'Tag pflegen' },
      chips,
    };
  }

  return {
    tone: dayScore.score >= 7.5 ? 'teal' : 'muted',
    title: dayScore.score >= 7.5 ? 'Sauber landen' : 'Kleinsten Hebel wählen',
    detail: dayScore.summary,
    primary: { kind: 'entry', label: 'Etwas eintragen' },
    secondary: { kind: 'nutrition', label: 'Details prüfen' },
    chips,
  };
}
