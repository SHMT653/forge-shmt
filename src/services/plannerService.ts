/**
 * plannerService.ts
 *
 * Orchestrates the daily training planning for a single user:
 * 1. Look up active plan + today's rotation day
 * 2. Check if a Forge event already exists in Neo for today
 * 3. Find a free slot via Neo API
 * 4. Create or update the Neo calendar event
 * 5. Persist the result in forge_planned_sessions
 */

import { getActivePlanForUser, getPlannedSession, upsertPlannedSession } from '@/data/plannedSessions';
import {
  createNeoEvent,
  deleteNeoEvent,
  getFreeSlotsFromNeo,
  getNeoEvents,
  updateNeoEvent,
} from '@/services/neo/client';
import {
  PLANNER_CONFIG,
  getTodaysPlanDay,
  makeLogger,
  minutesToTime,
  selectBestSlot,
  timeToMinutes,
  type PlannerLog,
  type PlannerStatus,
} from '@/domain/planner';

/** Returns today's date in YYYY-MM-DD format in Europe/Berlin timezone */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PLANNER_CONFIG.timezone }).format(new Date());
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
    log.info('Today\'s plan day', { dayId: todayDay.id, dayName: todayDay.name });

    const trainingTitle = `Training – ${todayDay.name}`;

    // ── 3. Check existing planned session for today ────────────────────────────
    const existing = await getPlannedSession(userId, date);
    log.info('Existing planned session', { existing });

    // ── 4. Check Neo for existing Forge events today ───────────────────────────
    log.info('Querying Neo calendar for existing Forge events');
    const existingNeoEvents = await getFreeSlotsFromNeo(userId, {
      date,
      duration_minutes: PLANNER_CONFIG.durationMinutes,
      earliest_time:    PLANNER_CONFIG.earliestTime,
      latest_time:      PLANNER_CONFIG.latestTime,
      buffer_minutes:   PLANNER_CONFIG.bufferMinutes,
    }).catch(() => null);

    // Also check for any Forge event already in Neo calendar
    const forgeEventsToday = await getNeoEvents(userId, {
      date,
      source_app: 'forge',
      type:       'training',
    }).catch(() => []);

    const existingNeoEventId = existing?.neoEventId ?? forgeEventsToday[0]?.id ?? null;
    if (existingNeoEventId) {
      log.info('Found existing Neo event', { eventId: existingNeoEventId });
    }

    // ── 5. Find free slots ────────────────────────────────────────────────────
    log.info('Querying Neo free-slots API');
    const freeSlots = existingNeoEvents ?? [];
    log.info('Free slots found', { count: freeSlots.length, slots: freeSlots });

    if (freeSlots.length === 0) {
      log.warn('No free slots available today — marking as no_slot');

      // Clean up stale Neo event if it exists but there's no slot (shouldn't happen normally)
      if (existingNeoEventId) {
        log.warn('Deleting stale Neo event (no slot found but event existed)', { existingNeoEventId });
        await deleteNeoEvent(userId, existingNeoEventId).catch((e) => log.error('Failed to delete stale Neo event', e));
      }

      await upsertPlannedSession({
        userId,
        planDate:     date,
        planDayId:    todayDay.id,
        planDayName:  todayDay.name,
        planName:     activePlan.planName,
        neoEventId:   null,
        plannedStart: null,
        plannedEnd:   null,
        status:       'no_slot',
      });

      return { userId, date, status: { status: 'no_slot' }, logs };
    }

    // ── 6. Select best slot ────────────────────────────────────────────────────
    const best = selectBestSlot(freeSlots, PLANNER_CONFIG.durationMinutes);
    if (!best) {
      log.warn('No slot long enough for workout duration');
      await upsertPlannedSession({
        userId, planDate: date, planDayId: todayDay.id, planDayName: todayDay.name,
        planName: activePlan.planName, neoEventId: null, plannedStart: null, plannedEnd: null, status: 'no_slot',
      });
      return { userId, date, status: { status: 'no_slot' }, logs };
    }

    const slotEnd = minutesToTime(timeToMinutes(best.start) + PLANNER_CONFIG.durationMinutes);
    log.info('Selected slot', { start: best.start, end: slotEnd });

    // ── 7. Check if existing event is at the same time (no-op) ────────────────
    const isSameSlot =
      existingNeoEventId &&
      existing?.plannedStart === best.start &&
      existing?.plannedEnd   === slotEnd;

    if (isSameSlot) {
      log.info('Existing event is still at the correct time — no update needed');
      return {
        userId, date,
        status: { status: 'scheduled', slot: { start: best.start, end: slotEnd }, neoEventId: existingNeoEventId! },
        logs,
      };
    }

    // ── 8. Create or update Neo event ─────────────────────────────────────────
    const sessionId = existing?.id ?? crypto.randomUUID();
    const eventPayload = {
      title:      trainingTitle,
      date,
      start_time: best.start,
      end_time:   slotEnd,
      source_app: 'forge' as const,
      source_id:  sessionId,
      type:       'training' as const,
    };

    let neoEventId: string;
    let finalStatus: 'scheduled' | 'updated';

    if (existingNeoEventId) {
      log.info('Updating existing Neo event', { eventId: existingNeoEventId });
      const updated = await updateNeoEvent(userId, existingNeoEventId, eventPayload);
      neoEventId   = updated.id;
      finalStatus  = 'updated';
      log.info('Neo event updated', { eventId: neoEventId });
    } else {
      log.info('Creating new Neo event');
      const created = await createNeoEvent(userId, eventPayload);
      neoEventId  = created.id;
      finalStatus = 'scheduled';
      log.info('Neo event created', { eventId: neoEventId, title: trainingTitle });
    }

    // ── 9. Persist in Forge DB ────────────────────────────────────────────────
    await upsertPlannedSession({
      userId,
      planDate:     date,
      planDayId:    todayDay.id,
      planDayName:  todayDay.name,
      planName:     activePlan.planName,
      neoEventId,
      plannedStart: best.start,
      plannedEnd:   slotEnd,
      status:       'scheduled',
    });

    log.info('Planning complete', { status: finalStatus, start: best.start, end: slotEnd });
    return {
      userId, date,
      status: { status: finalStatus, slot: { start: best.start, end: slotEnd }, neoEventId },
      logs,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('Planner failed with error', { message });
    return { userId, date, status: { status: 'error', message }, logs };
  }
}
