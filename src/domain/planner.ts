import type { NeoFreeSlot } from '@/services/neo/types';

// ─── Constants ──────────────────────────────────────────────────────────────

export const PLANNER_CONFIG = {
  earliestTime:      '15:30',
  latestTime:        '21:00',
  durationMinutes:   75,
  bufferMinutes:     15,
  preferredStart:    '17:00',
  preferredEnd:      '19:00',
  timezone:          'Europe/Berlin',
} as const;

// ─── Time helpers (HH:MM strings, no Date objects needed) ───────────────────

/** Convert "HH:MM" to total minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Convert total minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Duration of a slot in minutes */
export function slotDurationMinutes(slot: NeoFreeSlot): number {
  return timeToMinutes(slot.end) - timeToMinutes(slot.start);
}

/** Trim a slot so only the first `durationMinutes` are used */
export function trimSlot(slot: NeoFreeSlot, durationMinutes: number): { start: string; end: string } {
  const start = slot.start;
  const end   = minutesToTime(timeToMinutes(slot.start) + durationMinutes);
  return { start, end };
}

// ─── Slot selection ──────────────────────────────────────────────────────────

/**
 * Pick the best free slot for a workout.
 *
 * Priority:
 * 1. A slot that starts between preferredStart and preferredEnd (e.g. 17:00–19:00)
 * 2. The earliest remaining slot that fits the duration
 * 3. null if nothing fits
 */
export function selectBestSlot(slots: NeoFreeSlot[], durationMinutes: number): NeoFreeSlot | null {
  // Keep only slots long enough for the workout
  const valid = slots.filter((s) => slotDurationMinutes(s) >= durationMinutes);
  if (valid.length === 0) return null;

  // Prefer the preferred time window (start falls within it)
  const prefStart = timeToMinutes(PLANNER_CONFIG.preferredStart);
  const prefEnd   = timeToMinutes(PLANNER_CONFIG.preferredEnd);
  const preferred = valid.filter((s) => {
    const start = timeToMinutes(s.start);
    return start >= prefStart && start <= prefEnd;
  });

  // Within preferred window: pick earliest
  if (preferred.length > 0) {
    return preferred.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0]!;
  }

  // Fallback: earliest overall (avoid planning too late)
  return valid.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0]!;
}

// ─── Week / rotation logic ────────────────────────────────────────────────────

export type PlanDaySummary = { id: string; name: string };

/**
 * Determine which plan day to schedule today.
 *
 * Simple round-robin: (completedSessionsForPlan % totalDays) gives next index.
 * A training day is needed every day the plan has days; the caller decides
 * whether to skip weekends or rest days (Forge doesn't enforce this yet).
 */
export function getTodaysPlanDay(days: PlanDaySummary[], completedCount: number): PlanDaySummary | null {
  if (days.length === 0) return null;
  return days[completedCount % days.length]!;
}

// ─── Status type ─────────────────────────────────────────────────────────────

export type PlannerStatus =
  | { status: 'scheduled'; slot: { start: string; end: string }; neoEventId: string }
  | { status: 'updated';   slot: { start: string; end: string }; neoEventId: string }
  | { status: 'no_slot' }
  | { status: 'no_plan' }
  | { status: 'error';     message: string };

// ─── Logging helpers ──────────────────────────────────────────────────────────

export type PlannerLog = { level: 'info' | 'warn' | 'error'; message: string; data?: unknown };

export function makeLogger(logs: PlannerLog[]) {
  return {
    info:  (message: string, data?: unknown) => { logs.push({ level: 'info',  message, data }); console.log(`[planner] ${message}`, data ?? ''); },
    warn:  (message: string, data?: unknown) => { logs.push({ level: 'warn',  message, data }); console.warn(`[planner] ${message}`, data ?? ''); },
    error: (message: string, data?: unknown) => { logs.push({ level: 'error', message, data }); console.error(`[planner] ${message}`, data ?? ''); },
  };
}
