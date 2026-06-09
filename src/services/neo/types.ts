/** A free slot returned by NEO's free-slots endpoint (times in UTC + Berlin local) */
export type NeoFreeSlot = {
  start:       string; // UTC ISO: "2026-06-09T13:30:00.000Z"
  end:         string; // UTC ISO: "2026-06-09T14:45:00.000Z"
  start_local: string; // Berlin local: "15:30"
  end_local:   string; // Berlin local: "16:45"
};

export type NeoFreeSlotsResponse = {
  free_slots: NeoFreeSlot[];
  count:      number;
};

/** Body for POST /api/calendar/events (create new) */
export type NeoCreateEventPayload = {
  user_id:     string;
  title:       string;
  start_at:    string;      // UTC ISO
  end_at:      string;      // UTC ISO
  description?: string;
  source_app:  'forge';
  source_id:   string;      // forge_planned_sessions.id (stable per user+date)
};

/** Body for PATCH /api/calendar/events/by-source (upsert by source_id) */
export type NeoPatchBySourcePayload = {
  user_id:     string;
  source_app:  'forge';
  source_id:   string;
  title:       string;
  start_at:    string;      // UTC ISO
  end_at:      string;      // UTC ISO
  description?: string;
};

export type NeoPatchBySourceResponse = {
  action: 'created' | 'updated';
  event:  NeoEventRecord;
};

export type NeoEventRecord = {
  id:         string;
  title:      string;
  start_at:   string;
  end_at:     string;
  source_app?: string;
  source_id?:  string;
};

/** 409 Conflict response */
export type NeoCollisionError = {
  error:              'collision';
  conflicting_event:  {
    title:    string;
    start_at: string;
    end_at:   string;
  };
};
