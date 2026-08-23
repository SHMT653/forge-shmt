'use client';

import { useState } from 'react';
import { Flame, Timer, Trash2, TrendingUp, Activity } from 'lucide-react';
import { useCardio } from '@/web/hooks/useCardio';
import { CARDIO_ACTIVITIES, CARDIO_CATEGORIES, calcKcalBurned, type CardioActivity } from '@/domain/cardioActivities';
import { formatFullDate } from '@/domain/dates';
import type { CardioLog } from '@/data/cardio';
import { parseDecimal, parseDecimalOr } from '@/domain/numbers';

// ─── Category color mapping ─────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Laufen:       'var(--violet)',
  Radfahren:    'var(--teal)',
  Schwimmen:    '#5ba4e8',
  Geräte:       '#c9a227',
  Hochintensiv: 'var(--danger)',
  Kampfsport:   '#d96060',
  Sanft:        '#7dc98f',
};

// ─── Log row ────────────────────────────────────────────────────────────────

function CardioLogRow({ log, onDelete }: { log: CardioLog; onDelete: () => void }) {
  const act = CARDIO_ACTIVITIES.find((a) => a.name === log.activity);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{act?.icon ?? '🏃'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.activity}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--subtle)' }}>{log.durationMinutes} Min</span>
          {log.distanceKm && <span style={{ fontSize: 12, color: 'var(--subtle)' }}>{log.distanceKm} km</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>🔥 {log.kcalBurned} kcal</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4, flexShrink: 0 }}
        aria-label="Einheit löschen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ─── Activity picker ────────────────────────────────────────────────────────

