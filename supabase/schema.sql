-- FORGE by SHMT — database schema
-- Designed to live alongside other SHMT apps (e.g. LINGO) in the SAME Supabase
-- project/database. To avoid any table-name collisions (both apps would
-- otherwise define a conflicting "profiles" table in `public`), every FORGE
-- table lives in its own Postgres schema: `forge`. Auth stays shared via
-- `auth.users` — that's the whole point of one project, one user base.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- ⚠️ One manual step after running this: in the Supabase Dashboard go to
--    Project Settings → API → "Exposed schemas" and add `forge` to the list
--    (alongside `public`). Without that, PostgREST won't serve `forge.*` to
--    the app. The FORGE Supabase client is already configured to talk to the
--    `forge` schema (see src/services/supabase/client.ts).

create extension if not exists "pgcrypto";

create schema if not exists forge;

grant usage on schema forge to authenticated, anon, service_role;
alter default privileges in schema forge grant all on tables to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- forge.profiles
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table forge.profiles enable row level security;

drop policy if exists "profiles_select_own" on forge.profiles;
create policy "profiles_select_own" on forge.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on forge.profiles;
create policy "profiles_insert_own" on forge.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on forge.profiles;
create policy "profiles_update_own" on forge.profiles for update using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- training plans
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  focus text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists forge.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references forge.training_plans (id) on delete cascade,
  name text not null,
  order_index integer not null default 0
);

create table if not exists forge.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references forge.plan_days (id) on delete cascade,
  name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

alter table forge.training_plans enable row level security;
alter table forge.plan_days enable row level security;
alter table forge.plan_exercises enable row level security;

drop policy if exists "training_plans_all_own" on forge.training_plans;
create policy "training_plans_all_own" on forge.training_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plan_days_all_own" on forge.plan_days;
create policy "plan_days_all_own" on forge.plan_days for all
  using (exists (select 1 from forge.training_plans p where p.id = plan_days.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from forge.training_plans p where p.id = plan_days.plan_id and p.user_id = auth.uid()));

drop policy if exists "plan_exercises_all_own" on forge.plan_exercises;
create policy "plan_exercises_all_own" on forge.plan_exercises for all
  using (exists (
    select 1 from forge.plan_days d join forge.training_plans p on p.id = d.plan_id
    where d.id = plan_exercises.plan_day_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from forge.plan_days d join forge.training_plans p on p.id = d.plan_id
    where d.id = plan_exercises.plan_day_id and p.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- workout sessions
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references forge.training_plans (id) on delete set null,
  plan_day_id uuid references forge.plan_days (id) on delete set null,
  plan_name text not null default '',
  day_name text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer
);

create table if not exists forge.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references forge.workout_sessions (id) on delete cascade,
  exercise_name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

create table if not exists forge.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references forge.session_exercises (id) on delete cascade,
  set_index integer not null default 0,
  reps integer,
  weight_kg numeric,
  completed boolean not null default false
);

alter table forge.workout_sessions enable row level security;
alter table forge.session_exercises enable row level security;
alter table forge.session_sets enable row level security;

drop policy if exists "workout_sessions_all_own" on forge.workout_sessions;
create policy "workout_sessions_all_own" on forge.workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "session_exercises_all_own" on forge.session_exercises;
create policy "session_exercises_all_own" on forge.session_exercises for all
  using (exists (select 1 from forge.workout_sessions s where s.id = session_exercises.session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from forge.workout_sessions s where s.id = session_exercises.session_id and s.user_id = auth.uid()));

drop policy if exists "session_sets_all_own" on forge.session_sets;
create policy "session_sets_all_own" on forge.session_sets for all
  using (exists (
    select 1 from forge.session_exercises e join forge.workout_sessions s on s.id = e.session_id
    where e.id = session_sets.session_exercise_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from forge.session_exercises e join forge.workout_sessions s on s.id = e.session_id
    where e.id = session_sets.session_exercise_id and s.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- habits
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  unit text not null default '',
  target numeric not null default 1,
  order_index integer not null default 0,
  active boolean not null default true
);

create table if not exists forge.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references forge.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  value numeric not null default 0,
  completed boolean not null default false,
  unique (habit_id, log_date)
);

alter table forge.habits enable row level security;
alter table forge.habit_logs enable row level security;

drop policy if exists "habits_all_own" on forge.habits;
create policy "habits_all_own" on forge.habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs_all_own" on forge.habit_logs;
create policy "habit_logs_all_own" on forge.habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- body progress
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  unique (user_id, log_date)
);

create table if not exists forge.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_at date not null default current_date,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table forge.body_metrics enable row level security;
alter table forge.progress_photos enable row level security;

drop policy if exists "body_metrics_all_own" on forge.body_metrics;
create policy "body_metrics_all_own" on forge.body_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress_photos_all_own" on forge.progress_photos;
create policy "progress_photos_all_own" on forge.progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- nutrition / goals
-- ─────────────────────────────────────────────────────────────
create table if not exists forge.user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2200,
  protein_goal integer not null default 150,
  weight_goal numeric
);

create table if not exists forge.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  calories integer not null default 0,
  protein_g integer not null default 0,
  unique (user_id, log_date)
);

alter table forge.user_goals enable row level security;
alter table forge.nutrition_logs enable row level security;

drop policy if exists "user_goals_all_own" on forge.user_goals;
create policy "user_goals_all_own" on forge.user_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nutrition_logs_all_own" on forge.nutrition_logs;
create policy "nutrition_logs_all_own" on forge.nutrition_logs for all
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
