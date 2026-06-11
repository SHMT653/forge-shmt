'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Dumbbell, Trash2, TrendingUp, Images, Scale } from 'lucide-react';
import { useProgress } from '@/web/hooks/useProgress';
import { Sparkline } from '@/web/components/Sparkline';
import { CardHead } from '@/web/components/CardHead';
import { formatFullDate, todayKey } from '@/domain/dates';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export function ProgressView() {
  const { metrics, photos, strengthBests, loading, error, addMetric, addPhoto, removePhoto } = useProgress();
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
            {strengthBests.slice(0, 8).map((best) => (
              <div className="set-row" key={best.exerciseName}>
                <span className="set-row-label"><Dumbbell size={14} /></span>
                <span className="copy" style={{ margin: 0 }}>{best.exerciseName}</span>
                <span className="copy" style={{ margin: 0, color: 'var(--text)', fontWeight: 800 }}>
                  {best.weightKg} kg × {best.reps}
                </span>
                <span className="copy" style={{ margin: 0, color: 'var(--subtle)' }}>{formatFullDate(best.date.slice(0, 10))}</span>
              </div>
            ))}
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
