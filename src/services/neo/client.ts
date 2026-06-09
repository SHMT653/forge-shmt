import type {
  NeoCollisionError,
  NeoCreateEventPayload,
  NeoEventRecord,
  NeoPatchBySourcePayload,
  NeoPatchBySourceResponse,
  NeoFreeSlot,
  NeoFreeSlotsResponse,
} from './types';

function getNeoConfig(): { baseUrl: string; secret: string } {
  const baseUrl = process.env.NEO_API_URL;
  const secret  = process.env.NEO_FORGE_API_SECRET;
  if (!baseUrl) throw new Error('NEO_API_URL is not set');
  if (!secret)  throw new Error('NEO_FORGE_API_SECRET is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret };
}

async function neoFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, secret } = getNeoConfig();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': secret,
      ...init.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neo API ${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/** GET /api/calendar/free-slots — returns slots fitting the requested duration */
export async function getFreeSlotsFromNeo(
  userId:   string,
  date:     string,
  duration: number,
  buffer:   number,
): Promise<NeoFreeSlot[]> {
  const qs = new URLSearchParams({
    user_id:  userId,
    date,
    duration: String(duration),
    buffer:   String(buffer),
  });
  const resp = await neoFetch<NeoFreeSlotsResponse>(`/api/calendar/free-slots?${qs}`);
  return resp.free_slots ?? [];
}

export type PatchResult =
  | { ok: true;  action: 'created' | 'updated'; event: NeoEventRecord }
  | { ok: false; collision: NeoCollisionError['conflicting_event'] };

/**
 * PATCH /api/calendar/events/by-source
 * Upserts the Forge event identified by source_id.
 * Returns ok=false on 409 collision so the caller can try the next slot.
 */
export async function patchNeoEventBySource(payload: NeoPatchBySourcePayload): Promise<PatchResult> {
  const { baseUrl, secret } = getNeoConfig();
  const res = await fetch(`${baseUrl}/api/calendar/events/by-source`, {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': secret,
    },
    body:  JSON.stringify(payload),
    cache: 'no-store',
  });

  if (res.status === 409) {
    const body = await res.json() as NeoCollisionError;
    return { ok: false, collision: body.conflicting_event };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neo PATCH /by-source → ${res.status}: ${body}`);
  }

  const data = await res.json() as NeoPatchBySourceResponse;
  return { ok: true, action: data.action, event: data.event };
}

/** POST /api/calendar/events — explicit create (returns 409 on collision) */
export async function createNeoEvent(payload: NeoCreateEventPayload): Promise<PatchResult> {
  const { baseUrl, secret } = getNeoConfig();
  const res = await fetch(`${baseUrl}/api/calendar/events`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': secret,
    },
    body:  JSON.stringify(payload),
    cache: 'no-store',
  });

  if (res.status === 409) {
    const body = await res.json() as NeoCollisionError;
    return { ok: false, collision: body.conflicting_event };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neo POST /events → ${res.status}: ${body}`);
  }

  const event = await res.json() as NeoEventRecord;
  return { ok: true, action: 'created', event };
}
