'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Sun, Zap, Clock, BriefcaseBusiness, Play, Pause, RotateCcw, Bell } from 'lucide-react';

// ─── Time helpers ────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function minsToTime(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`) : `${m} Min.`;
}

// ─── Segment Control ─────────────────────────────────────────────────────────

function Segment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
            background: value === o.value ? 'var(--violet)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--subtle)',
          }}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Sleep result card ────────────────────────────────────────────────────────

const CYCLE_CONFIG = [
  { cycles: 6, label: 'Optimal',     emoji: '🌟', color: 'var(--teal)' },
  { cycles: 5, label: 'Empfohlen',   emoji: '✅', color: 'var(--violet)' },
  { cycles: 4, label: 'Mindestschlaf', emoji: '⚠️', color: '#c9a227' },
];
const FALL_ASLEEP_MIN = 14;
const CYCLE_MIN       = 90;

function SleepResultCard({ time, cycles, label, emoji, color }: {
  time: string; cycles: number; label: string; emoji: string; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      background: 'rgba(255,255,255,0.04)', borderRadius: 10,
      border: `1px solid ${color}33`,
    }}>
      <span style={{ fontSize: 26 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -1, color: 'var(--text)' }}>{time}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>
          {label} · {cycles} Zyklen · {fmtMins(cycles * CYCLE_MIN)} Schlaf
        </p>
      </div>
    </div>
  );
}

// ─── Sleep Calculator ─────────────────────────────────────────────────────────

const NAP_PRESETS = [
  { mins: 10, label: 'Mini-Nap',      desc: 'Kurze Erholung',    icon: '⚡' },
  { mins: 20, label: 'PowerNap',      desc: 'Klassischer Nap',   icon: '💪' },
  { mins: 25, label: 'NASA-Nap',      desc: 'NASA-empfohlen',    icon: '🚀' },
  { mins: 90, label: 'Voller Zyklus', desc: '1 Schlafzyklus',    icon: '🌙' },
];

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

function PowerNapTimer({ napMins }: { napMins: number }) {
  const totalSecs   = napMins * 60;
  const [remaining, setRemaining] = useState(totalSecs);
  const [running, setRunning]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when preset changes
  useEffect(() => {
    setRunning(false);
    setRemaining(napMins * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [napMins]);

  // Ticker
  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining((r) => r - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining]);

  // Done
  useEffect(() => {
    if (remaining === 0 && running) {
      setRunning(false);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('FORGE – Aufwachen! 🌅', {
          body: `Dein ${napMins}-Minuten-PowerNap ist beendet.`,
          icon: '/icons/icon-192.png',
        });
      }
    }
  }, [remaining, running, napMins]);

  function toggle() {
    if (remaining === 0) return;
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setRemaining(totalSecs);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  const r         = 70;
  const sw        = 10;
  const circ      = 2 * Math.PI * r;
  const progress  = remaining / Math.max(totalSecs, 1);
  const dashoff   = circ * (1 - progress);
  const mins      = Math.floor(remaining / 60);
  const secs      = remaining % 60;
  const done      = remaining === 0;
  const wakeTime  = minsToTime(timeToMins(nowTime()) + napMins);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <circle
          cx={90} cy={90} r={r} fill="none"
          stroke={done ? '#6bd9ad' : 'var(--violet)'}
          strokeWidth={sw}
          strokeDasharray={circ}
          strokeDashoffset={dashoff}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
        />
        {done ? (
          <>
            <text x={90} y={85}  textAnchor="middle" fill="#6bd9ad" fontSize={32}>✓</text>
            <text x={90} y={108} textAnchor="middle" fill="var(--subtle)" fontSize={12}>Aufgewacht!</text>
          </>
        ) : (
          <>
            <text x={90} y={88}  textAnchor="middle" fill="var(--text)" fontSize={36} fontWeight={800}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </text>
            <text x={90} y={108} textAnchor="middle" fill="var(--subtle)" fontSize={11}>
              Aufwachen ~{wakeTime} Uhr
            </text>
          </>
        )}
      </svg>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="button"
          onClick={() => void (async () => { await requestNotificationPermission(); toggle(); })()}
          disabled={done}
          style={{ minWidth: 100 }}
        >
          {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {remaining === totalSecs ? 'Start' : 'Weiter'}</>}
        </button>
        <button type="button" className="button ghost compact" onClick={reset} aria-label="Zurücksetzen">
          <RotateCcw size={16} />
        </button>
      </div>
      {!running && remaining === totalSecs && (
        <p className="copy" style={{ margin: 0, fontSize: 12, textAlign: 'center', color: 'var(--subtle)' }}>
          <Bell size={11} style={{ verticalAlign: 'middle' }} /> Erlaubt Browser-Benachrichtigungen für den Wecker
        </p>
      )}
    </div>
  );
}

