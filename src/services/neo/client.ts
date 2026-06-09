import type { NeoEvent, NeoEventPayload, NeoEventsQuery, NeoFreeSlot, NeoFreeSlotsParams } from './types';

function getNeoConfig(): { baseUrl: string; secret: string } {
  const baseUrl = process.env.NEO_API_URL;
  const secret  = process.env.NEO_API_SECRET;
  if (!baseUrl) throw new Error('NEO_API_URL is not set');
  if (!secret)  throw new Error('NEO_API_SECRET is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret };
}

async function neoFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, secret } = getNeoConfig();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
      ...init.headers,
    },
    // Never cache Neo responses — calendar data is real-time
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neo API ${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/** GET /api/calendar/free-slots — returns slots where a workout fits */
export async function getFreeSlotsFromNeo(userId: string, params: NeoFreeSlotsParams): Promise<NeoFreeSlot[]> {
  const qs = new URLSearchParams({
    user_id:          userId,
    date:             params.date,
    duration_minutes: String(params.duration_minutes),
    earliest_time:    params.earliest_time,
    latest_time:      params.latest_time,
    buffer_minutes:   String(params.buffer_minutes),
  });
  return neoFetch<NeoFreeSlot[]>(`/api/calendar/free-slots?${qs}`);
}

/** GET /api/calendar/events — find existing Forge events for a day */
export async function getNeoEvents(userId: string, query: NeoEventsQuery): Promise<NeoEvent[]> {
  const qs = new URLSearchParams({ user_id: userId });
  if (query.date)       qs.set('date',       query.date);
  if (query.source_app) qs.set('source_app', query.source_app);
  if (query.type)       qs.set('type',       query.type);
  return neoFetch<NeoEvent[]>(`/api/calendar/events?${qs}`);
}

/** POST /api/calendar/events — create a new event */
export async function createNeoEvent(userId: string, payload: NeoEventPayload): Promise<NeoEvent> {
  return neoFetch<NeoEvent>('/api/calendar/events', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

/** PUT /api/calendar/events/:id — update an existing event */
export async function updateNeoEvent(userId: string, eventId: string, payload: NeoEventPayload): Promise<NeoEvent> {
  return neoFetch<NeoEvent>(`/api/calendar/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

/** DELETE /api/calendar/events/:id — remove an event */
export async function deleteNeoEvent(userId: string, eventId: string): Promise<void> {
  await neoFetch<void>(`/api/calendar/events/${eventId}`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId }),
  });
}
