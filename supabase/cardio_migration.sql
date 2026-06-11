-- Run this in Supabase SQL Editor → New Query → Run
-- Creates the cardio_logs table for FORGE

CREATE TABLE IF NOT EXISTS forge_cardio_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date         date NOT NULL,
  activity         text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  distance_km      numeric(6, 2),
  kcal_burned      integer NOT NULL CHECK (kcal_burned >= 0),
  logged_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forge_cardio_logs_user_date ON forge_cardio_logs (user_id, log_date);

ALTER TABLE forge_cardio_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forge_cardio_own"
  ON forge_cardio_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
