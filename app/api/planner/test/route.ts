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

type TestResult = { name: string; passed: boolean; detail: string; logs: PlannerLog[] };

/** Build a NeoFreeSlot from Berlin local times (UTC fields unused in pure logic tests) */
function makeSlot(start_local: string, end_local: string): NeoFreeSlot {
  return { start: '', end: '', start_local, end_local };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Simulated planner run (pure, no DB / network) ────────────────────────────

type SimResult = {
  status:      string;
  startLocal:  string | null;
  endLocal:    string | null;
  neoAction:   'created' | 'updated' | null;
  logs:        PlannerLog[];
};

function simulatePlanner(
  freeSlots:       NeoFreeSlot[],
  existingStart:   string | null,
  existingEnd:     string | null,
): SimResult {
  const logs: PlannerLog[] = [];
  const log = makeLogger(logs);

  const planDays = [{ id: 'day-1', name: 'Push Day' }];
  const todayDay = getTodaysPlanDay(planDays, 0);
  if (!todayDay) {
    log.warn('No plan day');
    return { status: 'no_plan', startLocal: null, endLocal: null, neoAction: null, logs };
  }

  log.info("Today's plan day", { name: todayDay.name });
  log.info('Free slots found', { count: freeSlots.length });

  if (freeSlots.length === 0) {
    log.warn('No free slots available — no_slot');
    return { status: 'no_slot', startLocal: null, endLocal: null, neoAction: null, logs };
  }

  const best = selectBestSlot(freeSlots, PLANNER_CONFIG.durationMinutes);
  if (!best) {
    log.warn('No slot long enough');
    return { status: 'no_slot', startLocal: null, endLocal: null, neoAction: null, logs };
  }

  const slotEndLocal = minutesToTime(timeToMinutes(best.start_local) + PLANNER_CONFIG.durationMinutes);
  log.info('Selected slot', { start: best.start_local, end: slotEndLocal });

  const isSameSlot = existingStart === best.start_local && existingEnd === slotEndLocal;
  if (isSameSlot) {
    log.info('Same slot — no update needed');
    return { status: 'scheduled', startLocal: best.start_local, endLocal: slotEndLocal, neoAction: 'updated', logs };
  }

  const neoAction: 'created' | 'updated' = existingStart ? 'updated' : 'created';
  log.info('Neo event ' + neoAction);
  return { status: 'scheduled', startLocal: best.start_local, endLocal: slotEndLocal, neoAction, logs };
}

// ─── The 5 test cases ──────────────────────────────────────────────────────────

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  // Test A: Empty calendar → training scheduled after 15:30
  try {
    const r = simulatePlanner([makeSlot('15:30', '21:00')], null, null);
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.startLocal !== null, 'Expected a slot');
    assert(timeToMinutes(r.startLocal!) >= timeToMinutes('15:30'), 'Start must be ≥ 15:30');
    results.push({ name: 'A – Empty calendar → training scheduled after 15:30', passed: true, detail: `Slot: ${r.startLocal}–${r.endLocal}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'A – Empty calendar → training scheduled after 15:30', passed: false, detail: String(e), logs: [] });
  }

  // Test B: Appointment 17:00–18:00 → training before or after with buffer
  try {
    // Neo returns slots with buffer already applied
    const slots = [makeSlot('15:30', '16:45'), makeSlot('18:15', '21:00')];
    const r = simulatePlanner(slots, null, null);
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.startLocal !== null, 'Expected a slot');
    const start = timeToMinutes(r.startLocal!);
    assert(start <= timeToMinutes('16:45') || start >= timeToMinutes('18:15'), `Unexpected start: ${r.startLocal}`);
    results.push({ name: 'B – Appointment 17:00–18:00 → training with buffer', passed: true, detail: `Slot: ${r.startLocal}–${r.endLocal}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'B – Appointment 17:00–18:00 → training with buffer', passed: false, detail: String(e), logs: [] });
  }

  // Test C: Calendar full → no training forced
  try {
    const r = simulatePlanner([], null, null);
    assert(r.status === 'no_slot', `Expected 'no_slot', got '${r.status}'`);
    assert(r.startLocal === null, 'Expected no slot');
    results.push({ name: 'C – Full calendar → no training forced', passed: true, detail: 'Status: no_slot', logs: r.logs });
  } catch (e) {
    results.push({ name: 'C – Full calendar → no training forced', passed: false, detail: String(e), logs: [] });
  }

  // Test D: Training already exists at correct time → no duplicate
  try {
    const r = simulatePlanner([makeSlot('17:00', '21:00')], '17:00', '18:15');
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.neoAction === 'updated', 'Should be an update, not duplicate create');
    results.push({ name: 'D – Training already exists → no duplicate', passed: true, detail: `Action: ${r.neoAction}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'D – Training already exists → no duplicate', passed: false, detail: String(e), logs: [] });
  }

  // Test E: Appointment added, slot changes → training rescheduled
  try {
    const r = simulatePlanner([makeSlot('18:15', '21:00')], '17:00', '18:15');
    assert(r.status === 'scheduled', `Expected 'scheduled', got '${r.status}'`);
    assert(r.startLocal === '18:15', `Expected start 18:15, got ${r.startLocal}`);
    assert(r.neoAction === 'updated', `Expected 'updated', got '${r.neoAction}'`);
    results.push({ name: 'E – Slot changes → training rescheduled', passed: true, detail: `Updated to: ${r.startLocal}–${r.endLocal}`, logs: r.logs });
  } catch (e) {
    results.push({ name: 'E – Slot changes → training rescheduled', passed: false, detail: String(e), logs: [] });
  }

  return results;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Planner test endpoint is disabled in production.' }, { status: 404 });
  }

  const results = runTests();
  const passed  = results.filter((r) => r.passed).length;
  const total   = results.length;
  const allPass = passed === total;

  return NextResponse.json(
    { passed, total, allPass, results },
    { status: allPass ? 200 : 207 },
  );
}
