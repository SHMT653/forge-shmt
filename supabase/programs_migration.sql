-- Run in Supabase SQL Editor → New Query → Run
-- Adds goal program + intermittent fasting fields to user_goals

ALTER TABLE forge_user_goals
  ADD COLUMN IF NOT EXISTS program_id         text,
  ADD COLUMN IF NOT EXISTS fasting_protocol   text,
  ADD COLUMN IF NOT EXISTS fasting_start_hour integer;
