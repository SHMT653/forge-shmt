import { type NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/services/supabase/serverClient';

type NeoSleepImport = {
  email?: string;
  neoUserId?: string;
  displayName?: string | null;
  mode?: 'wakeup' | 'bedtime';
  logDate?: string;
  sleepMinutes?: number;
  cycles?: number;
  bedAt?: string;
  wakeAt?: string;
  bedTime?: string;
  wakeTime?: string;
  source?: 'neo_sleep_calculator';
};

const MAX_SLEEP_MINUTES = 16 * 60;
const USER_LOOKUP_PAGE_SIZE = 200;
const USER_LOOKUP_MAX_PAGES = 10;

function isAuthorized(req: NextRequest) {
  const secret = process.env.NEO_FORGE_API_SECRET;
  if (!secret) return false;
  return (
    req.headers.get('x-api-secret') === secret ||
    req.headers.get('authorization') === `Bearer ${secret}`
  );
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isClock(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

async function findUserByEmail(supabase: SupabaseClient, email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= USER_LOOKUP_MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USER_LOOKUP_PAGE_SIZE,
    });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < USER_LOOKUP_PAGE_SIZE) return null;
  }

  return null;
}

async function findForgeUser(supabase: SupabaseClient, body: NeoSleepImport, email: string): Promise<User | null> {
  if (body.neoUserId) {
    const { data } = await supabase.auth.admin.getUserById(body.neoUserId);
    if (data.user?.email?.toLowerCase() === email) return data.user;
  }

  return findUserByEmail(supabase, email);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: NeoSleepImport;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const sleepMinutes = Number(body.sleepMinutes);
  const cycles = Number(body.cycles);

  if (
    !email ||
    !email.includes('@') ||
    !isDateKey(body.logDate) ||
    !Number.isInteger(sleepMinutes) ||
    sleepMinutes <= 0 ||
    sleepMinutes > MAX_SLEEP_MINUTES ||
    !Number.isInteger(cycles) ||
    cycles <= 0 ||
    cycles > 12 ||
    (body.mode !== 'wakeup' && body.mode !== 'bedtime') ||
    !isClock(body.bedTime) ||
    !isClock(body.wakeTime) ||
    !isIsoDate(body.bedAt) ||
    !isIsoDate(body.wakeAt) ||
    body.source !== 'neo_sleep_calculator'
  ) {
    return NextResponse.json({ error: 'Invalid sleep import' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const forgeUser = await findForgeUser(supabase, body, email);
    if (!forgeUser) {
      return NextResponse.json({ error: 'Forge-Benutzer mit dieser E-Mail nicht gefunden.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('forge_daily_health').upsert(
      {
        user_id: forgeUser.id,
        log_date: body.logDate,
        sleep_minutes: sleepMinutes,
        sleep_source: 'manual',
        updated_at: now,
      },
      { onConflict: 'user_id,log_date' },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      userId: forgeUser.id,
      logDate: body.logDate,
      sleepMinutes,
      cycles,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Forge-Schlafimport fehlgeschlagen.' },
      { status: 500 },
    );
  }
}
