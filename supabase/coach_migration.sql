-- ═══════════════════════════════════════════════════════════════════════════
-- FORGE — "Coach" migration
--
-- Turns FORGE from a tracker into a coach. Purely ADDITIVE: every statement is
-- idempotent (`if not exists` / `on conflict do nothing`), no column is ever
-- dropped or retyped, so existing workouts, weights, meals, habits and settings
-- survive untouched. Safe to re-run.
--
-- Run in: Supabase SQL editor → New query → Run.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. Goal phases — replace the single hard calorie number with a RANGE
--
-- Legacy `calorie_goal` / `protein_goal` stay as-is and act as the fallback
-- when the min/max columns are null (see src/domain/goalPhase.ts), so nothing
-- breaks for a user who has not opened the new settings yet.
-- ─────────────────────────────────────────────────────────────
alter table public.forge_user_goals
  add column if not exists phase_type        text,      -- 'cut'|'recomp'|'maintain'|'lean_bulk'
  add column if not exists phase_start_date  date,
  add column if not exists phase_end_date    date,
  add column if not exists calories_min      integer,
  add column if not exists calories_max      integer,
  add column if not exists protein_min       integer,
  add column if not exists protein_max       integer,
  add column if not exists steps_goal        integer,
  add column if not exists water_goal_ml     integer,
  add column if not exists sleep_goal_h      numeric,
  -- tracking routine
  add column if not exists weigh_in_weekday  integer,   -- 0=Sun … 6=Sat, default Sunday
  add column if not exists photo_interval_days integer, -- default 14
  add column if not exists progress_start_date date,
  -- feature switches
  add column if not exists fasting_enabled   boolean not null default false,
  add column if not exists ai_coach_enabled  boolean not null default true,
  add column if not exists ai_parsing_enabled boolean not null default true,
  add column if not exists units             text not null default 'metric'; -- 'metric'|'imperial'

-- Users who already picked a fasting protocol keep it switched on.
update public.forge_user_goals
   set fasting_enabled = true
 where fasting_protocol is not null and fasting_enabled = false;

-- ─────────────────────────────────────────────────────────────
-- 2. Food library — the user's own products (§12, §35)
--    This is the database the AI must search BEFORE it estimates anything.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_food_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  brand         text not null default '',
  serving_label text not null default '1 Portion',
  serving_g     numeric,
  kcal          numeric not null default 0,
  protein_g     numeric not null default 0,
  carbs_g       numeric not null default 0,
  fat_g         numeric not null default 0,
  -- 'verified' = barcode / packaging / user-confirmed, 'estimated' = guessed
  data_quality  text not null default 'verified',
  barcode       text,
  favorite      boolean not null default false,
  use_count     integer not null default 0,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists forge_food_items_user      on public.forge_food_items (user_id);
create index if not exists forge_food_items_name_lower on public.forge_food_items (user_id, lower(name));
create unique index if not exists forge_food_items_barcode_uniq
  on public.forge_food_items (user_id, barcode) where barcode is not null;

alter table public.forge_food_items enable row level security;
drop policy if exists "forge_food_items_all_own" on public.forge_food_items;
create policy "forge_food_items_all_own" on public.forge_food_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Recipes + ingredients (§12) and meal-prep batches (§13)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  total_servings numeric not null default 1 check (total_servings > 0),
  serving_label  text not null default 'Portion',
  is_meal_prep   boolean not null default false,
  favorite       boolean not null default false,
  notes          text not null default '',
  use_count      integer not null default 0,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.forge_recipe_ingredients (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references public.forge_recipes (id) on delete cascade,
  food_item_id uuid references public.forge_food_items (id) on delete set null,
  name         text not null,
  amount_label text not null default '',
  kcal         numeric not null default 0,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  order_index  integer not null default 0
);

-- A cooked batch: "Chicken Pasta, 2 Portionen, 1 davon gegessen"
create table if not exists public.forge_meal_prep_batches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  recipe_id      uuid not null references public.forge_recipes (id) on delete cascade,
  cooked_on      date not null default current_date,
  total_portions numeric not null check (total_portions > 0),
  portions_used  numeric not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists forge_recipes_user       on public.forge_recipes (user_id);
create index if not exists forge_recipe_ing_recipe  on public.forge_recipe_ingredients (recipe_id);
create index if not exists forge_prep_user_active   on public.forge_meal_prep_batches (user_id, active);

alter table public.forge_recipes            enable row level security;
alter table public.forge_recipe_ingredients enable row level security;
alter table public.forge_meal_prep_batches  enable row level security;