function ActivityPicker({
  selected,
  onSelect,
}: {
  selected: CardioActivity | null;
  onSelect: (a: CardioActivity) => void;
}) {
  const [activeCategory, setActiveCategory] = useState(CARDIO_CATEGORIES[0]!);

  const filtered = CARDIO_ACTIVITIES.filter((a) => a.category === activeCategory);

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {CARDIO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', touchAction: 'manipulation',
              background: activeCategory === cat ? (CATEGORY_COLOR[cat] ?? 'var(--violet)') : 'rgba(255,255,255,0.07)',
              color: activeCategory === cat ? '#fff' : 'var(--subtle)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Activity grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 4 }}>
        {filtered.map((act) => {
          const isSelected = selected?.id === act.id;
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelect(act)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${isSelected ? (CATEGORY_COLOR[act.category] ?? 'var(--violet)') : 'rgba(255,255,255,0.08)'}`,
                background: isSelected ? `${(CATEGORY_COLOR[act.category] ?? 'var(--violet)')}18` : 'rgba(255,255,255,0.03)',
                touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{act.icon}</div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{act.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--subtle)' }}>MET {act.met}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

export function CardioView() {
  const { todayLogs, recentLogs, weightKg, todayKcal, loading, error, addLog, removeLog } = useCardio();

  const [selectedActivity, setSelectedActivity] = useState<CardioActivity | null>(null);
  const [duration, setDuration]                 = useState('30');
  const [distance, setDistance]                 = useState('');
  const [saving, setSaving]                     = useState(false);

  const estimatedKcal = selectedActivity
    ? calcKcalBurned(selectedActivity.met, weightKg, parseDecimalOr(duration, 0))
    : 0;

  async function handleAdd() {
    if (!selectedActivity || !duration.trim()) return;
    setSaving(true);
    try {
      await addLog({
        activity: selectedActivity.name,
        durationMinutes: Math.max(1, parseDecimalOr(duration, 30)),
        distanceKm: distance.trim() ? parseDecimal(distance) : null,
        kcalBurned: estimatedKcal,
      });
      setDuration('30');
      setDistance('');
      setSelectedActivity(null);
    } finally {
      setSaving(false);
    }
  }

  // Weekly summary from recentLogs
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weeklyKcal = recentLogs.filter((l) => l.logDate >= weekStartStr).reduce((s, l) => s + l.kcalBurned, 0);
  const weeklySessions = recentLogs.filter((l) => l.logDate >= weekStartStr).length;

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Cardio & Ausdauer</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Beweg dich.</h1>
        <p className="copy">Jede Aktivität zählt — kcal-Verbrennung fließt automatisch in deine Tagesbilanz ein.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)', padding: '0 4px' }}>{error}</p>}

      {/* ── Heute ────────────────────────────────────────────── */}
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-value" style={{ color: 'var(--teal)' }}>
            {todayKcal > 0 ? todayKcal.toLocaleString('de-DE') : '–'}
          </span>
          <span className="metric-label">kcal heute verbrannt</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{weeklySessions}</span>
          <span className="metric-label">Sessions diese Woche</span>
        </div>
        <div className="metric-card">
          <span className="metric-value" style={{ color: 'var(--violet)' }}>
            {weeklyKcal > 0 ? weeklyKcal.toLocaleString('de-DE') : '–'}
          </span>
          <span className="metric-label">kcal diese Woche</span>
        </div>
      </section>

      {/* ── Aktivität auswählen ───────────────────────────────── */}
      <section className="panel">
        <p className="h3" style={{ marginBottom: 14 }}>Aktivität auswählen</p>
        <ActivityPicker selected={selectedActivity} onSelect={setSelectedActivity} />
      </section>

      {/* ── Dauer + kcal ─────────────────────────────────────── */}
      {selectedActivity && (
        <section className="panel soft">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{selectedActivity.icon}</span>
            <div>
              <p className="h3" style={{ margin: 0 }}>{selectedActivity.name}</p>
              <p className="copy" style={{ margin: 0, fontSize: 12 }}>{selectedActivity.description}</p>
            </div>
          </div>

          <div className="button-row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Dauer (Min)</label>
              <input
                className="input compact"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
              />
            </div>
            {selectedActivity.hasDistance && (
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Distanz (km)</label>
                <input
                  className="input compact"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="0,0"
                />
              </div>
            )}
          </div>

          {/* Kcal preview */}
          {estimatedKcal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', background: 'rgba(107,217,173,0.1)', borderRadius: 10, border: '1px solid rgba(107,217,173,0.2)' }}>
              <Flame size={18} color="var(--teal)" />
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>
                  {estimatedKcal.toLocaleString('de-DE')} kcal
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)' }}>
                  Berechnet für {weightKg} kg · MET {selectedActivity.met} · {duration} Min
                  <br />Formel: MET × {weightKg} kg × {duration} Min ÷ 60
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            className="button"
            style={{ width: '100%', marginTop: 12 }}
            disabled={saving || !duration.trim() || parseDecimalOr(duration, 0) <= 0}
            onClick={handleAdd}
          >
            <Timer size={16} /> {saving ? 'Wird gespeichert …' : 'Aktivität eintragen'}
          </button>
        </section>
      )}

      {/* ── Heute ─────────────────────────────────────────────── */}
      {todayLogs.length > 0 && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <p className="h3" style={{ margin: 0 }}>Heute</p>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>🔥 {todayKcal.toLocaleString('de-DE')} kcal</span>
          </div>
          {loading ? (
            <p className="copy">Lädt …</p>
          ) : (
            todayLogs.map((log) => (
              <CardioLogRow key={log.id} log={log} onDelete={() => void removeLog(log.id)} />
            ))
          )}
        </section>
      )}

      {/* ── Verlauf ───────────────────────────────────────────── */}
      {recentLogs.length > 0 && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={16} color="var(--violet)" />
            <p className="h3" style={{ margin: 0 }}>Verlauf</p>
          </div>
          {(() => {
            // Group by date
            const byDate = new Map<string, CardioLog[]>();
            for (const log of [...recentLogs].reverse()) {
              const list = byDate.get(log.logDate) ?? [];
              list.push(log);
              byDate.set(log.logDate, list);
            }
            return [...byDate.entries()].slice(0, 7).map(([date, logs]) => (
              <div key={date} style={{ marginBottom: 12 }}>
                <p className="copy" style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {formatFullDate(date)}
                </p>
                {logs.map((log) => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <span style={{ fontSize: 18 }}>{CARDIO_ACTIVITIES.find((a) => a.name === log.activity)?.icon ?? '🏃'}</span>
                    <span className="copy" style={{ margin: 0, flex: 1, fontSize: 13 }}>{log.activity}</span>
                    <span className="copy" style={{ margin: 0, fontSize: 12, color: 'var(--subtle)' }}>{log.durationMinutes} Min</span>
                    <span className="copy" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>🔥 {log.kcalBurned}</span>
                  </div>
                ))}
              </div>
            ));
          })()}
        </section>
      )}

      {!loading && todayLogs.length === 0 && recentLogs.length === 0 && (
        <section className="panel">
          <div className="empty-state">
            <Activity size={28} />
            <p className="copy">Noch keine Cardio-Einheiten. Wähle eine Aktivität oben aus und trage dein erstes Training ein.</p>
          </div>
        </section>
      )}
    </>
  );
}