function SleepCalculator() {
  const [mode, setMode] = useState<'wakeup' | 'bedtime' | 'powernap'>('wakeup');
  const [time, setTime] = useState(() => {
    // default: 7:00 for wakeup, 23:00 for bedtime
    return '07:00';
  });
  const [napPreset, setNapPreset] = useState(20);

  useEffect(() => {
    setTime(mode === 'wakeup' ? '07:00' : mode === 'bedtime' ? '23:00' : '07:00');
  }, [mode]);

  const results = CYCLE_CONFIG.map(({ cycles, label, emoji, color }) => {
    const totalMin = cycles * CYCLE_MIN + FALL_ASLEEP_MIN;
    const t = mode === 'wakeup'
      ? minsToTime(timeToMins(time) - totalMin)
      : minsToTime(timeToMins(time) + totalMin);
    return { cycles, label, emoji, color, time: t };
  });

  return (
    <section className="panel">
      <Segment
        value={mode}
        onChange={setMode}
        options={[
          { value: 'wakeup',   label: 'Aufwachen um',  icon: <Sun size={14} /> },
          { value: 'bedtime',  label: 'Schlafen um',   icon: <Moon size={14} /> },
          { value: 'powernap', label: 'PowerNap',       icon: <Zap size={14} /> },
        ]}
      />

      {mode !== 'powernap' ? (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">
              {mode === 'wakeup' ? 'Ich möchte aufwachen um' : 'Ich gehe schlafen um'}
            </label>
            <input
              type="time"
              className="input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, maxWidth: 180 }}
            />
          </div>

          <p className="copy" style={{ margin: 0, fontSize: 12, color: 'var(--subtle)' }}>
            {mode === 'wakeup'
              ? '← Optimale Einschlafzeiten (90-Min.-Zyklen + 14 Min. Einschlafpuffer)'
              : '→ Optimale Aufwachzeiten (90-Min.-Zyklen + 14 Min. Einschlafpuffer)'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r) => (
              <SleepResultCard key={r.cycles} {...r} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preset cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {NAP_PRESETS.map((p) => {
              const wakeAt = minsToTime(timeToMins(nowTime()) + p.mins);
              const active = napPreset === p.mins;
              return (
                <button
                  key={p.mins}
                  type="button"
                  onClick={() => setNapPreset(p.mins)}
                  style={{
                    background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--subtle)' }}>{p.mins} Min. · {p.desc}</p>
                  <p style={{ margin: 0, fontSize: 11, color: active ? 'var(--violet)' : 'var(--subtle)', marginTop: 4 }}>
                    Aufwachen ~{wakeAt} Uhr
                  </p>
                </button>
              );
            })}
          </div>

          <PowerNapTimer napMins={napPreset} />
        </div>
      )}
    </section>
  );
}

// ─── Work Calculator ──────────────────────────────────────────────────────────

const WORK_PRESETS    = [6, 7, 7.5, 8, 8.5, 9, 10];
const BREAK_PRESETS   = [0, 15, 30, 45, 60, 90];

function WorkCalculator() {
  const [mode, setMode]         = useState<'start' | 'end'>('start');
  const [anchorTime, setAnchor] = useState('09:00');
  const [workH, setWorkH]       = useState('8');
  const [workM, setWorkM]       = useState('0');
  const [breakMin, setBreakMin] = useState(30);
  const [presetH, setPresetH]   = useState<number | null>(8);

  useEffect(() => { setAnchor(mode === 'start' ? '09:00' : '18:00'); }, [mode]);

  function selectPreset(h: number) {
    setPresetH(h);
    setWorkH(String(Math.floor(h)));
    setWorkM(String((h % 1) * 60));
  }

  const totalWorkMins = (Number(workH) || 0) * 60 + (Number(workM) || 0);
  const resultMins    = mode === 'start'
    ? timeToMins(anchorTime) + totalWorkMins + breakMin
    : timeToMins(anchorTime) - totalWorkMins - breakMin;
  const resultTime    = minsToTime(resultMins);
  const hasResult     = totalWorkMins > 0;

  return (
    <section className="panel">
      <Segment
        value={mode}
        onChange={setMode}
        options={[
          { value: 'start', label: 'Ich starte um', icon: <Clock size={14} /> },
          { value: 'end',   label: 'Feierabend um', icon: <BriefcaseBusiness size={14} /> },
        ]}
      />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Anchor time */}
        <div className="field">
          <label className="field-label">
            {mode === 'start' ? 'Arbeitsbeginn' : 'Gewünschtes Arbeitsende'}
          </label>
          <input
            type="time"
            className="input"
            value={anchorTime}
            onChange={(e) => setAnchor(e.target.value)}
            style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, maxWidth: 180 }}
          />
        </div>

        {/* Work duration */}
        <div>
          <p className="field-label" style={{ marginBottom: 8 }}>Arbeitsdauer</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {WORK_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => selectPreset(h)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: '1px solid',
                  borderColor: presetH === h ? 'var(--violet)' : 'rgba(255,255,255,0.12)',
                  background: presetH === h ? 'rgba(139,92,246,0.18)' : 'transparent',
                  color: presetH === h ? 'var(--text)' : 'var(--subtle)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {h % 1 === 0 ? `${h}h` : `${h}h`}
              </button>
            ))}
          </div>
          <div className="button-row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Stunden</label>
              <input
                className="input compact" inputMode="numeric" value={workH}
                onChange={(e) => { setPresetH(null); setWorkH(e.target.value); }}
                placeholder="8"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Minuten</label>
              <input
                className="input compact" inputMode="numeric" value={workM}
                onChange={(e) => { setPresetH(null); setWorkM(e.target.value); }}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Break */}
        <div>
          <p className="field-label" style={{ marginBottom: 8 }}>Pause</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BREAK_PRESETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBreakMin(b)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: '1px solid',
                  borderColor: breakMin === b ? 'var(--teal)' : 'rgba(255,255,255,0.12)',
                  background: breakMin === b ? 'rgba(107,217,173,0.12)' : 'transparent',
                  color: breakMin === b ? 'var(--teal)' : 'var(--subtle)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {b === 0 ? 'Keine' : `${b} Min.`}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        {hasResult && (
          <div style={{
            padding: '20px 24px', borderRadius: 14,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--subtle)' }}>
              {mode === 'start' ? 'Feierabend um' : 'Arbeitsbeginn um'}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: 'var(--text)' }}>
              {resultTime}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--subtle)' }}>
              {mode === 'start' ? anchorTime : resultTime} – {mode === 'start' ? resultTime : anchorTime}
              {' '}· {fmtMins(totalWorkMins)} Arbeit
              {breakMin > 0 && ` + ${breakMin} Min. Pause`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function SleepView() {
  const [tab, setTab] = useState<'sleep' | 'work'>('sleep');

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Zeitrechner</p>
        <h1 className="h1" style={{ fontSize: 26, marginBottom: 14 }}>Schlaf & Arbeitszeit.</h1>
        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
          <button
            type="button"
            onClick={() => setTab('sleep')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: tab === 'sleep' ? 'var(--violet)' : 'transparent',
              color: tab === 'sleep' ? '#fff' : 'var(--subtle)',
              transition: 'all 0.15s',
            }}
          >
            <Moon size={16} /> Schlafrechner
          </button>
          <button
            type="button"
            onClick={() => setTab('work')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: tab === 'work' ? 'var(--violet)' : 'transparent',
              color: tab === 'work' ? '#fff' : 'var(--subtle)',
              transition: 'all 0.15s',
            }}
          >
            <BriefcaseBusiness size={16} /> Arbeitszeitrechner
          </button>
        </div>
      </section>

      {tab === 'sleep' ? <SleepCalculator /> : <WorkCalculator />}
    </>
  );
}
