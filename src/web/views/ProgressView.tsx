'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronDown, ChevronUp, Dumbbell, Trash2, TrendingUp, Images, Scale } from 'lucide-react';
import { useProgress } from '@/web/hooks/useProgress';
import { useAuth } from '@/web/hooks/useAuth';
import { listExerciseHistory, type ExerciseHistoryPoint } from '@/data/progress';
import { Sparkline } from '@/web/components/Sparkline';
import { CardHead } from '@/web/components/CardHead';
import { formatFullDate, todayKey } from '@/domain/dates';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function ExerciseHistoryPanel({ userId, exerciseName }: { userId: string; exerciseName: string }) {
  const [history, setHistory] = useState<ExerciseHistoryPoint[] | null>(null);

  useEffect(() => {
    listExerciseHistory(userId, exerciseName).then(setHistory).catch(() => setHistory([]));
  }, [userId, exerciseName]);

  if (!history) return <p className="copy" style={{ margin: '8px 0 0', fontSize: 12 }}>Lädt …</p>;
  if (history.length < 2) {
    return <p className="copy" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--subtle)' }}>Noch zu wenig Daten — trainiere diese Übung öfter.</p>;
  }

  const values = history.map((h) => h.maxWeightKg);
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const delta = last - first;

  return (
    <div style={{ marginTop: 8 }}>
      <Sparkline values={values} width={300} height={56} color="var(--gold)" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="copy" style={{ margin: 0, fontSize: 11 }}>{formatFullDate(history[0]!.date)} · {first} kg</span>
        <span className="copy" style={{ margin: 0, fontSize: 11, color: delta >= 0 ? 'var(--teal)' : 'var(--danger)', fontWeight: 700 }}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg
        </span>
        <span className="copy" style={{ margin: 0, fontSize: 11 }}>Jetzt · {last} kg</span>
      </div>
      <p className="copy" style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
        {history.length} {history.length === 1 ? 'Session' : 'Sessions'} aufgezeichnet
      </p>
    </div>
  );
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Untergewicht', color: 'var(--violet)' };
  if (bmi < 25)   return { label: 'Normalgewicht', color: 'var(--teal)' };
  if (bmi < 30)   return { label: 'Übergewicht',   color: '#c9a227' };
  return               { label: 'Adipositas',      color: 'var(--danger)' };
}

