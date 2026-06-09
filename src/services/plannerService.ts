/**
 * plannerService.ts
 *
 * Orchestrates the daily training planning for a single user:
 * 1. Look up active plan + today's rotation day
 * 2. Get free slots from Neo (date, duration, buffer)
 * 3. Try each slot via PATCH /by-source — skip on 409 collision
 * 4. Persist the result in forge_planned_sessions
 */

import { getActivePlanForUser, getOrInitSourceId, getPlannedSession, upsertPlannedSession } from '@/data/plannedSessions';
import { patchNeoEventBySource, getFreeSlotsFromNeo } from '@/services/neo/client';
import {
  PLANNER_CONFIG,
  addMinutesToISO,
  getTodaysPlanDay,
  makeLogger,
  minutesToTime,
  selectBestSlot,
  timeToMinutes,
  type PlannerLog,
  type PlannerStatus,
} from '@/domain/planner';

/** Returns today's date in YYYY-MM-DD in Europe/Berlin timezone */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PLANNER_CONFIG.timezone }).format(new Date());
}

/** Format a UTC ISO string as Berlin local "HH:MM" for display / storage */
function isoToBerlinTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: PLANNER_CONFIG.timezone,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(iso));
}

export type PlannerResult = {
  userId:  string;
  date:    string;
  status:  PlannerStatus;
  logs:    PlannerLog[];
};

