'use client';

import { useEffect, useState } from 'react';
import { Clock, Utensils, Moon } from 'lucide-react';
import { getFasting, getFastingStatus, fmtHM, type FastingProtocol } from '@/domain/programs';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtHour(h: number) { return `${pad(h)}:00`; }

export function FastingCard({
  protocol,
  startHour,
}: {
  protocol: FastingProtocol;
  startHour: number;
}) {
  const entry = getFasting(protocol);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!entry) return null;

  if (entry.is52) {
    return (
      <section className="panel" style={{ background: 'rgba(123,92,240,0.06)', border: '1px solid rgba(123,92,240,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Moon size={18} color="#a990ff" />
          <p className="h3" style={{ margin: 0, color: '#a990ff' }}>5:2 Intervallfasten</p>
        </div>
        <p className="copy" style={{ marginBottom: 0, fontSize: 13 }}>
          5 Tage normal essen, 2 Tage auf ~500 kcal reduzieren. Wähle deine Fastentage frei.
        </p>
      </section>
    );
  }

  const { isEating, minutesUntilChange, eatStartHour, eatEndHour } = getFastingStatus(entry, startHour);
  const h = Math.floor(minutesUntilChange / 60);
  const m = minutesUntilChange % 60;

  // Progress within current phase
  const totalPhaseMinutes = isEating ? entry.eatHours * 60 : entry.fastHours * 60;
  const elapsed = totalPhaseMinutes - minutesUntilChange;
  const pct = Math.min(100, Math.round((elapsed / totalPhaseMinutes) * 100));

  const accent = isEating ? 'var(--teal)' : '#a990ff';
  const bgAccent = isEating ? 'rgba(107,217,173,0.07)' : 'rgba(123,92,240,0.07)';
  const borderAccent = isEating ? 'rgba(107,217,173,0.2)' : 'rgba(123,92,240,0.2)';

  return (
    <section className="panel" style={{ background: bgAccent, border: `1px solid ${borderAccent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEating ? <Utensils size={16} color="var(--teal)" /> : <Moon size={16} color="#a990ff" />}
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {entry.shortTitle} · {isEating ? 'Essensfenster' : 'Fastenzeit'}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>
              Essen: {fmtHour(eatStartHour)} – {fmtHour(eatEndHour)}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pad(h)}:{pad(m)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--subtle)' }}>
            bis {isEating ? 'Fastenstart' : 'Essensfenster'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: 2, transition: 'width 1s linear' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} color="var(--subtle)" />
          <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
            {isEating ? `Noch ${fmtHM(minutesUntilChange)} essen` : `Noch ${fmtHM(minutesUntilChange)} fasten`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--subtle)' }}>{pct}%</span>
      </div>
    </section>
  );
}
