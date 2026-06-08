'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Dumbbell, Trash2 } from 'lucide-react';
import { useProgress } from '@/web/hooks/useProgress';
import { Sparkline } from '@/web/components/Sparkline';
import { formatFullDate, todayKey } from '@/domain/dates';

const METRIC_FIELDS = [
  { key: 'weightKg', label: 'Gewicht', unit: 'kg' },
  { key: 'waistCm', label: 'Bauchumfang', unit: 'cm' },
  { key: 'chestCm', label: 'Brust', unit: 'cm' },
  { key: 'armsCm', label: 'Arme', unit: 'cm' },
] as const;

export function ProgressView() {
  const { metrics, photos, strengthBests, loading, error, addMetric, addPhoto, removePhoto } = useProgress();
  const [form, setForm] = useState({ weightKg: '', waistCm: '', chestCm: '', armsCm: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addMetric(todayKey(), {
        weightKg: form.weightKg.trim() ? Number(form.weightKg) : null,
        waistCm: form.waistCm.trim() ? Number(form.waistCm) : null,
        chestCm: form.chestCm.trim() ? Number(form.chestCm) : null,
        armsCm: form.armsCm.trim() ? Number(form.armsCm) : null,
      });
      setForm({ weightKg: '', waistCm: '', chestCm: '', armsCm: '' });
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

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Fortschritt</p>
        <h1 className="h1" style={{ fontSize: 28 }}>Du wirst besser.</h1>
        <p className="copy">Trage regelmäßig deine Werte ein — so siehst du schwarz auf weiß, wie weit du gekommen bist.</p>
      </section>

      {error && <p className="copy" style={{ color: 'var(--danger)' }}>{error}</p>}

      <section className="panel soft">
        <h2 className="h2">Heutige Werte eintragen</h2>
        <form onSubmit={handleSubmit} className="split" style={{ marginTop: 12, gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          {METRIC_FIELDS.map(({ key, label, unit }) => (
            <div className="field" key={key}>
              <label className="field-label" htmlFor={key}>{label} ({unit})</label>
              <input
                id={key}
                className="input compact"
                inputMode="decimal"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="button compact" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Speichern'}</button>
          </div>
        </form>
      </section>

      <section>
        <div className="section-head"><h2 className="h2">Verlauf</h2></div>
        {loading ? (
          <p className="copy">Lädt …</p>
        ) : metrics.length < 2 ? (
          <div className="empty-state">
            <p className="copy">Trage mindestens zwei Messungen ein, um deinen Verlauf zu sehen.</p>
          </div>
        ) : (
          <div className="metric-thumb-grid">
            {METRIC_FIELDS.map(({ key, label, unit }) => {
              const values = metrics.filter((m) => m[key] !== null).map((m) => m[key] as number);
              const latest = values[values.length - 1];
              const first = values[0];
              const delta = latest !== undefined && first !== undefined ? latest - first : null;
              return (
                <div className="panel" key={key}>
                  <div className="section-head" style={{ marginBottom: 0 }}>
                    <h3 className="h3">{label}</h3>
                    {latest !== undefined && <span className="metric-value" style={{ fontSize: 18 }}>{latest} {unit}</span>}
                  </div>
                  <Sparkline values={values} />
                  {delta !== null && (
                    <p className="copy" style={{ margin: 0 }}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)} {unit} seit Beginn
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2 className="h2">Kraftwerte</h2>
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
                <span className="copy" style={{ margin: 0, color: 'var(--text)', fontWeight: 800 }}>{best.weightKg} kg × {best.reps}</span>
                <span className="copy" style={{ margin: 0, color: 'var(--subtle)' }}>{formatFullDate(best.date.slice(0, 10))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2 className="h2">Fotos</h2>
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
