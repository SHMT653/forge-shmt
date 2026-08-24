-- FORGE progress start date
--
-- Additive and safe to re-run. This lets progress photos follow a fixed rhythm
-- from the user's chosen start date instead of drifting from the last photo.

alter table public.forge_user_goals
  add column if not exists progress_start_date date;
