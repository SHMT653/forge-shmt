import { NextResponse } from 'next/server';
import {
  PLANNER_CONFIG,
  getTodaysPlanDay,
  makeLogger,
  minutesToTime,
  selectBestSlot,
  timeToMinutes,
  type PlannerLog,
} from '@/domain/planner';
import type { NeoFreeSlot } from '@/services/neo/types';

// ─── Only allow in development ───────────────────────────────────────────────
// Remove or add auth if you want this in production.
if (process.env.NODE_ENV === 'production') {
  console.warn('[planner/test] Test endpoint is active in production — consider removing it.');
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; detail: string; logs: PlannerLog[] };

function makeSlot(start: string, end: string, date = '2026-06-09'): NeoFreeSlot {
  return { start, end, date };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Simulated planner run (pure, no DB / network) ────────────────────────────

function simulatePlanner(
  freeSlots: NeoFreeSlot[],
  existingEventId: string | null,
  existingStart: string | null,
  existingEnd: string | null,
): { status: string; slot: { start: string; end: string } | null; neoEventId: string | null; logs: PlannerLog[] } {
  const logs: PlannerLog[] = [];
  const log = makeLogger(logs);

  const planDays = [{ id: 'day-1', name: 'Push Day' }];
  const completedCount = 0;

  const todayDay = getTodaysPlanDay(planDays, completedCount);
  if (!todayDay) {
    log.warn('No plan day');
    return { status: 'no_plan', slot: null, neoEventId: null, logs };
  }

  log.info('Today\'s plan day', { name: todayDay.name });
  log.info('Free slots found', { count: freeSlots.length });

  if (freeSlots.length === 0) {
    log.warn('No free slots available — no_slot');
    return { status: 'no_slot', slot: null, neoEventId: null, logs };
  }

  const best = selectBestSlot(freeSlots, PLANNER_CONFIG.durationMinutes);
  if (!best) {
    log.warn('No slot long enough');
    return { status: 'no_slot', slot: null, neoEventId: null, logs };
  }

  const slotEnd = minutesToTime(timeToMinutes(best.start) + PLANNER_CONFIG.durationMinutes);
  log.info('Selected slot', { start: best.start, end: slotEnd });

  // Check for duplicate (same slot)
  const isSameSlot = existingEventId && existingStart === best.start && existingEnd === slotEnd;
  if (isSameSlot) {
    log.info('Same slot — no update needed');
    return { status: 'scheduled', slot: { start: best.start, end: slotEnd }, neoEventId: existingEventId, logs };
  }

  const action = existingEventId ? 'updated' : 'scheduled';
  const neoEventId = existingEventId ?? 'neo-event-' + Date.now();
  log.info(`Neo event ${action}`, { eventId: neoEventId });

  return { status: action, slot: { start: best.start, end: slotEnd }, neoEventId, logs };
}

// ─── The 5 test cases ──────────────────────────────────────────────────────────

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  // Test A: Empty calendar → training scheduled after 15:30
  try {
    const slots: NeoFreeSlot[] = [
      makeSlot('15:30', '21:00'), // big open block
    ];
    const r = simulatePlanner(slots, null, null, null);
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.slot !== null, 'Expected a slot');
    assert(timeToMinutes(r.slot!.start) >= timeToMinutes('15:30'), 'Start must be ≥ 15:30');
    results.push({ name: 'A – Empty calendar → training scheduled after 15:30', passed: true, detail: `Slot: ${r.slot!.start}–${r.slot!.end}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'A – Empty calendar → training scheduled after 15:30', passed: false, detail: String(e), logs: [] });
  }

  // Test B: Appointment 17:00–18:00 → training before or after with buffer
  try {
    // Neo already returns slots with buffer applied — so 15:30–16:45 and 18:15–21:00
    const slots: NeoFreeSlot[] = [
      makeSlot('15:30', '16:45'), // fits? 16:45 - 15:30 = 75 min exactly
      makeSlot('18:15', '21:00'), // fits after buffer
    ];
    const r = simulatePlanner(slots, null, null, null);
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    // Planner should prefer 17:00–19:00 window → picks 18:15 slot
    assert(r.slot !== null, 'Expected a slot');
    const start = timeToMinutes(r.slot!.start);
    // Either before 17:00 (15:30) or after 18:00+buffer (18:15) is valid
    assert(start <= timeToMinutes('16:45') || start >= timeToMinutes('18:15'), `Unexpected start: ${r.slot!.start}`);
    results.push({ name: 'B – Appointment 17:00–18:00 → training with buffer', passed: true, detail: `Slot: ${r.slot!.start}–${r.slot!.end}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'B – Appointment 17:00–18:00 → training with buffer', passed: false, detail: String(e), logs: [] });
  }

  // Test C: Calendar full until 21:00 → no training forced
  try {
    const slots: NeoFreeSlot[] = []; // no free slots
    const r = simulatePlanner(slots, null, null, null);
    assert(r.status === 'no_slot', `Expected 'no_slot', got '${r.status}'`);
    assert(r.slot === null, 'Expected no slot');
    results.push({ name: 'C – Full calendar → no training forced', passed: true, detail: 'Status: no_slot', logs: r.logs });
  } catch (e) {
    results.push({ name: 'C – Full calendar → no training forced', passed: false, detail: String(e), logs: [] });
  }

  // Test D: Training already exists at correct time → no duplicate
  try {
    const slots: NeoFreeSlot[] = [makeSlot('17:00', '21:00')];
    // Simulate: existing event at 17:00–18:15
    const r = simulatePlanner(slots, 'existing-event-id', '17:00', '18:15');
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.neoEventId === 'existing-event-id', 'Should reuse existing event ID');
    results.push({ name: 'D – Training already exists → no duplicate', passed: true, detail: `Reused event: ${r.neoEventId}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'D – Training already exists → no duplicate', passed: false, detail: String(e), logs: [] });
  }

  // Test E: Appointment added, slot changes → training rescheduled
  try {
    // Existing event was at 17:00, but now slot 17:00 is gone (conflict added)
    // Only slot available: 18:15–21:00
    const slots: NeoFreeSlot[] = [makeSlot('18:15', '21:00')];
    const r = simulatePlanner(slots, 'existing-event-id', '17:00', '18:15'); // old slot was 17:00
    assert(r.status === 'updated', `Expected 'updated', got '${r.status}'`);
    assert(r.slot !== null && r.slot.start === '18:15', `Expected start 18:15, got ${r.slot?.start}`);
    results.push({ name: 'E – Slot changes → training rescheduled', passed: true, detail: `Updated to: ${r.slot!.start}–${r.slot!.end}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'E – Slot changes → training rescheduled', passed: false, detail: String(e), logs: [] });
  }

  return results;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const results = runTests();
  const passed  = results.filter((r) => r.passed).length;
  const total   = results.length;
  const allPass = passed === total;

  return NextResponse.json(
    { passed, total, allPass, results },
    { status: allPass ? 200 : 207 },
  );
}
