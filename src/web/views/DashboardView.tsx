'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dumbbell, Trophy, Scale, Camera, ArrowRight, ListChecks, Activity,
} from 'lucide-react';
import { useTodayContext } from '@/web/hooks/TodayDataProvider';
import { DayRings, type RingSpec } from '@/web/components/DayRings';
import { DailyTimeline, mealToEvent, type TimelineEvent } from '@/web/components/DailyTimeline';
import { QuickAddSheet } from '@/web/components/QuickAddSheet';
import { SorenessPicker } from '@/web/components/SorenessPicker';
import { GoalCard } from '@/web/components/GoalCard';
import { DayStatsCard } from '@/web/components/DayStatsCard';
import { OnboardingView } from '@/web/views/OnboardingView';
import { evaluateRange } from '@/domain/goalPhase';
import { isDayInProgress } from '@/domain/dayEvaluation';
import { saveBodyMetric } from '@/data/progress';
import { startMiniSession } from '@/data/workouts';
import { suggestMiniSession } from '@/domain/miniSessions';
import { useAuth } from '@/web/hooks/useAuth';
import { todayKey } from '@/domain/dates';
import type { MealEntryInput } from '@/data/nutrition';

function todayLabel(): string {
  return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

const FOREGROUND_RELOAD_INTERVAL_MS = 60_000;

export function DashboardView() {
  const { data, loading, error, addEntry, removeEntry, addWater, setMetric, setSoreness, saveFood, setFoodFavorite, startSuggestedWorkout, reload } =
    useTodayContext();
  const { user } = useAuth();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [doneBanner, setDoneBanner] = useState<{ exercises: number } | null>(null);
  const lastForegroundReload = useRef(0);

  // Pull fresh health data when the installed app comes back to the foreground.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    lastForegroundReload.current = Date.now();

    const refreshVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundReload.current < FOREGROUND_RELOAD_INTERVAL_MS) return;
      lastForegroundReload.current = now;
      void reload();
    };

    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
    };
  }, [reload]);

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
            kcalMin: entry.kcalMin,
            kcalMax: entry.kcalMax,
            servings: entry.servings,
            slot: entry.slot,
            source: entry.source,
            foodItemId: entry.foodItemId,
            recipeId: entry.recipeId,
            batchId: entry.batchId,
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

  const { targets, totals, metrics, readiness } = data;
  const inProgress = isDayInProgress(new Date().getHours());
  const kcalEval = evaluateRange(totals.kcal, targets.calories, { dayInProgress: inProgress });

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

      </section>

      {/* ── Reminders (§26/§27) — one line, not two cards ───────────── */}
      {(data.weighInDue || data.photoDue) && (
        <Link href="/progress" prefetch={false} className="habit-row" style={{ textDecoration: 'none', padding: '10px 14px' }}>
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

        {/* What to do today, and the arithmetic behind it — week slack against
            what the body has been reporting (§ domain/trainingReadiness). */}
        <div className="readiness">
          <p className={`readiness-headline tone-${readiness.state}`}>{readiness.headline}</p>
          <p className="readiness-detail">{readiness.detail}</p>

          {readiness.state === 'running' && data.activeSession && (
            <Link href={`/workout/${data.activeSession.id}`} prefetch={false} className="button compact" style={{ marginTop: 10 }}>
              <Activity size={15} /> Weitermachen
            </Link>
          )}

          {readiness.offerStart && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {!readiness.preferMini && (
                <button
                  type="button"
                  className="button compact"
                  onClick={handleStartWorkout}
                  disabled={starting || !data.suggestedDay}
                  style={{ flex: 1 }}
                >
                  {starting ? '…' : 'Training starten'}
                </button>
              )}
              <button
                type="button"
                className={`button compact${readiness.preferMini ? '' : ' secondary'}`}
                onClick={handleStartMini}
                disabled={starting}
                style={{ flex: 1 }}
              >
                Mini-Session
              </button>
              {readiness.preferMini && readiness.state !== 'rest' && data.suggestedDay && (
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={handleStartWorkout}
                  disabled={starting}
                  style={{ flex: 1 }}
                >
                  Trotzdem voll
                </button>
              )}
            </div>
          )}
        </div>

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
          <Link href="/nutrition" prefetch={false} className="card-link">Ernährung <ArrowRight size={14} /></Link>
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
          allFoods={data.allFoods}
          recentMeals={data.recentMeals}
          currentWater={metrics.waterMl}
          currentSteps={metrics.steps}
          currentSleep={metrics.sleepH}
          currentWeight={data.weight.latest}
          handlers={{
            onAddEntry: handleEntry,
            onSaveFood: saveFood,
            onSetFavorite: setFoodFavorite,
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
