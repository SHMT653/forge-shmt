-- FORGE by SHMT — database schema
-- Designed to live alongside other SHMT apps (e.g. LINGO) in the SAME Supabase
-- project/database. To avoid any table-name collisions (both apps would
-- otherwise define a conflicting "profiles" table in `public`), every FORGE
-- table is prefixed `forge_` and lives in the regular `public` schema —
-- right alongside LINGO's tables, visible in the default Table Editor view,
-- with no extra "exposed schemas" configuration required. Auth stays shared
-- via `auth.users` — that's the whole point of one project, one user base.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- If you previously ran an earlier version of this file that created a
-- separate `forge` schema, this drops it (and everything in it) first.

drop schema if exists forge cascade;

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- forge_profiles
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.forge_profiles enable row level security;

drop policy if exists "forge_profiles_select_own" on public.forge_profiles;
create policy "forge_profiles_select_own" on public.forge_profiles for select using (auth.uid() = id);
drop policy if exists "forge_profiles_insert_own" on public.forge_profiles;
create policy "forge_profiles_insert_own" on public.forge_profiles for insert with check (auth.uid() = id);
drop policy if exists "forge_profiles_update_own" on public.forge_profiles;
create policy "forge_profiles_update_own" on public.forge_profiles for update using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- training plans
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  focus text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.forge_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.forge_training_plans (id) on delete cascade,
  name text not null,
  order_index integer not null default 0
);

create table if not exists public.forge_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.forge_plan_days (id) on delete cascade,
  name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

alter table public.forge_training_plans enable row level security;
alter table public.forge_plan_days enable row level security;
alter table public.forge_plan_exercises enable row level security;

drop policy if exists "forge_training_plans_all_own" on public.forge_training_plans;
create policy "forge_training_plans_all_own" on public.forge_training_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_plan_days_all_own" on public.forge_plan_days;
create policy "forge_plan_days_all_own" on public.forge_plan_days for all
  using (exists (select 1 from public.forge_training_plans p where p.id = forge_plan_days.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.forge_training_plans p where p.id = forge_plan_days.plan_id and p.user_id = auth.uid()));

drop policy if exists "forge_plan_exercises_all_own" on public.forge_plan_exercises;
create policy "forge_plan_exercises_all_own" on public.forge_plan_exercises for all
  using (exists (
    select 1 from public.forge_plan_days d join public.forge_training_plans p on p.id = d.plan_id
    where d.id = forge_plan_exercises.plan_day_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.forge_plan_days d join public.forge_training_plans p on p.id = d.plan_id
    where d.id = forge_plan_exercises.plan_day_id and p.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- workout sessions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.forge_training_plans (id) on delete set null,
  plan_day_id uuid references public.forge_plan_days (id) on delete set null,
  plan_name text not null default '',
  day_name text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer
);

create table if not exists public.forge_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.forge_workout_sessions (id) on delete cascade,
  exercise_name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

create table if not exists public.forge_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.forge_session_exercises (id) on delete cascade,
  set_index integer not null default 0,
  reps integer,
  weight_kg numeric,
  completed boolean not null default false
);

alter table public.forge_workout_sessions enable row level security;
alter table public.forge_session_exercises enable row level security;
alter table public.forge_session_sets enable row level security;

drop policy if exists "forge_workout_sessions_all_own" on public.forge_workout_sessions;
create policy "forge_workout_sessions_all_own" on public.forge_workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_session_exercises_all_own" on public.forge_session_exercises;
create policy "forge_session_exercises_all_own" on public.forge_session_exercises for all
  using (exists (select 1 from public.forge_workout_sessions s where s.id = forge_session_exercises.session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.forge_workout_sessions s where s.id = forge_session_exercises.session_id and s.user_id = auth.uid()));

drop policy if exists "forge_session_sets_all_own" on public.forge_session_sets;
create policy "forge_session_sets_all_own" on public.forge_session_sets for all
  using (exists (
    select 1 from public.forge_session_exercises e join public.forge_workout_sessions s on s.id = e.session_id
    where e.id = forge_session_sets.session_exercise_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.forge_session_exercises e join public.forge_workout_sessions s on s.id = e.session_id
    where e.id = forge_session_sets.session_exercise_id and s.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- habits
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  unit text not null default '',
  target numeric not null default 1,
  order_index integer not null default 0,
  active boolean not null default true
);

create table if not exists public.forge_habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.forge_habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  value numeric not null default 0,
  completed boolean not null default false,
  unique (habit_id, log_date)
);

