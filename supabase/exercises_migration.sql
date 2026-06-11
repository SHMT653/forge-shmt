-- Run this in Supabase SQL Editor → New Query → Run
-- Creates the shared community exercises table for FORGE

CREATE TABLE IF NOT EXISTS forge_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  muscle_group text NOT NULL,
  equipment    text NOT NULL,
  muscles      text[] NOT NULL DEFAULT '{}',
  machine_info text,
  default_sets integer NOT NULL DEFAULT 3,
  default_reps text NOT NULL DEFAULT '8-12',
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forge_exercises_name_lower ON forge_exercises (lower(name));

ALTER TABLE forge_exercises ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all exercises (community DB)
CREATE POLICY "forge_exercises_read"
  ON forge_exercises FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can create exercises
CREATE POLICY "forge_exercises_insert"
  ON forge_exercises FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can only edit/delete their own exercises
CREATE POLICY "forge_exercises_update"
  ON forge_exercises FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "forge_exercises_delete"
  ON forge_exercises FOR DELETE
  USING (auth.uid() = created_by);