drop policy if exists "forge_recipes_all_own" on public.forge_recipes;
create policy "forge_recipes_all_own" on public.forge_recipes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "forge_recipe_ing_all_own" on public.forge_recipe_ingredients;
create policy "forge_recipe_ing_all_own" on public.forge_recipe_ingredients for all
  using (exists (select 1 from public.forge_recipes r
                  where r.id = forge_recipe_ingredients.recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.forge_recipes r
                  where r.id = forge_recipe_ingredients.recipe_id and r.user_id = auth.uid()));

drop policy if exists "forge_prep_all_own" on public.forge_meal_prep_batches;
create policy "forge_prep_all_own" on public.forge_meal_prep_batches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Meal entries gain provenance (§11 data quality, §9 timeline)
-- ─────────────────────────────────────────────────────────────
alter table public.forge_meal_entries
  add column if not exists food_item_id  uuid references public.forge_food_items (id) on delete set null,
  add column if not exists recipe_id     uuid references public.forge_recipes (id) on delete set null,
  add column if not exists batch_id      uuid references public.forge_meal_prep_batches (id) on delete set null,
  add column if not exists servings      numeric not null default 1,
  add column if not exists data_quality  text not null default 'verified',
  add column if not exists kcal_min      numeric,   -- range for 'estimated'/'unknown' entries
  add column if not exists kcal_max      numeric,
  add column if not exists meal_slot     text,      -- 'breakfast'|'lunch'|'dinner'|'snack'
  add column if not exists source        text not null default 'manual';

create index if not exists forge_meal_entries_user_date on public.forge_meal_entries (user_id, log_date);

-- ─────────────────────────────────────────────────────────────
-- 5. Daily check-in — soreness / energy drive the training advice (§22)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_daily_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  log_date      date not null,
  soreness      text,        -- 'none'|'light'|'medium'|'strong'
  soreness_area text not null default '',
  energy        integer,     -- 1..5
  note          text not null default '',
  updated_at    timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.forge_daily_checkins enable row level security;
drop policy if exists "forge_daily_checkins_all_own" on public.forge_daily_checkins;
create policy "forge_daily_checkins_all_own" on public.forge_daily_checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 6. Body metrics gain BIA fields (§29) — all flagged as estimates in the UI
-- ─────────────────────────────────────────────────────────────
alter table public.forge_body_metrics
  add column if not exists body_fat_pct        numeric,
  add column if not exists fat_mass_kg         numeric,
  add column if not exists lean_mass_kg        numeric,
  add column if not exists muscle_mass_kg      numeric,
  add column if not exists muscle_rate_pct     numeric,
  add column if not exists skeletal_muscle_pct numeric,
  add column if not exists body_water_pct      numeric,
  add column if not exists visceral_fat        numeric,
  add column if not exists bmr                 integer,
  add column if not exists bmi                 numeric,
  add column if not exists source              text not null default 'manual'; -- 'manual'|'bia'

-- ─────────────────────────────────────────────────────────────
-- 7. Progress photos gain a pose (§27/§28 side-by-side comparison)
-- ─────────────────────────────────────────────────────────────
alter table public.forge_progress_photos
  add column if not exists pose      text not null default 'front', -- 'front'|'side'|'back'|'front_flexed'
  add column if not exists weight_kg numeric;

-- ─────────────────────────────────────────────────────────────
-- 8. Workouts: mini sessions (§19) + richer set recording (§20)
-- ─────────────────────────────────────────────────────────────
alter table public.forge_workout_sessions
  add column if not exists kind            text not null default 'full', -- 'full'|'mini'
  add column if not exists soreness_before text,
  add column if not exists notes           text not null default '';

alter table public.forge_session_sets
  add column if not exists duration_seconds integer,  -- planks, holds
  add column if not exists resistance       text,     -- band colour / level
  add column if not exists rir              integer;  -- reps in reserve

create index if not exists forge_sessions_user_completed
  on public.forge_workout_sessions (user_id, completed_at desc);

-- ─────────────────────────────────────────────────────────────
-- 9. Coach memory — facts the coach should remember across sessions (§35)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_coach_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null default 'fact',  -- 'fact'|'preference'|'constraint'
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.forge_coach_notes enable row level security;
drop policy if exists "forge_coach_notes_all_own" on public.forge_coach_notes;
create policy "forge_coach_notes_all_own" on public.forge_coach_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 10. Weekly review snapshots (§30) — cached so the Sunday report is stable
-- ─────────────────────────────────────────────────────────────
create table if not exists public.forge_weekly_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_start  date not null,          -- Monday
  summary     jsonb not null default '{}'::jsonb,
  coach_text  text not null default '',
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.forge_weekly_reviews enable row level security;
drop policy if exists "forge_weekly_reviews_all_own" on public.forge_weekly_reviews;
create policy "forge_weekly_reviews_all_own" on public.forge_weekly_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
