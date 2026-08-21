-- ═══════════════════════════════════════════════════════════════════════════
-- FORGE — "Health & flexible goals" migration
--
-- Two themes:
--   1. Health data with an explicit SOURCE per metric, so Apple Health and
--      manual entry can coexist without ever double-counting (§11/§43).
--   2. Goals that belong to the user, not to the code: phase history with real
--      date ranges, equipment, training focus (§22–§34).
--
-- Additive and idempotent, like coach_migration.sql. Run it after that one.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. Daily health metrics
--
-- One row per user per day holding AGGREGATES only — never raw HealthKit
-- samples (§13). Each metric carries its own source, because steps may come
-- from Apple Health on the same day sleep was typed in by hand.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_daily_health (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  log_date           date not null,

  steps              integer,
  active_energy_kcal integer,
  walking_distance_m integer,
  sleep_minutes      integer,

  -- 'manual' | 'apple_health' | 'import' | 'calculated'
  steps_source       text not null default 'manual',
  energy_source      text not null default 'manual',
  distance_source    text not null default 'manual',
  sleep_source       text not null default 'manual',

  synced_at          timestamptz,
  updated_at         timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists forge_daily_health_user_date on public.forge_daily_health (user_id, log_date desc);

alter table public.forge_daily_health enable row level security;
drop policy if exists "forge_daily_health_all_own" on public.forge_daily_health;
create policy "forge_daily_health_all_own" on public.forge_daily_health for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weight entries already carry a source ('manual' | 'bia'); Apple Health is a
-- third origin. The column is free text, so nothing needs widening — but the
-- comment records the accepted set.
comment on column public.forge_body_metrics.source is
  'manual | bia | apple_health — where this measurement came from';

-- ─────────────────────────────────────────────────────────────
-- 2. Health connection state, per user
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_health_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  provider       text not null default 'apple_health',
  connected      boolean not null default false,
  -- Which HealthKit types the user actually granted, so the UI can be honest
  -- about partial permissions instead of pretending everything works.
  granted_types  text[] not null default '{}',
  last_synced_at timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);

alter table public.forge_health_connections enable row level security;
drop policy if exists "forge_health_connections_all_own" on public.forge_health_connections;
create policy "forge_health_connections_all_own" on public.forge_health_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Goal phases as HISTORY, not a single mutable row (§29)
--
-- An open phase has end_date = null. Switching phases closes the previous one
-- rather than overwriting it, which is what makes "während deines Cuts hast du
-- 2,3 kg verloren" answerable at all.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_goal_phases (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  phase_type              text not null,             -- cut|recomp|maintain|lean_bulk|custom
  label                   text not null default '',  -- user's own name for a custom phase
  start_date              date not null,
  end_date                date,                      -- null = currently active

  calories_min            integer,
  calories_max            integer,
  protein_min             integer,
  protein_max             integer,
  steps_goal              integer,
  water_goal_ml           integer,
  sleep_goal_h            numeric,
  weekly_training_goal    integer,
  weight_goal             numeric,
  weekly_weight_change_kg numeric,

  created_at              timestamptz not null default now()
);

create index if not exists forge_goal_phases_user on public.forge_goal_phases (user_id, start_date desc);
-- At most one open phase per user.
create unique index if not exists forge_goal_phases_one_active
  on public.forge_goal_phases (user_id) where end_date is null;

alter table public.forge_goal_phases enable row level security;
drop policy if exists "forge_goal_phases_all_own" on public.forge_goal_phases;
create policy "forge_goal_phases_all_own" on public.forge_goal_phases for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Equipment, training focus and onboarding state (§32/§33/§26)
-- ─────────────────────────────────────────────────────────────
alter table public.forge_user_goals
  add column if not exists equipment            text[] not null default '{}',
  add column if not exists training_focus       text[] not null default '{}',
  add column if not exists weekly_training_goal integer,
  add column if not exists onboarded_at         timestamptz,
  add column if not exists health_enabled       boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- 5. Backfill: turn the existing single phase into the first history row
--
-- Only for users who already have goals and no phase row yet, so re-running
-- this file never creates duplicates.
-- ─────────────────────────────────────────────────────────────
insert into public.forge_goal_phases (
  user_id, phase_type, start_date,
  calories_min, calories_max, protein_min, protein_max,
  steps_goal, water_goal_ml, sleep_goal_h, weight_goal
)
select
  g.user_id,
  coalesce(
    g.phase_type,
    case g.goal_type when 'fat_loss' then 'cut' when 'muscle' then 'lean_bulk' else 'maintain' end
  ),
  coalesce(g.phase_start_date, current_date),
  g.calories_min, g.calories_max, g.protein_min, g.protein_max,
  g.steps_goal, g.water_goal_ml, g.sleep_goal_h, g.weight_goal
from public.forge_user_goals g
where not exists (select 1 from public.forge_goal_phases p where p.user_id = g.user_id);

-- ─────────────────────────────────────────────────────────────
-- 6. Backfill: lift existing steps/sleep habit logs into forge_daily_health
--
-- The habit tables stay untouched — this only seeds the new store so that
-- history does not appear to start on the day of the migration.
-- ─────────────────────────────────────────────────────────────
insert into public.forge_daily_health (user_id, log_date, steps, sleep_minutes, steps_source, sleep_source)
select
  l.user_id,
  l.log_date,
  max(case when h.key = 'steps' then l.value::integer end),
  max(case when h.key = 'sleep' then (l.value * 60)::integer end),
  'manual',
  'manual'
from public.forge_habit_logs l
join public.forge_habits h on h.id = l.habit_id
where h.key in ('steps', 'sleep') and l.value > 0
group by l.user_id, l.log_date
on conflict (user_id, log_date) do nothing;
