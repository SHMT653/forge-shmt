-- FORGE by SHMT — database schema
-- Run in the Supabase SQL editor (or via the CLI) on a fresh project.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- training plans
-- ─────────────────────────────────────────────────────────────
create table training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  focus text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans (id) on delete cascade,
  name text not null,
  order_index integer not null default 0
);

create table plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references plan_days (id) on delete cascade,
  name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

alter table training_plans enable row level security;
alter table plan_days enable row level security;
alter table plan_exercises enable row level security;

create policy "training_plans_all_own" on training_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plan_days_all_own" on plan_days for all
  using (exists (select 1 from training_plans p where p.id = plan_days.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from training_plans p where p.id = plan_days.plan_id and p.user_id = auth.uid()));

create policy "plan_exercises_all_own" on plan_exercises for all
  using (exists (
    select 1 from plan_days d join training_plans p on p.id = d.plan_id
    where d.id = plan_exercises.plan_day_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from plan_days d join training_plans p on p.id = d.plan_id
    where d.id = plan_exercises.plan_day_id and p.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- workout sessions
-- ─────────────────────────────────────────────────────────────
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references training_plans (id) on delete set null,
  plan_day_id uuid references plan_days (id) on delete set null,
  plan_name text not null default '',
  day_name text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer
);

create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions (id) on delete cascade,
  exercise_name text not null,
  target_sets integer not null default 3,
  target_reps text not null default '8-12',
  order_index integer not null default 0
);

create table session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references session_exercises (id) on delete cascade,
  set_index integer not null default 0,
  reps integer,
  weight_kg numeric,
  completed boolean not null default false
);

alter table workout_sessions enable row level security;
alter table session_exercises enable row level security;
alter table session_sets enable row level security;

create policy "workout_sessions_all_own" on workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_exercises_all_own" on session_exercises for all
  using (exists (select 1 from workout_sessions s where s.id = session_exercises.session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions s where s.id = session_exercises.session_id and s.user_id = auth.uid()));

create policy "session_sets_all_own" on session_sets for all
  using (exists (
    select 1 from session_exercises e join workout_sessions s on s.id = e.session_id
    where e.id = session_sets.session_exercise_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from session_exercises e join workout_sessions s on s.id = e.session_id
    where e.id = session_sets.session_exercise_id and s.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- habits
-- ─────────────────────────────────────────────────────────────
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  unit text not null default '',
  target numeric not null default 1,
  order_index integer not null default 0,
  active boolean not null default true
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  value numeric not null default 0,
  completed boolean not null default false,
  unique (habit_id, log_date)
);

alter table habits enable row level security;
alter table habit_logs enable row level security;

create policy "habits_all_own" on habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "habit_logs_all_own" on habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- body progress
-- ─────────────────────────────────────────────────────────────
create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  arms_cm numeric,
  unique (user_id, log_date)
);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_at date not null default current_date,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table body_metrics enable row level security;
alter table progress_photos enable row level security;

create policy "body_metrics_all_own" on body_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "progress_photos_all_own" on progress_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- nutrition / goals
-- ─────────────────────────────────────────────────────────────
create table user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2200,
  protein_goal integer not null default 150,
  weight_goal numeric
);

create table nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  calories integer not null default 0,
  protein_g integer not null default 0,
  unique (user_id, log_date)
);

alter table user_goals enable row level security;
alter table nutrition_logs enable row level security;

create policy "user_goals_all_own" on user_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "nutrition_logs_all_own" on nutrition_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- storage: progress photos (per-user folder, e.g. "<uid>/2026-06-08.jpg")
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress_photos_storage_own"
  on storage.objects for all
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);
