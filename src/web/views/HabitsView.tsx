'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Flame } from 'lucide-react';
import { useHabits } from '@/web/hooks/useHabits';
import { dateKeyAddDays, formatRelativeDay, todayKey } from '@/domain/dates';
import type { Habit } from '@/domain/types';

const HISTORY_LENGTH = 7;

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

  const days = Array.from({ length: HISTORY_LENGTH }, (_, i) => dateKeyAddDays(today, -(HISTORY_LENGTH - 1 - i)));

  function toggle() {
    const next = !(todayLog?.completed ?? false);
    onLog(today, next ? habit.target : todayLog?.value ?? 0, next);
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
          <p className="copy" style={{ marginTop: 0 }}>Heute {todayLog?.completed ? 'erledigt' : 'noch offen'}</p>
        ) : (
          <div className="button-row" style={{ marginTop: 4 }}>
            <input
              className="input compact"
              style={{ maxWidth: 120 }}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commitValue}
              placeholder={String(habit.target)}
            />
            <span className="copy" style={{ margin: 0 }}>von {habit.target} {habit.unit}</span>
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

  if (loading) return <p className="copy">Lädt …</p>;

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Gewohnheiten</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Kleine Schritte, jeden Tag.</h1>
        <p className="copy">Hake ab, was du heute geschafft hast — der Streak zeigt dir, wie konsequent du bleibst.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      <section className="list">
        {habits.map((habit) => {
          const logsByDate = new Map<string, { value: number; completed: boolean }>();
          for (const [date, log] of logsByHabit.get(habit.id) ?? []) logsByDate.set(date, log);
          return (
            <HabitCard
              key={habit.id}
              habit={habit}
              logsByDate={logsByDate}
              streak={streaksByHabit.get(habit.id) ?? 0}
              onLog={(logDate, value, completed) => void setLog(habit, logDate, value, completed)}
            />
          );
        })}
      </section>
    </>
  );
}
