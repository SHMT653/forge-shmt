'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Flame, Droplets, Plus } from 'lucide-react';
import { useHabits } from '@/web/hooks/useHabits';
import { dateKeyAddDays, formatRelativeDay, todayKey } from '@/domain/dates';
import type { Habit } from '@/domain/types';

const HISTORY_LENGTH = 7;
const GLASS_ML = 250;

function fmtWater(ml: number): string {
  if (ml >= 1000) {
    const l = ml / 1000;
    return `${l.toLocaleString('de-DE', { minimumFractionDigits: l % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} L`;
  }
  return `${ml} ml`;
}

function WaterCard({
  habit,
  logsByDate,
  streak,
  onLog,
}: {
  habit: Habit;
  logsByDate: Map<string, { value: number; completed: boolean }>;
  streak: number;
  onLog: (logDate: string, value: number, completed: boolean) => void;
}) {
  const today = todayKey();
  const todayLog = logsByDate.get(today);
  const currentMl = todayLog?.value ?? 0;
  const glasses = Math.floor(currentMl / GLASS_ML);
  const totalMl = habit.target;
  const pct = Math.min(100, Math.round((currentMl / totalMl) * 100));

  const days = Array.from({ length: HISTORY_LENGTH }, (_, i) => dateKeyAddDays(today, -(HISTORY_LENGTH - 1 - i)));

  function addGlass() {
    const next = currentMl + GLASS_ML;
    onLog(today, next, next >= totalMl);
  }

  function removeGlass() {
    const next = Math.max(0, currentMl - GLASS_ML);
    onLog(today, next, next >= totalMl);
  }

  return (
    <div className="habit-row" style={{ alignItems: 'flex-start' }}>
      <div className={`habit-icon${todayLog?.completed ? ' done' : ''}`}>
        <Droplets size={18} />
      </div>
      <div className="habit-body" style={{ flex: 1 }}>
        <div className="button-row" style={{ justifyContent: 'space-between' }}>
          <p className="h3">{habit.label}</p>
          {streak > 0 && (
            <span className="pill streak"><Flame size={12} /> {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
          )}
        </div>

        <div style={{ marginTop: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--violet)', borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
            <span className="copy" style={{ margin: 0, minWidth: 80, textAlign: 'right', color: 'var(--text)' }}>
              {fmtWater(currentMl)} / {fmtWater(totalMl)}
            </span>
          </div>
          <p className="copy" style={{ marginTop: 4, marginBottom: 0 }}>
            {glasses} {glasses === 1 ? 'Glas' : 'Gläser'} getrunken ({pct}%)
          </p>
        </div>

        <div className="button-row" style={{ gap: 8 }}>
          <button
            type="button"
            className="button compact"
            onClick={addGlass}
            style={{ flex: 1 }}
          >
            <Plus size={16} /> +1 Glas (250 ml)
          </button>
          {currentMl > 0 && (
            <button type="button" className="button ghost compact" onClick={removeGlass} aria-label="Glas entfernen">
              −
            </button>
          )}
        </div>

        <div className="pill-row" style={{ marginTop: 8 }}>
          {days.map((day) => {
            const log = logsByDate.get(day);
            return (
              <span key={day} className={`pill${log?.completed ? ' streak' : ''}`} title={formatRelativeDay(day)}>
                {formatRelativeDay(day).slice(0, 2)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HabitCard({
  habit,
  logsByDate,
  streak,
  onLog,
}: {
  habit: Habit;
  logsByDate: Map<string, { value: number; completed: boolean }>;
  streak: number;
  onLog: (logDate: string, value: number, completed: boolean) => void;
}) {
  const today = todayKey();
  const todayLog = logsByDate.get(today);
  const [value, setValue] = useState(todayLog ? String(todayLog.value) : '');
  const isBinary = habit.unit === '';

  useEffect(() => {
    setValue(todayLog ? String(todayLog.value) : '');
  }, [todayLog?.value, todayLog?.completed]);

  const days = Array.from({ length: HISTORY_LENGTH }, (_, i) => dateKeyAddDays(today, -(HISTORY_LENGTH - 1 - i)));

  function toggle() {
    const next = !(todayLog?.completed ?? false);
    onLog(today, next ? habit.target : 0, next);
  }

  function commitValue() {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    onLog(today, numeric, numeric >= habit.target);
  }

  return (
    <div className="habit-row" style={{ alignItems: 'flex-start' }}>
      <div className={`habit-icon${todayLog?.completed ? ' done' : ''}`}>
        {todayLog?.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </div>
      <div className="habit-body">
        <div className="button-row" style={{ justifyContent: 'space-between' }}>
          <p className="h3">{habit.label}</p>
          {streak > 0 && (
            <span className="pill streak"><Flame size={12} /> {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
          )}
        </div>

        {isBinary ? (
          <p className="copy" style={{ marginTop: 0 }}>Heute {todayLog?.completed ? 'erledigt ✓' : 'noch offen'}</p>
        ) : (
          <div className="button-row" style={{ marginTop: 4, gap: 8 }}>
            <input
              className="input compact"
              style={{ maxWidth: 100 }}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commitValue}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); commitValue(); } }}
              placeholder={String(habit.target)}
            />
            <span className="copy" style={{ margin: 0, flex: 1 }}>/ {habit.target} {habit.unit}</span>
            <button
              type="button"
              className="button secondary compact"
              onClick={commitValue}
              style={{ padding: '6px 12px' }}
            >
              OK
            </button>
          </div>
        )}

        <div className="pill-row" style={{ marginTop: 8 }}>
          {days.map((day) => {
            const log = logsByDate.get(day);
            return (
              <span key={day} className={`pill${log?.completed ? ' streak' : ''}`} title={formatRelativeDay(day)}>
                {formatRelativeDay(day).slice(0, 2)}
              </span>
            );
          })}
        </div>
      </div>
      {isBinary && (
        <button type="button" className={`habit-toggle${todayLog?.completed ? ' done' : ''}`} onClick={toggle} aria-label="Umschalten">
          {todayLog?.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
      )}
    </div>
  );
}

export function HabitsView() {
  const { habits, logsByHabit, streaksByHabit, loading, error, setLog } = useHabits();

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Gewohnheiten</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Kleine Schritte, jeden Tag.</h1>
        <p className="copy">Hake ab, was du heute geschafft hast — der Streak zeigt dir, wie konsequent du bleibst.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      {loading ? (
        <div className="panel">
          <p className="copy">Gewohnheiten werden geladen …</p>
        </div>
      ) : (
        <section className="list">
          {habits.map((habit) => {
            const logsByDate = new Map<string, { value: number; completed: boolean }>();
            for (const [date, log] of logsByHabit.get(habit.id) ?? []) logsByDate.set(date, log);
            const logFn = (logDate: string, value: number, completed: boolean) =>
              void setLog(habit, logDate, value, completed);

            if (habit.key === 'water') {
              return (
                <WaterCard
                  key={habit.id}
                  habit={habit}
                  logsByDate={logsByDate}
                  streak={streaksByHabit.get(habit.id) ?? 0}
                  onLog={logFn}
                />
              );
            }

            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                logsByDate={logsByDate}
                streak={streaksByHabit.get(habit.id) ?? 0}
                onLog={logFn}
              />
            );
          })}
        </section>
      )}
    </>
  );
}
