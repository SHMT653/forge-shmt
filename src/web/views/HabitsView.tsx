'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Flame, Droplets, Plus, Minus, Beef } from 'lucide-react';
import { useHabits } from '@/web/hooks/useHabits';
import { todayKey } from '@/domain/dates';
import type { Habit } from '@/domain/types';

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
  const pct = Math.min(100, Math.round((currentMl / Math.max(totalMl, 1)) * 100));

  function addGlass() {
    const next = currentMl + GLASS_ML;
    onLog(today, next, next >= totalMl);
  }
  function removeGlass() {
    const next = Math.max(0, currentMl - GLASS_ML);
    onLog(today, next, next >= totalMl);
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`habit-icon${todayLog?.completed ? ' done' : ''}`} style={{ margin: 0 }}>
            <Droplets size={18} />
          </div>
          <p className="h3" style={{ margin: 0 }}>{habit.label}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak > 0 && <span className="pill streak"><Flame size={12} /> {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>}
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{fmtWater(currentMl)} / {fmtWater(totalMl)}</span>
        </div>
      </div>

      <div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--teal)' : 'var(--violet)', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        <p className="copy" style={{ marginTop: 6, marginBottom: 0 }}>
          {glasses} {glasses === 1 ? 'Glas' : 'Gläser'} · {pct}%
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="button compact" style={{ flex: 1 }} onClick={addGlass}>
          <Plus size={15} /> +1 Glas (250 ml)
        </button>
        {currentMl > 0 && (
          <button type="button" className="button ghost compact" onClick={removeGlass} aria-label="Glas entfernen">
            <Minus size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function ProteinCard({ proteinG, goalG }: { proteinG: number; goalG: number }) {
  const pct = Math.min(100, Math.round((proteinG / Math.max(goalG, 1)) * 100));
  const done = proteinG >= goalG;
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`habit-icon${done ? ' done' : ''}`} style={{ margin: 0 }}>
            <Beef size={18} />
          </div>
          <p className="h3" style={{ margin: 0 }}>Protein</p>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
          {Math.round(proteinG)} g / {goalG} g
        </span>
      </div>

      <div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--teal)' : 'var(--violet)', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        <p className="copy" style={{ marginTop: 6, marginBottom: 0 }}>
          Aus Ernährung · {pct}%
        </p>
      </div>
    </div>
  );
}

function NumericCard({
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
  const loggedValue = todayLog?.value ?? 0;
  const completed = todayLog?.completed ?? false;
  const pct = Math.min(100, Math.round((loggedValue / Math.max(habit.target, 1)) * 100));
  const [input, setInput] = useState(loggedValue > 0 ? String(loggedValue) : '');

  useEffect(() => {
    setInput(loggedValue > 0 ? String(loggedValue) : '');
  }, [loggedValue]);

  function commit() {
    const numeric = parseFloat(input.replace(',', '.'));
    if (!Number.isNaN(numeric) && numeric >= 0) {
      onLog(today, numeric, numeric >= habit.target);
    }
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`habit-icon${completed ? ' done' : ''}`} style={{ margin: 0 }}>
            {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </div>
          <p className="h3" style={{ margin: 0 }}>{habit.label}</p>
        </div>
        {streak > 0 && <span className="pill streak"><Flame size={12} /> {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>}
      </div>

      <div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: completed ? 'var(--teal)' : 'var(--violet)', borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
        <p className="copy" style={{ marginTop: 5, marginBottom: 0 }}>
          {loggedValue > 0
            ? <>{loggedValue} / {habit.target} {habit.unit} · {pct}%</>
            : <>Ziel: {habit.target} {habit.unit}</>
          }
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="input compact"
          style={{ width: 90, flexShrink: 0 }}
          inputMode="decimal"
          value={input}
          placeholder="0"
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); commit(); } }}
        />
        <span className="copy" style={{ margin: 0, flex: 1 }}>/ {habit.target} {habit.unit}</span>
        <button type="button" className="button secondary compact" onClick={commit}>
          Speichern
        </button>
      </div>
    </div>
  );
}

