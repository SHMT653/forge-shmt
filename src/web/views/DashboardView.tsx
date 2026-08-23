'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Flame, Dumbbell, Plus, Trophy, Scale, Camera, ArrowRight, ListChecks, Activity,
} from 'lucide-react';
import { useTodayContext } from '@/web/hooks/TodayDataProvider';
import { DayRings, type RingSpec } from '@/web/components/DayRings';
import { DailyTimeline, mealToEvent, type TimelineEvent } from '@/web/components/DailyTimeline';
import { QuickAddSheet } from '@/web/components/QuickAddSheet';
import { QuickTextInput } from '@/web/components/QuickTextInput';
import { SorenessPicker } from '@/web/components/SorenessPicker';
import { GoalCard } from '@/web/components/GoalCard';
import { SourceBadge } from '@/web/components/SourceBadge';
import { RestOfDayCard } from '@/web/components/RestOfDayCard';
import { DayStatsCard } from '@/web/components/DayStatsCard';
import { OnboardingView } from '@/web/views/OnboardingView';
import { evaluateRange, TONE_COLOR } from '@/domain/goalPhase';
import { isDayInProgress } from '@/domain/dayEvaluation';
import { macrosForServings } from '@/domain/nutritionMath';
import { saveBodyMetric } from '@/data/progress';
import { startMiniSession } from '@/data/workouts';
import { suggestMiniSession } from '@/domain/miniSessions';
import { useHealth } from '@/web/hooks/useHealth';
import { useAuth } from '@/web/hooks/useAuth';
import { todayKey } from '@/domain/dates';
import type { MealEntryInput } from '@/data/nutrition';

