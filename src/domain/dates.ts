/** Local-date helpers. We always key daily records by a "YYYY-MM-DD" string in local time. */

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function dateKeyAddDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

export function formatRelativeDay(key: string): string {
  const today = todayKey();
  if (key === today) return 'Heute';
  if (key === dateKeyAddDays(today, -1)) return 'Gestern';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} Std ${minutes} Min`;
  return `${minutes} Min`;
}

export function formatFullDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Whether a workout started at `startedAt` can still plausibly be running.
 *
 * An unfinished session used to count as active forever, so one abandoned
 * workout left "Tag 1 — läuft" and a "Weiter" button on the dashboard for the
 * rest of time. Nobody trains for twelve hours; past that the session was
 * abandoned, whether or not it was abandoned on purpose.
 */
export function isSessionStillRunning(startedAt: string, now = new Date()): boolean {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return false;
  const hours = (now.getTime() - started) / 3_600_000;
  return hours >= 0 && hours < 12;
}
