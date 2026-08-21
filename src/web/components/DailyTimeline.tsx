'use client';

import { Copy, Trash2, Star } from 'lucide-react';
import { formatKcalRange, MEAL_SLOT_ICON } from '@/domain/nutritionMath';
import type { MealEntry } from '@/data/nutrition';

export type TimelineEvent = {
  id: string;
  /** ISO timestamp — used for ordering and the time label. */
  at: string;
  icon: string;
  title: string;
  meta: string;
  tone?: string;
  quality?: 'verified' | 'estimated' | 'unknown';
  onDelete?: () => void;
  onDuplicate?: () => void;
  onFavorite?: () => void;
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Chronological log of the day — meals, training, everything (§9). */
export function DailyTimeline({ events }: { events: readonly TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p className="copy" style={{ margin: 0 }}>Noch nichts eingetragen heute.</p>
        <p className="muted-sm">Alles, was du einträgst, erscheint hier chronologisch.</p>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="timeline">
      {sorted.map((event) => (
        <div key={event.id} className="timeline-item">
          <span className="timeline-time">{timeLabel(event.at)}</span>
          <span className="timeline-marker" style={event.tone ? { background: event.tone } : undefined} aria-hidden />
          <div className="timeline-body">
            <p className="timeline-title">
              <span aria-hidden>{event.icon} </span>
              {event.title}
              {event.quality === 'estimated' && <span className="quality-badge estimated" style={{ marginLeft: 6 }}>geschätzt</span>}
              {event.quality === 'unknown' && <span className="quality-badge unknown" style={{ marginLeft: 6 }}>unklar</span>}
            </p>
            <p className="timeline-meta">{event.meta}</p>
          </div>
          <div className="timeline-actions">
            {event.onFavorite && (
              <button type="button" className="icon-button" onClick={event.onFavorite} aria-label="Als Favorit speichern">
                <Star size={15} />
              </button>
            )}
            {event.onDuplicate && (
              <button type="button" className="icon-button" onClick={event.onDuplicate} aria-label="Duplizieren">
                <Copy size={15} />
              </button>
            )}
            {event.onDelete && (
              <button type="button" className="icon-button danger" onClick={event.onDelete} aria-label="Löschen">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Turns a meal entry into a timeline event. */
export function mealToEvent(
  entry: MealEntry,
  handlers: { onDelete?: () => void; onDuplicate?: () => void; onFavorite?: () => void } = {},
): TimelineEvent {
  const kcalText =
    entry.dataQuality === 'verified'
      ? `${Math.round(entry.kcal).toLocaleString('de-DE')} kcal`
      : formatKcalRange(entry.kcalMin, entry.kcalMax, entry.kcal);

  return {
    id: entry.id,
    at: entry.loggedAt,
    icon: entry.slot ? MEAL_SLOT_ICON[entry.slot] : '🍽️',
    title: entry.name,
    meta: `${kcalText} · ${Math.round(entry.proteinG)} g Protein`,
    quality: entry.dataQuality,
    ...handlers,
  };
}