function BinaryCard({
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
  const completed = todayLog?.completed ?? false;

  function toggle() {
    onLog(today, completed ? 0 : 1, !completed);
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`habit-icon${completed ? ' done' : ''}`} style={{ margin: 0 }}>
            {completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </div>
          <div>
            <p className="h3" style={{ margin: 0 }}>{habit.label}</p>
            <p className="copy" style={{ margin: 0, fontSize: 12 }}>
              Heute {completed ? 'erledigt ✓' : 'noch offen'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak > 0 && <span className="pill streak"><Flame size={12} /> {streak} {streak === 1 ? 'Tag' : 'Tage'}</span>}
          <button
            type="button"
            className={`habit-toggle${completed ? ' done' : ''}`}
            onClick={toggle}
            aria-label={completed ? 'Als offen markieren' : 'Als erledigt markieren'}
          >
            {completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HabitsView() {
  const { habits, logsByHabit, streaksByHabit, loading, error, setLog, nutritionProteinG, proteinGoal } = useHabits();

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Gewohnheiten</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Kleine Schritte, jeden Tag.</h1>
        <p className="copy">Hake ab, was du heute geschafft hast — der Streak zeigt dir, wie konsequent du bleibst.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)', padding: '0 4px' }}>{error}</p>}

      {loading ? (
        <div className="panel"><p className="copy">Gewohnheiten werden geladen …</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── Completion summary ───────────────────────────────────── */}
          {(() => {
            const today = todayKey();
            const visibleHabits = habits.filter((h) => h.key !== 'protein');
            const done = visibleHabits.filter((h) => {
              const log = logsByHabit.get(h.id)?.get(today);
              return log?.completed ?? false;
            }).length;
            const total = visibleHabits.length;
            const allDone = done === total && total > 0;
            const pct = total > 0 ? (done / total) * 100 : 0;
            const circumference = 2 * Math.PI * 22;
            return (
              <div className="panel soft" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width={56} height={56} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
                  <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
                  <circle
                    cx={28} cy={28} r={22} fill="none"
                    stroke={allDone ? 'var(--teal)' : 'var(--violet)'}
                    strokeWidth={5}
                    strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                    strokeDashoffset={circumference / 4}
                    style={{ transition: 'stroke-dasharray 0.4s ease' }}
                  />
                  <text x={28} y={32} textAnchor="middle" fill="var(--text)" fontSize={13} fontWeight={700}>
                    {done}/{total}
                  </text>
                </svg>
                <div>
                  <p className="h3" style={{ margin: 0 }}>
                    {allDone ? 'Heute alles geschafft!' : `${done} von ${total} erledigt`}
                  </p>
                  <p className="copy" style={{ margin: 0, fontSize: 12 }}>
                    {allDone ? 'Fantastisch — Streak läuft weiter 🔥' : `Noch ${total - done} ${total - done === 1 ? 'offen' : 'offen'}`}
                  </p>
                </div>
              </div>
            );
          })()}
          {habits.map((habit) => {
            // Protein is auto-filled from nutrition — skip the habit card for it
            if (habit.key === 'protein') return null;

            const inner = logsByHabit.get(habit.id) ?? new Map();
            const logsByDate = new Map<string, { value: number; completed: boolean }>(
              [...inner.entries()].map(([date, log]) => [date, { value: log.value, completed: log.completed }])
            );
            const streak = streaksByHabit.get(habit.id) ?? 0;
            const onLog = (logDate: string, value: number, completed: boolean) =>
              void setLog(habit, logDate, value, completed);

            if (habit.key === 'water') {
              return <WaterCard key={habit.id} habit={habit} logsByDate={logsByDate} streak={streak} onLog={onLog} />;
            }
            if (habit.unit === '') {
              return <BinaryCard key={habit.id} habit={habit} logsByDate={logsByDate} streak={streak} onLog={onLog} />;
            }
            return <NumericCard key={habit.id} habit={habit} logsByDate={logsByDate} streak={streak} onLog={onLog} />;
          })}

          {/* Protein always shown, pulled from today's nutrition */}
          <ProteinCard proteinG={nutritionProteinG} goalG={proteinGoal} />
        </div>
      )}
    </>
  );
}
