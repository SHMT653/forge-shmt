'use client';

import Link from 'next/link';
import { ArrowRight, Camera, Dumbbell, Footprints, GlassWater, Play, Plus, Sparkles } from 'lucide-react';
import { buildNextMove, type NextMoveActionKind } from '@/domain/nextMove';
import type { TodayData } from '@/web/hooks/useTodayData';

type NextMoveCardProps = {
  data: TodayData;
  onOpenEntry: () => void;
  onStartWorkout: () => void;
  onStartMini: () => void;
};

const ACTION_ICON: Record<NextMoveActionKind, typeof Sparkles> = {
  'resume-workout': Play,
  'start-workout': Dumbbell,
  'mini-session': Sparkles,
  progress: Camera,
  entry: Plus,
  cardio: Footprints,
  nutrition: ArrowRight,
  none: Sparkles,
}

const ACTION_HREF: Partial<Record<NextMoveActionKind, string>> = {
  progress: '/progress',
  cardio: '/cardio',
  nutrition: '/nutrition',
}

export function NextMoveCard({ data, onOpenEntry, onStartWorkout, onStartMini }: NextMoveCardProps) {
  const move = buildNextMove({
    ctx: data.dayContext,
    readiness: data.readiness,
    dayScore: data.dayScore,
    dayStatus: data.dayStatus,
    weighInDue: data.weighInDue,
    photoDue: data.photoDue,
    activeSessionId: data.activeSession?.id ?? null,
  });

  return (
    <section className={`panel next-move tone-${move.tone}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <p className="section-label">Next Move</p>
          <p className="h2" style={{ marginTop: 5, fontSize: 18 }}>{move.title}</p>
          <p className="copy" style={{ marginTop: 6, fontSize: 13.5 }}>{move.detail}</p>
        </div>
        <span className="next-move-orb">
          <Sparkles size={18} />
        </span>
      </div>

      <div className="pill-row" style={{ marginTop: 14 }}>
        {move.chips.map((chip) => (
          <span key={chip} className="pill">{chip}</span>
        ))}
      </div>

      <div className="button-row" style={{ marginTop: 14 }}>
        <MoveAction action={move.primary.kind} label={move.primary.label}
          data={data} onOpenEntry={onOpenEntry} onStartWorkout={onStartWorkout} onStartMini={onStartMini} primary />
        {move.secondary && (
          <MoveAction action={move.secondary.kind} label={move.secondary.label}
            data={data} onOpenEntry={onOpenEntry} onStartWorkout={onStartWorkout} onStartMini={onStartMini} />
        )}
      </div>
    </section>
  );
}

function MoveAction({
  action,
  label,
  data,
  onOpenEntry,
  onStartWorkout,
  onStartMini,
  primary = false,
}: {
  action: NextMoveActionKind;
  label: string;
  data: TodayData;
  onOpenEntry: () => void;
  onStartWorkout: () => void;
  onStartMini: () => void;
  primary?: boolean;
}) {
  const Icon = ACTION_ICON[action];
  const className = `button compact${primary ? '' : ' secondary'}`;
  const href = action === 'resume-workout' && data.activeSession
    ? `/workout/${data.activeSession.id}`
    : ACTION_HREF[action];

  if (href) {
    return (
      <Link href={href} prefetch={false} className={className} style={{ flex: 1 }}>
        <Icon size={15} /> {label}
      </Link>
    );
  }

  const handler =
    action === 'start-workout' ? onStartWorkout
    : action === 'mini-session' ? onStartMini
    : onOpenEntry;

  return (
    <button type="button" className={className} style={{ flex: 1 }} onClick={handler}>
      {action === 'entry' && label.toLowerCase().includes('wasser') ? <GlassWater size={15} /> : <Icon size={15} />}
      {label}
    </button>
  );
}