export async function runPlannerForUser(userId: string, date: string): Promise<PlannerResult> {
  const logs: PlannerLog[] = [];
  const log = makeLogger(logs);

  log.info('Daily planner started', { userId, date });

  try {
    // ── 1. Get active plan ────────────────────────────────────────────────────
    const activePlan = await getActivePlanForUser(userId);
    if (!activePlan || activePlan.days.length === 0) {
      log.warn('No active plan found — skipping');
      return { userId, date, status: { status: 'no_plan' }, logs };
    }
    log.info('Active plan', { planId: activePlan.planId, planName: activePlan.planName });

    // ── 2. Determine today's plan day (round-robin) ────────────────────────────
    const todayDay = getTodaysPlanDay(activePlan.days, activePlan.completedSessionCount);
    if (!todayDay) {
      log.warn('No plan day resolved — skipping');
      return { userId, date, status: { status: 'no_plan' }, logs };
    }
    log.info("Today's plan day", { dayId: todayDay.id, dayName: todayDay.name });

    const trainingTitle = `Training – ${todayDay.name}`;

    // ── 3. Get stable source_id (forge_planned_sessions row id) ───────────────
    const sourceId = await getOrInitSourceId(userId, date, {
      planDayId:   todayDay.id,
      planDayName: todayDay.name,
      planName:    activePlan.planName,
    });
    log.info('Source ID for Neo', { sourceId });

    // ── 4. Check if already correctly scheduled ────────────────────────────────
    const existing = await getPlannedSession(userId, date);
    if (existing?.status === 'scheduled' && existing.plannedStart && existing.neoEventId) {
      log.info('Already scheduled — checking if slot is still valid');
      // The cron will still run to handle reschedules if needed.
      // Fall through to fetch free slots and verify.
    }

    // ── 5. Fetch free slots from Neo ───────────────────────────────────────────
    log.info('Fetching Neo free slots', {
      duration: PLANNER_CONFIG.durationMinutes,
      buffer:   PLANNER_CONFIG.bufferMinutes,
    });
    const freeSlots = await getFreeSlotsFromNeo(
      userId,
      date,
      PLANNER_CONFIG.durationMinutes,
      PLANNER_CONFIG.bufferMinutes,
    ).catch((err) => {
      log.error('Failed to fetch free slots', { error: String(err) });
      return null;
    });

    if (freeSlots === null) {
      return { userId, date, status: { status: 'error', message: 'Neo free-slots API unavailable' }, logs };
    }

    log.info('Free slots received', { count: freeSlots.length, slots: freeSlots.map((s) => `${s.start_local}–${s.end_local}`) });

    if (freeSlots.length === 0) {
      log.warn('No free slots available today — no_slot');
      await upsertPlannedSession({
        userId, planDate: date,
        planDayId: todayDay.id, planDayName: todayDay.name, planName: activePlan.planName,
        neoEventId: existing?.neoEventId ?? null,
        plannedStart: null, plannedEnd: null,
        status: 'no_slot',
      });
      return { userId, date, status: { status: 'no_slot' }, logs };
    }

    // ── 6. Sort slots by preference and try each until one works ──────────────
    const best = selectBestSlot(freeSlots, PLANNER_CONFIG.durationMinutes);
    if (!best) {
      log.warn('No slot long enough for workout duration');
      await upsertPlannedSession({
        userId, planDate: date,
        planDayId: todayDay.id, planDayName: todayDay.name, planName: activePlan.planName,
        neoEventId: existing?.neoEventId ?? null,
        plannedStart: null, plannedEnd: null, status: 'no_slot',
      });
      return { userId, date, status: { status: 'no_slot' }, logs };
    }

    // Check if the existing scheduled slot is identical (idempotent)
    const slotEndLocal = minutesToTime(timeToMinutes(best.start_local) + PLANNER_CONFIG.durationMinutes);
    const isSameSlot =
      existing?.neoEventId &&
      existing.plannedStart === best.start_local &&
      existing.plannedEnd   === slotEndLocal;

    if (isSameSlot) {
      log.info('Slot unchanged — no Neo update needed', { start: best.start_local });
      return {
        userId, date,
        status: {
          status:    'scheduled',
          slot:      { startLocal: best.start_local, endLocal: slotEndLocal, startAt: best.start, endAt: addMinutesToISO(best.start, PLANNER_CONFIG.durationMinutes) },
          neoAction: 'updated',
        },
        logs,
      };
    }

    // ── 7. Try PATCH /by-source — slot by slot if collision ───────────────────
    // Sort: best slot first, then others by preference
    const orderedSlots = [
      best,
      ...freeSlots.filter((s) => s !== best).sort((a, b) => timeToMinutes(a.start_local) - timeToMinutes(b.start_local)),
    ];

    for (const slot of orderedSlots) {
      const endAt = addMinutesToISO(slot.start, PLANNER_CONFIG.durationMinutes);
      const endLocal = isoToBerlinTime(endAt);

      log.info('Attempting Neo PATCH /by-source', { start_local: slot.start_local, end_local: endLocal });

      const result = await patchNeoEventBySource({
        user_id:    userId,
        source_app: 'forge',
        source_id:  sourceId,
        title:      trainingTitle,
        start_at:   slot.start,
        end_at:     endAt,
      });

      if (!result.ok) {
        log.warn('409 collision on slot — trying next', {
          slot:             `${slot.start_local}–${endLocal}`,
          conflicting_event: result.collision.title,
          conflict_time:    isoToBerlinTime(result.collision.start_at),
        });
        continue;
      }

      // ── 8. Persist result ──────────────────────────────────────────────────
      await upsertPlannedSession({
        userId, planDate: date,
        planDayId: todayDay.id, planDayName: todayDay.name, planName: activePlan.planName,
        neoEventId:   result.event.id,
        plannedStart: slot.start_local,
        plannedEnd:   endLocal,
        status:       'scheduled',
      });

      log.info('Planning complete', {
        action:     result.action,
        start:      slot.start_local,
        end:        endLocal,
        neoEventId: result.event.id,
      });

      return {
        userId, date,
        status: {
          status:    'scheduled',
          slot:      { startLocal: slot.start_local, endLocal, startAt: slot.start, endAt },
          neoAction: result.action,
        },
        logs,
      };
    }

    // All slots had collisions
    log.warn('All slots had Neo collisions — no_slot');
    await upsertPlannedSession({
      userId, planDate: date,
      planDayId: todayDay.id, planDayName: todayDay.name, planName: activePlan.planName,
      neoEventId: null, plannedStart: null, plannedEnd: null, status: 'no_slot',
    });
    return { userId, date, status: { status: 'no_slot' }, logs };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Planner failed with error', { message });
    return { userId, date, status: { status: 'error', message }, logs };
  }
}
