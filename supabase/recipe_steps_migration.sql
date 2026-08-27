-- Run this in Supabase SQL Editor → New Query → Run
-- Adds the cooking steps to FORGE recipes.
-- Safe to run more than once.

ALTER TABLE forge_recipes
  ADD COLUMN IF NOT EXISTS steps text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN forge_recipes.steps IS
  'Zubereitung, ein Schritt pro Element, in Reihenfolge.';
