/** A free time slot returned by Neo's free-slots endpoint */
export type NeoFreeSlot = {
  start: string; // "17:00" (local time, Europe/Berlin)
  end:   string; // "18:15"
  date:  string; // "2026-06-09"
};

/** Payload to create or update a calendar event in Neo */
export type NeoEventPayload = {
  title:      string;           // "Training – Push Day"
  date:       string;           // "2026-06-09"
  start_time: string;           // "17:00"
  end_time:   string;           // "18:15"
  source_app: 'forge';
  source_id:  string;           // forge planned_session id (used for idempotency)
  type:       'training';
};

/** A calendar event as returned by Neo */
export type NeoEvent = NeoEventPayload & {
  id: string;                   // Neo's own event id
};

/** Query params for GET /api/calendar/free-slots */
export type NeoFreeSlotsParams = {
  date:             string;     // "2026-06-09"
  duration_minutes: number;     // 75
  earliest_time:    string;     // "15:30"
  latest_time:      string;     // "21:00"
  buffer_minutes:   number;     // 15
};

/** Query params for GET /api/calendar/events */
export type NeoEventsQuery = {
  date?:       string;
  source_app?: string;
  type?:       string;
};