function todayLabel(): string {
  return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function DashboardView() {
  const { data, loading, error, addEntry, removeEntry, addWater, setMetric, setSoreness, saveFood, startSuggestedWorkout, reload } =
    useTodayContext();
  const { user } = useAuth();
  const router = useRouter();
  // Pull fresh health data on mount and on app resume (§12). Resolves to a
  // no-op in the browser.
  const health = useHealth({ autoSync: true });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [doneBanner, setDoneBanner] = useState<{ exercises: number } | null>(null);

  // Post-workout redirect banner
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('done') !== '1') return;
    setDoneBanner({ exercises: Number(params.get('exercises') ?? '0') });
    const url = new URL(window.location.href);
    url.searchParams.delete('done');
    url.searchParams.delete('exercises');
    window.history.replaceState({}, '', url.pathname);
    const timer = setTimeout(() => setDoneBanner(null), 8000);
    return () => clearTimeout(timer);
  }, []);

  const timeline: TimelineEvent[] = useMemo(() => {
    if (!data) return [];
    const events: TimelineEvent[] = data.entries.map((entry) =>
      mealToEvent(entry, {
        onDelete: () => void removeEntry(entry.id),
        onDuplicate: () =>
          void addEntry({
            name: entry.name,
            macros: { kcal: entry.kcal, proteinG: entry.proteinG, carbsG: entry.carbsG, fatG: entry.fatG },
            dataQuality: entry.dataQuality,
            servings: entry.servings,
            slot: entry.slot,
            source: entry.source,
            foodItemId: entry.foodItemId,
            recipeId: entry.recipeId,
          }),
      }),
    );

    if (data.activeSession?.startedAt) {
      events.push({
        id: `session-${data.activeSession.id}`,
        at: data.activeSession.startedAt,
        icon: '🏋️',
        title: `${data.activeSession.dayName} — läuft`,
        meta: data.activeSession.planName,
        tone: 'var(--violet)',
      });
    }
    return events;
  }, [data, addEntry, removeEntry]);

  if (error && !data) {
    return (
      <div className="panel">
        <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>
        <button type="button" className="button secondary compact" style={{ marginTop: 12 }} onClick={() => void reload()}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="panel">
        <p className="copy">Dein Tag wird geladen …</p>
      </div>
    );
  }

  // First run: ask for goals before showing a dashboard full of defaults (§26).
  if (!data.goals.onboardedAt) {
    return <OnboardingView goals={data.goals} onDone={() => void reload()} />;
  }

  const { targets, totals, metrics, dayStatus } = data;
  const inProgress = isDayInProgress(new Date().getHours());
  const kcalEval = evaluateRange(totals.kcal, targets.calories, { dayInProgress: inProgress });
  const proteinEval = evaluateRange(totals.proteinG, targets.protein, { dayInProgress: inProgress, overTolerance: 9999 });
  const proteinLeft = Math.max(0, targets.protein.min - totals.proteinG);

  // Each metric keeps its own colour so a glance says which one is short.
  const rings: RingSpec[] = [
    {
      key: 'calories',
      label: 'Kalorien',
      fraction: totals.kcal / Math.max(1, targets.calories.max),
      color: 'var(--violet)',
      value: Math.round(totals.kcal).toLocaleString('de-DE'),
      target: `von ${targets.calories.max.toLocaleString('de-DE')}`,
      over: kcalEval.status === 'over' || kcalEval.status === 'slightly_over',
    },
    {
      key: 'protein',
      label: 'Protein',
      fraction: totals.proteinG / Math.max(1, targets.protein.min),
      color: 'var(--teal)',
      value: `${Math.round(totals.proteinG)} g`,
      target: `von ${targets.protein.min} g`,
    },
    {
      key: 'steps',
      label: 'Schritte',
      fraction: metrics.steps / Math.max(1, targets.steps),
      color: 'var(--gold)',
      value: Math.round(metrics.steps).toLocaleString('de-DE'),
      target: `von ${targets.steps.toLocaleString('de-DE')}`,
    },
  ];

  async function handleStartWorkout() {
    setStarting(true);
    try {
      const sessionId = await startSuggestedWorkout();
      if (sessionId) router.push(`/workout/${sessionId}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleStartMini() {
    if (!user || !data) return;
    setStarting(true);
    try {
      const session = suggestMiniSession(data.goals.equipment);
      const sessionId = await startMiniSession(user.id, session.name, session.exercises);
      router.push(`/workout/${sessionId}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleWeight(kg: number) {
    if (!user) return;
    await saveBodyMetric(user.id, todayKey(), { weightKg: kg, waistCm: null, chestCm: null, armsCm: null });
    await reload();
  }

  /** Resolves a quick-add proposal against real stored macros where possible. */
  function handleEntry(entry: MealEntryInput) {
    if (entry.recipeId) {
      const recipe = data?.allRecipes.find((r) => r.id === entry.recipeId);
      if (recipe) {
        void addEntry({ ...entry, macros: macrosForServings(recipe, entry.servings ?? 1), dataQuality: 'verified' });
        return;
      }
    }
    if (entry.foodItemId) {
      const food = data?.allFoods.find((f) => f.id === entry.foodItemId);
      if (food) {
        const servings = entry.servings ?? 1;
        void addEntry({
          ...entry,
          macros: {
            kcal: Math.round(food.macros.kcal * servings),
            proteinG: Math.round(food.macros.proteinG * servings),
            carbsG: Math.round(food.macros.carbsG * servings),
            fatG: Math.round(food.macros.fatG * servings),
          },
          dataQuality: food.dataQuality,
        });
        return;
      }
    }
    void addEntry(entry);
  }

  function handleMetric(metric: 'steps' | 'water_ml' | 'sleep_h' | 'weight_kg', value: number) {
    if (metric === 'steps') void setMetric('steps', value);
    else if (metric === 'water_ml') void setMetric('water', (data?.metrics.waterMl ?? 0) + value);
    else if (metric === 'sleep_h') void setMetric('sleep', value);
    else void handleWeight(value);
  }

  return (
    <>
      {doneBanner && (
        <div className="panel accent" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
          <Trophy size={20} color="var(--violet)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="h3" style={{ fontSize: 14 }}>Training abgeschlossen</p>
            <p className="muted-sm">{doneBanner.exercises} Übungen · denk an dein Protein.</p>
          </div>
        </div>
      )}

      {/* ── Day header + the two numbers that matter most (§62) ──────── */}
      <section className="panel">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p className="section-label">Heute</p>
            <p className="h2" style={{ marginTop: 4, fontSize: 19 }}>{todayLabel()}</p>
          </div>
          <span className="pill" style={{ flexShrink: 0 }}>{targets.phase.label}</span>
        </div>

        <DayRings
          rings={rings}
          score={data.dayScore.score}
          scoreTone={
            data.dayScore.score >= 7.5 ? 'green' : data.dayScore.score >= 5 ? 'yellow' : 'red'
          }
        />

        {(metrics.sources.steps === 'apple_health' || metrics.sources.sleep === 'apple_health') && (
          <p className="muted-sm" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <SourceBadge source="apple_health" />
            Schritte und Schlaf kommen automatisch aus Apple Health
            {health.state.syncing ? ' · wird aktualisiert …' : ''}
          </p>
        )}
      </section>

      {/* ── What is still open today ──────────────────────────────────── */}
      <RestOfDayCard
        consumed={totals}
        metrics={{ steps: metrics.steps, waterMl: metrics.waterMl }}
        targets={targets}
        entryCount={data.entries.length}
        candidates={[
          ...data.allFoods.map((f) => ({ id: f.id, name: f.name, macros: f.macros, kind: 'food' as const })),
          ...data.allRecipes.map((r) => ({ id: r.id, name: r.name, macros: r.perServing, kind: 'recipe' as const })),
        ]}
        onAdd={handleEntry}
        onAddWater={addWater}
      />

      {/* ── Primary action + quick input (§36) ────────────────────────── */}
      <section className="stack-sm">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="button" style={{ flex: 1 }} onClick={() => setSheetOpen(true)}>
            <Plus size={17} /> Eintragen
          </button>
          {data.activeSession ? (
            <Link href={`/workout/${data.activeSession.id}`} className="button secondary">
              <Activity size={17} /> Weiter
            </Link>
          ) : (
            <button
              type="button"
              className="button secondary"
              onClick={handleStartWorkout}
              disabled={starting || !data.suggestedDay}
              aria-label="Training starten"
            >
              <Dumbbell size={17} />
            </button>
          )}
        </div>

        <QuickTextInput
          onAdd={handleEntry}
          onMetric={handleMetric}
          library={[
            ...data.allFoods.map((f) => ({ id: f.id, kind: 'food' as const, name: f.name })),
            ...data.allRecipes.map((r) => ({ id: r.id, kind: 'recipe' as const, name: r.name })),
          ]}
        />
      </section>

      {/* ── Reminders (§26/§27) — one line, not two cards ───────────── */}
      {(data.weighInDue || data.photoDue) && (
        <Link href="/progress" className="habit-row" style={{ textDecoration: 'none', padding: '10px 14px' }}>
          <span className="habit-icon" style={{ width: 32, height: 32 }}>
            {data.weighInDue ? <Scale size={15} /> : <Camera size={15} />}
          </span>
          <div className="habit-body">
            <p className="h3" style={{ fontSize: 13 }}>
              {data.weighInDue && data.photoDue
                ? 'Wiegen und Fortschrittsbilder sind dran'
                : data.weighInDue
                  ? 'Wochen-Check-In fällig'
                  : 'Fortschrittsbilder sind dran'}
            </p>
          </div>
          <ArrowRight size={15} color="var(--subtle)" />
        </Link>
      )}

      {/* ── Training today ────────────────────────────────────────────── */}
      <section className="panel soft">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Dumbbell size={15} color="var(--violet)" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Training</span>
          </div>
          <span className="muted-sm">
            {data.fullWorkoutsThisWeek} Einheiten diese Woche
            {data.miniSessionsThisWeek > 0 ? ` · ${data.miniSessionsThisWeek} Mini` : ''}
          </span>
        </div>

        {data.coach.training.trainedToday ? (
          <p className="copy" style={{ margin: 0, fontSize: 13 }}>Heute erledigt. Gut gemacht.</p>
        ) : (
          <div className="stack-sm">
            <p className="copy" style={{ margin: 0, fontSize: 13 }}>
              {data.suggestedDay ? `Geplant: ${data.suggestedDay.name}` : 'Noch kein Plan aktiv.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="button compact"
                onClick={handleStartWorkout}
                disabled={starting || !data.suggestedDay}
                style={{ flex: 1 }}
              >
                {starting ? '…' : 'Training starten'}
              </button>
              <button type="button" className="button secondary compact" onClick={handleStartMini} disabled={starting} style={{ flex: 1 }}>
                Mini-Session
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <SorenessPicker value={data.checkin?.soreness ?? null} onChange={(next) => void setSoreness(next)} />
        </div>
      </section>

      {/* ── Timeline (§9) ─────────────────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListChecks size={16} color="var(--violet)" />
            <p className="h3" style={{ fontSize: 15 }}>Tagesverlauf</p>
          </div>
          <Link href="/nutrition" className="card-link">Ernährung <ArrowRight size={14} /></Link>
        </div>
        <DailyTimeline events={timeline} />
      </section>

      {/* ── Details on demand ────────────────────────────────────────
          Goal, full statistics and the longer insight list are reference, not
          things to act on. Ten stacked cards made the screen unreadable; these
          three now sit one tap away. */}
      <details className="detail-fold">
        <summary>Details ansehen</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <GoalCard targets={targets} phase={data.activePhase} />

          <DayStatsCard
            totals={totals}
            metrics={{
              steps: metrics.steps,
              waterMl: metrics.waterMl,
              sleepH: metrics.sleepH,
              activeEnergyKcal: metrics.activeEnergyKcal,
              walkingDistanceM: metrics.walkingDistanceM,
            }}
            targets={targets}
            weekly={data.weekly}
            dayInProgress={inProgress}
          />

        </div>
      </details>

      {/* ── Sheets ────────────────────────────────────────────────────── */}
      {sheetOpen && (
        <QuickAddSheet
          onClose={() => setSheetOpen(false)}
          favoriteFoods={data.favoriteFoods}
          favoriteRecipes={data.favoriteRecipes}
          allFoods={data.allFoods}
          allRecipes={data.allRecipes}
          recentMeals={data.recentMeals}
          batches={data.batches}
          currentWater={metrics.waterMl}
          currentSteps={metrics.steps}
          currentSleep={metrics.sleepH}
          currentWeight={data.weight.latest}
          handlers={{
            onAddEntry: handleEntry,
            onSaveFood: saveFood,
            onAddWater: addWater,
            onSetSteps: (steps) => setMetric('steps', steps),
            onSetSleep: (hours) => setMetric('sleep', hours),
            onSaveWeight: handleWeight,
            onStartWorkout: handleStartWorkout,
            onStartMini: handleStartMini,
          }}
        />
      )}


    </>
  );
}