alter table public.forge_habits enable row level security;
alter table public.forge_habit_logs enable row level security;

drop policy if exists "forge_habits_all_own" on public.forge_habits;
create policy "forge_habits_all_own" on public.forge_habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_habit_logs_all_own" on public.forge_habit_logs;
create policy "forge_habit_logs_all_own" on public.forge_habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- body progress
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  unique (user_id, log_date)
);

create table if not exists public.forge_progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_at date not null default current_date,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.forge_body_metrics enable row level security;
alter table public.forge_progress_photos enable row level security;

drop policy if exists "forge_body_metrics_all_own" on public.forge_body_metrics;
create policy "forge_body_metrics_all_own" on public.forge_body_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_progress_photos_all_own" on public.forge_progress_photos;
create policy "forge_progress_photos_all_own" on public.forge_progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- nutrition / goals
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2200,
  protein_goal integer not null default 150,
  weight_goal numeric,
  -- fitness profile for auto-calculation
  current_weight numeric,
  height_cm integer,
  birth_year integer,
  gender text not null default 'other',        -- 'male' | 'female' | 'other'
  activity_level text not null default 'moderate', -- sedentary|light|moderate|active|very_active
  goal_type text not null default 'maintain'   -- 'muscle' | 'fat_loss' | 'maintain'
);

-- Migration: add new columns if table already exists (idempotent)
alter table public.forge_user_goals add column if not exists current_weight numeric;
alter table public.forge_user_goals add column if not exists height_cm integer;
alter table public.forge_user_goals add column if not exists birth_year integer;
alter table public.forge_user_goals add column if not exists gender text not null default 'other';
alter table public.forge_user_goals add column if not exists activity_level text not null default 'moderate';
alter table public.forge_user_goals add column if not exists goal_type text not null default 'maintain';

create table if not exists public.forge_nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  calories integer not null default 0,
  protein_g integer not null default 0,
  unique (user_id, log_date)
);

alter table public.forge_user_goals enable row level security;
alter table public.forge_nutrition_logs enable row level security;

drop policy if exists "forge_user_goals_all_own" on public.forge_user_goals;
create policy "forge_user_goals_all_own" on public.forge_user_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_nutrition_logs_all_own" on public.forge_nutrition_logs;
create policy "forge_nutrition_logs_all_own" on public.forge_nutrition_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- storage: progress photos
-- Bucket is namespaced "forge-progress-photos" (storage buckets are global to
-- the project, so a generic name like "progress-photos" could collide with a
-- future bucket from another SHMT app). Per-user folder, e.g.
-- "<uid>/2026-06-08-...jpg".
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('forge-progress-photos', 'forge-progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "forge_progress_photos_storage_own" on storage.objects;
create policy "forge_progress_photos_storage_own"
  on storage.objects for all
  using (bucket_id = 'forge-progress-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'forge-progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────
-- forge_planned_sessions
-- Stores the result of the daily auto-planner per user per day.
-- Tracks which Neo calendar event was created so we can update
-- instead of creating duplicates.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_planned_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_date    date not null,
  plan_day_id  uuid references public.forge_plan_days (id) on delete set null,
  plan_day_name text not null default '',
  plan_name    text not null default '',
  -- Neo integration
  neo_event_id text,                          -- null = not yet created / no slot found
  planned_start time,                         -- e.g. '17:00'
  planned_end   time,                         -- e.g. '18:15'
  -- 'scheduled' | 'no_slot' | 'skipped'
  status       text not null default 'scheduled',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, plan_date)
);

alter table public.forge_planned_sessions enable row level security;

drop policy if exists "forge_planned_sessions_all_own" on public.forge_planned_sessions;
create policy "forge_planned_sessions_all_own" on public.forge_planned_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- forge_meal_entries  (per-meal nutrition tracking)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_meal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  name       text not null default '',
  kcal       numeric not null default 0,
  protein_g  numeric not null default 0,
  carbs_g    numeric not null default 0,
  fat_g      numeric not null default 0,
  logged_at  timestamptz not null default now()
);

alter table public.forge_meal_entries enable row level security;

drop policy if exists "forge_meal_entries_all_own" on public.forge_meal_entries;
create policy "forge_meal_entries_all_own" on public.forge_meal_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