export function ProgressView() {
  const { metrics, photos, strengthBests, goals, loading, error, addMetric, addPhoto, removePhoto } = useProgress();
  const { user } = useAuth();
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleWeightSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (!weightInput.trim() || Number.isNaN(kg) || kg <= 0) return;
    setSaving(true);
    try {
      await addMetric(todayKey(), { weightKg: kg, waistCm: null, chestCm: null, armsCm: null });
      setWeightInput('');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await addPhoto(file, todayKey());
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // 2-week weight history (most recent 14 days with weight entries)
  const cutoff = new Date(Date.now() - TWO_WEEKS_MS).toISOString().slice(0, 10);
  const weightMetrics = metrics
    .filter((m) => m.weightKg !== null && m.logDate >= cutoff)
    .sort((a, b) => a.logDate.localeCompare(b.logDate));

  const weightValues = weightMetrics.map((m) => m.weightKg as number);
  const latestWeight = weightValues[weightValues.length - 1];
  const firstWeight = weightValues[0];
  const weightDelta = latestWeight !== undefined && firstWeight !== undefined && weightValues.length >= 2
    ? latestWeight - firstWeight
    : null;

  // All-time weight for reference
  const allWeightMetrics = metrics.filter((m) => m.weightKg !== null);

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Fortschritt</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Du wirst besser.</h1>
        <p className="copy">Trage täglich dein Gewicht ein und sieh deinen Verlauf der letzten 14 Tage.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* Daily weight entry */}
      <section className="panel soft">
        <CardHead icon={Scale} tone="violet" title="Heutiges Gewicht" />
        <form onSubmit={handleWeightSubmit} className="button-row" style={{ marginTop: 12, gap: 8 }}>
          <input
            className="input compact"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="z. B. 80,5 kg"
            style={{ flex: 1 }}
          />
          <button type="submit" className="button compact" disabled={saving || !weightInput.trim()}>
            {saving ? 'Speichert …' : 'Eintragen'}
          </button>
        </form>
        {latestWeight !== undefined && (
          <p className="copy" style={{ marginTop: 8, marginBottom: 0 }}>
            Letzter Eintrag: <strong>{latestWeight} kg</strong>
            {weightDelta !== null && (
              <span style={{ color: weightDelta < 0 ? 'var(--teal)' : weightDelta > 0 ? 'var(--danger)' : 'var(--subtle)', marginLeft: 8 }}>
                ({weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg in 2 Wochen)
              </span>
            )}
          </p>
        )}
      </section>

      {/* BMI card — only shown when height + weight are both known */}
      {goals?.heightCm && latestWeight !== undefined && (() => {
        const bmi = latestWeight / ((goals.heightCm / 100) ** 2);
        const { label, color } = bmiCategory(bmi);
        const markerPct = Math.max(0, Math.min(100, ((bmi - 15) / (40 - 15)) * 100));
        return (
          <section className="panel soft" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center', minWidth: 64 }}>
              <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{bmi.toFixed(1)}</p>
              <p className="copy" style={{ margin: '4px 0 0', fontSize: 11 }}>BMI</p>
            </div>
            <div style={{ flex: 1 }}>
              <p className="h3" style={{ margin: '0 0 6px', color }}>{label}</p>
              <div style={{ position: 'relative', height: 6, borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(to right, var(--violet) 0%, var(--teal) 30%, #c9a227 60%, var(--danger) 100%)' }}>
                <div style={{ position: 'absolute', top: -3, left: `${markerPct}%`, width: 12, height: 12, borderRadius: '50%', background: 'var(--text)', border: '2px solid var(--bg)', transform: 'translateX(-50%)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="copy" style={{ fontSize: 10, margin: 0 }}>15</span>
                <span className="copy" style={{ fontSize: 10, margin: 0 }}>25</span>
                <span className="copy" style={{ fontSize: 10, margin: 0 }}>40</span>
              </div>
              <p className="copy" style={{ margin: '6px 0 0', fontSize: 11 }}>{latestWeight} kg · {goals.heightCm} cm</p>
            </div>
          </section>
        );
      })()}

      {/* 2-week graph */}
      <section className="panel">
        <CardHead icon={TrendingUp} tone="teal" title="Gewichtsverlauf (14 Tage)" />
        {loading ? (
          <p className="copy">Lädt …</p>
        ) : weightValues.length < 2 ? (
          <div className="empty-state">
            <Scale size={28} />
            <p className="copy">Trage mindestens zwei Gewichtseinträge ein, um deinen Verlauf zu sehen.</p>
          </div>
        ) : (
          <>
            <Sparkline values={weightValues} width={320} height={72} color="var(--violet)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {weightMetrics.slice(0, 1).map((m) => (
                <span key={m.id} className="copy" style={{ margin: 0, fontSize: 11 }}>{formatFullDate(m.logDate)}</span>
              ))}
              {weightMetrics.slice(-1).map((m) => (
                <span key={m.id} className="copy" style={{ margin: 0, fontSize: 11 }}>{formatFullDate(m.logDate)}</span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Weight history list */}
      {allWeightMetrics.length > 0 && (
        <section className="panel">
          <p className="h3" style={{ marginBottom: 8 }}>Verlaufsprotokoll</p>
          <div className="list">
            {allWeightMetrics.slice(-10).reverse().map((m) => (
              <div className="set-row" key={m.id}>
                <span className="copy" style={{ margin: 0, color: 'var(--subtle)' }}>{formatFullDate(m.logDate)}</span>
                <span className="copy" style={{ margin: 0, color: 'var(--text)', fontWeight: 800 }}>{m.weightKg} kg</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strength bests */}
      <section className="panel">
        <div className="section-head">
          <CardHead icon={Dumbbell} tone="gold" title="Kraftwerte" />
        </div>
        {strengthBests.length === 0 ? (
          <div className="empty-state">
            <Dumbbell size={28} />
            <p className="copy">Schließe dein erstes Training ab, um hier deine Bestleistungen zu sehen.</p>
          </div>
        ) : (
          <div className="list">
            {strengthBests.slice(0, 8).map((best) => {
              const isOpen = expandedExercise === best.exerciseName;
              return (
                <div key={best.exerciseName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: isOpen ? 12 : 0 }}>
                  <button
                    type="button"
                    className="set-row"
                    onClick={() => setExpandedExercise(isOpen ? null : best.exerciseName)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 0' }}
                  >
                    <span className="set-row-label"><Dumbbell size={14} /></span>
                    <span className="copy" style={{ margin: 0, flex: 1 }}>{best.exerciseName}</span>
                    <span className="copy" style={{ margin: 0, color: 'var(--text)', fontWeight: 800 }}>
                      {best.weightKg} kg × {best.reps}
                    </span>
                    {isOpen ? <ChevronUp size={14} color="var(--subtle)" /> : <ChevronDown size={14} color="var(--subtle)" />}
                  </button>
                  {isOpen && user && (
                    <ExerciseHistoryPanel userId={user.id} exerciseName={best.exerciseName} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Progress photos */}
      <section className="panel">
        <div className="section-head">
          <CardHead icon={Images} tone="violet" title="Fotos" />
          <button type="button" className="button secondary compact" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Camera size={16} /> {uploading ? 'Lädt hoch …' : 'Foto hinzufügen'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        {photos.length === 0 ? (
          <div className="empty-state">
            <Camera size={28} />
            <p className="copy">Noch keine Fortschrittsfotos. Ein Bild sagt mehr als jede Zahl.</p>
          </div>
        ) : (
          <div className="metric-thumb-grid">
            {photos.map((photo) => (
              <div key={photo.id} className="panel soft" style={{ padding: 10 }}>
                {photo.url && (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <Image src={photo.url} alt={`Fortschrittsfoto vom ${formatFullDate(photo.takenAt)}`} fill style={{ objectFit: 'cover' }} unoptimized />
                  </div>
                )}
                <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <span className="copy" style={{ margin: 0 }}>{formatFullDate(photo.takenAt)}</span>
                  <button type="button" className="button ghost compact" onClick={() => removePhoto(photo)} aria-label="Foto löschen">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
