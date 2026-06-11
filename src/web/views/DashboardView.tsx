'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flame, Droplets, Footprints, Scale, CheckCircle2, Circle, ListChecks, Utensils, ArrowRight, Search, X, Check, Dumbbell } from 'lucide-react';
import { useTodayData } from '@/web/hooks/useTodayData';
import { ProgressRing } from '@/web/components/ProgressRing';
import { CardHead } from '@/web/components/CardHead';
import { formatDuration } from '@/domain/dates';
import { searchFood, estimateMacros, type FoodItem } from '@/domain/foodDatabase';
import type { Habit } from '@/domain/types';

function fmtWater(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l.toLocaleString('de-DE', { minimumFractionDigits: l % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} L`;
  }
  return `${ml} ml`;
}

function WaterDashRow({ habit, currentMl, onAddGlass }: { habit: Habit; currentMl: number; onAddGlass: () => void }) {
  const pct    = Math.min(100, Math.round((currentMl / habit.target) * 100));
  const glasses = Math.floor(currentMl / 250);
  return (
    <div className="habit-row">
      <div className={`habit-icon${pct >= 100 ? ' done' : ''}`}>
        <Droplets size={18} />
      </div>
      <div className="habit-body" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p className="h3">{habit.label}</p>
          <span style={{ fontSize: 11, color: 'var(--subtle)', flexShrink: 0 }}>{fmtWater(currentMl)} / {fmtWater(habit.target)}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
        <p className="copy" style={{ marginTop: 4, marginBottom: 0, fontSize: 11 }}>{glasses} {glasses === 1 ? 'Glas' : 'Gläser'}</p>
      </div>
      <button type="button" className="button secondary compact" onClick={onAddGlass} style={{ flexShrink: 0, marginLeft: 8 }}>+1</button>
    </div>
  );
}

function HabitQuickRow({ habit, log, onToggle }: { habit: Habit; log: { value: number; completed: boolean } | undefined; onToggle: (next: boolean) => void }) {
  const completed = log?.completed ?? false;
  return (
    <div className="habit-row">
      <div className={`habit-icon${completed ? ' done' : ''}`}>
        {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </div>
      <div className="habit-body">
        <p className="h3">{habit.label}</p>
        <p className="copy" style={{ marginTop: 0 }}>
          Ziel: {habit.target} {habit.unit}
        </p>
      </div>
      <button
        type="button"
        className={`habit-toggle${completed ? ' done' : ''}`}
        onClick={() => onToggle(!completed)}
        aria-label={completed ? 'Als offen markieren' : 'Als erledigt markieren'}
      >
        {completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
    </div>
  );
}

function WeeklyTrainingDots({ trainingDates }: { trainingDates: Set<string> }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + mondayOffset + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'flex-end', padding: '4px 0' }}>
      {days.map((date, i) => {
        const trained = trainingDates.has(date);
        const isToday = date === todayStr;
        const isPast = date < todayStr;
        return (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: trained ? 'var(--violet)' : isPast ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
              border: isToday ? '2px solid var(--violet)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>
              {trained ? <Check size={14} color="white" /> : (isToday ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)' }} /> : null)}
            </div>
            <span style={{ fontSize: 9, color: isToday ? 'var(--text)' : 'var(--subtle)', fontWeight: isToday ? 700 : 400 }}>
              {dayLabels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardView() {
  const { data, loading, error, toggleHabit, logNutrition, startSuggestedWorkout } = useTodayData();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [calorieInput, setCalorieInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 280 });
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const foodSearchRef = useRef<HTMLInputElement>(null);
  const foodSearchWrap = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDrop) return;
    function onDown(e: MouseEvent) {
      if (foodSearchWrap.current && !foodSearchWrap.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showDrop]);

  if (error && !data) {
    return (
      <div className="panel">
        <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="panel">
        <p className="copy">Dein Fortschritt wird geladen …</p>
      </div>
    );
  }

  const completedHabits = data.habits.filter((h) => data.todayLogs.get(h.id)?.completed).length;
  const habitPercent = data.habits.length > 0 ? Math.round((completedHabits / data.habits.length) * 100) : 0;

  const stepsHabit = data.habits.find((h) => h.key === 'steps');
  const stepsToday = stepsHabit ? data.todayLogs.get(stepsHabit.id)?.value ?? 0 : 0;

  async function handleStart() {
    setStarting(true);
    try {
      const sessionId = await startSuggestedWorkout();
      if (sessionId) router.push(`/workout/${sessionId}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleNutritionSave(e: React.FormEvent) {
    e.preventDefault();
    if (!calorieInput.trim() && !proteinInput.trim()) return;
    setSavingNutrition(true);
    try {
      const kcal     = Number(calorieInput) || 0;
      const proteinG = Number(proteinInput) || 0;
      const { carbsG, fatG } = selectedFood ? estimateMacros(selectedFood) : { carbsG: undefined, fatG: undefined };
      await logNutrition(kcal, proteinG, selectedFood?.name, carbsG, fatG);
      setCalorieInput('');
      setProteinInput('');
      setSelectedFood(null);
      setFoodQuery('');
    } finally {
      setSavingNutrition(false);
    }
  }

  function handleFoodSearch(q: string) {
    setFoodQuery(q);
    const results = q.trim().length >= 2 ? searchFood(q) : [];
    setFoodResults(results);
    if (results.length > 0 && foodSearchWrap.current) {
      const rect = foodSearchWrap.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setShowDrop(true);
    } else {
      setShowDrop(false);
    }
  }

  function selectFood(item: FoodItem) {
    setSelectedFood(item);
    setCalorieInput(String(item.kcal));
    setProteinInput(String(item.proteinG));
    setFoodQuery('');
    setFoodResults([]);
    setShowDrop(false);
  }

  return (
    <>
      <section className="hero-grid">
        <div className="panel accent">
          <p className="eyebrow">Heute</p>
          {data.activeSession ? (
            <>
              <h1 className="h1">Dein Training läuft.</h1>
              <p className="copy">{data.activeSession.dayName} · {data.activeSession.planName}</p>
              <div className="hero-actions">
                <Link href={`/workout/${data.activeSession.id}`} className="button">Training fortsetzen</Link>
              </div>
            </>
          ) : data.suggestedDay ? (
            <>
              <h1 className="h1">Bereit für {data.suggestedDay.name}?</h1>
              <p className="copy">
                {data.activePlan?.name} · {data.suggestedDay.exercises.length} Übungen geplant
              </p>
              <div className="hero-actions">
                <button type="button" className="button" onClick={handleStart} disabled={starting}>
                  {starting ? 'Wird gestartet …' : 'Training starten'}
                </button>
                <Link href="/plans" className="button secondary">Plan ansehen</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="h1">Leg los — wähle deinen ersten Plan.</h1>
              <p className="copy">Wähle einen vorgefertigten Plan oder erstelle deinen eigenen, um dein erstes Training zu starten.</p>
              <div className="hero-actions">
                <Link href="/plans" className="button">Plan auswählen</Link>
              </div>
            </>
          )}
        </div>

        <div className="panel soft" style={{ display: 'grid', gap: 16, justifyItems: 'center', alignContent: 'center' }}>
          <ProgressRing percent={habitPercent} value={`${completedHabits}/${data.habits.length}`} label="Gewohnheiten heute" />
          <div className="pill-row">
            <span className="pill streak"><Flame size={14} /> {data.dailyStreak} Tage Streak</span>
            <span className="pill streak"><Flame size={14} /> {data.trainingStreak} Tage Training</span>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        {(() => {
          const eaten = data.nutritionLog.calories;
          const goal = data.goals.calorieGoal;
          const balance = goal - eaten;
          const isOver = balance < 0;
          return (
            <div className="metric-card">
              <span className="metric-value" style={{ color: isOver ? 'var(--danger)' : 'var(--teal)', fontSize: 26 }}>
                {Math.abs(balance).toLocaleString('de-DE')}
              </span>
              <span className="metric-label">{isOver ? 'kcal über Ziel' : 'kcal noch frei'}</span>
              <span className="metric-label" style={{ fontSize: 10, marginTop: 2 }}>{eaten} / {goal} kcal</span>
            </div>
          );
        })()}
        <div className="metric-card">
          <span className="metric-value">{stepsToday ? Math.round(stepsToday).toLocaleString('de-DE') : '–'}</span>
          <span className="metric-label">Schritte · Ziel {stepsHabit ? Math.round(stepsHabit.target).toLocaleString('de-DE') : '–'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{data.latestMetric?.weightKg ?? '–'}</span>
          <span className="metric-label">Gewicht (kg){data.goals.weightGoal ? ` · Ziel ${data.goals.weightGoal}` : ''}</span>
        </div>
      </section>

      {/* ── Wochentraining ─────────────────────────────────────────────── */}
      <section className="panel soft">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dumbbell size={15} color="var(--violet)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Diese Woche</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              const dow = d.getDay();
              const off = dow === 0 ? -6 : 1 - dow;
              const day = new Date(d);
              day.setDate(d.getDate() + off + i);
              return day.toISOString().slice(0, 10);
            }).filter((date) => data.recentTrainingDates.has(date)).length} Trainings
          </span>
        </div>
        <WeeklyTrainingDots trainingDates={data.recentTrainingDates} />
      </section>

      <section className="split">
        <div className="panel">
          <div className="section-head">
            <CardHead icon={ListChecks} tone="violet" title="Gewohnheiten" />
            <Link href="/habits" className="card-link">Alle ansehen <ArrowRight size={14} /></Link>
          </div>
          <div className="list">
            {data.habits.slice(0, 4).map((habit) => {
              if (habit.key === 'water') {
                const currentMl = data.todayLogs.get(habit.id)?.value ?? 0;
                return (
                  <WaterDashRow
                    key={habit.id}
                    habit={habit}
                    currentMl={currentMl}
                    onAddGlass={() => {
                      const next = currentMl + 250;
                      void toggleHabit(habit, next, next >= habit.target);
                    }}
                  />
                );
              }
              return (
                <HabitQuickRow
                  key={habit.id}
                  habit={habit}
                  log={data.todayLogs.get(habit.id)}
                  onToggle={(next) => {
                    const log = data.todayLogs.get(habit.id);
                    void toggleHabit(habit, next ? habit.target : log?.value ?? 0, next);
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="panel">
          <CardHead icon={Utensils} tone="gold" title="Ernährung" />
          <p className="copy">
            Heute: <strong>{data.nutritionLog.calories} kcal</strong> · <strong>{data.nutritionLog.proteinG} g Protein</strong>
          </p>
          <div className="progress-track" style={{ marginTop: 14 }}>
            <div
              className="progress-fill gold"
              style={{ width: `${Math.min(100, (data.nutritionLog.calories / Math.max(1, data.goals.calorieGoal)) * 100)}%` }}
            />
          </div>
          <div className="progress-track" style={{ marginTop: 8 }}>
            <div
              className="progress-fill teal"
              style={{ width: `${Math.min(100, (data.nutritionLog.proteinG / Math.max(1, data.goals.proteinGoal)) * 100)}%` }}
            />
          </div>

          {/* Food search — fixed dropdown, same pattern as NutritionView */}
          <div ref={foodSearchWrap} style={{ marginTop: 14 }}>
            <div className="search-field" style={{ width: '100%' }}>
              <Search size={14} />
              <input
                ref={foodSearchRef}
                type="text"
                placeholder="Mahlzeit suchen …"
                value={foodQuery}
                onChange={(e) => handleFoodSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowDrop(false); setFoodQuery(''); setFoodResults([]); } }}
                aria-label="Mahlzeit suchen"
                autoComplete="off"
              />
              {foodQuery && (
                <button type="button" onClick={() => { setFoodQuery(''); setFoodResults([]); setShowDrop(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 2 }} aria-label="Suche löschen">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {/* Dropdown portal via position:fixed */}
          {showDrop && foodResults.length > 0 && (
            <div style={{
              position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 300,
              background: 'var(--panel, #16161b)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', maxHeight: 240, overflowY: 'auto',
            }}>
              {foodResults.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectFood(item); }}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: 'var(--text)', fontSize: 14 }}>{item.name}</span>
                    <span style={{ color: 'var(--subtle)', fontSize: 11, whiteSpace: 'nowrap' }}>{item.portionLabel}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--subtle)' }}>{item.kcal} kcal · {item.proteinG}g P</span>
                </button>
              ))}
            </div>
          )}
          {selectedFood && (
            <p className="copy" style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: 'var(--teal)' }}>
              ✓ {selectedFood.name} ausgewählt
            </p>
          )}

          <form className="button-row" style={{ marginTop: 10, alignItems: 'flex-end' }} onSubmit={handleNutritionSave}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" htmlFor="calories">Kalorien (kcal)</label>
              <input id="calories" className="input compact" inputMode="numeric" value={calorieInput} onChange={(e) => { setSelectedFood(null); setCalorieInput(e.target.value); }} placeholder="0" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" htmlFor="protein">Protein (g)</label>
              <input id="protein" className="input compact" inputMode="numeric" value={proteinInput} onChange={(e) => { setSelectedFood(null); setProteinInput(e.target.value); }} placeholder="0" />
            </div>
            <button type="submit" className="button secondary compact" disabled={savingNutrition || (!calorieInput.trim() && !proteinInput.trim())}>
              {savingNutrition ? '…' : 'Hinzufügen'}
            </button>
          </form>
        </div>
      </section>

      {data.trainingStreak > 0 && (
        <section className="panel soft">
          <div className="section-head">
            <CardHead icon={Flame} tone="gold" title="Dein Fortschritt spricht für sich" />
          </div>
          <div className="list">
            <p className="check-line"><Flame size={16} /> {data.trainingStreak} {data.trainingStreak === 1 ? 'Tag' : 'Tage'} am Stück trainiert</p>
            <p className="check-line"><Droplets size={16} /> {data.weeklyTrainingStreak} {data.weeklyTrainingStreak === 1 ? 'Woche' : 'Wochen'} mit mind. 3 Trainings</p>
            {data.activeSession?.durationSeconds && (
              <p className="check-line"><Footprints size={16} /> Letztes Training: {formatDuration(data.activeSession.durationSeconds)}</p>
            )}
            {data.latestMetric?.weightKg && (
              <p className="check-line"><Scale size={16} /> Aktuelles Gewicht: {data.latestMetric.weightKg} kg</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
