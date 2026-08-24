'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Scale, TrendingUp, Trash2, Trophy, CalendarCheck, Plus } from 'lucide-react';
import { useProgress } from '@/web/hooks/useProgress';
import { WeightTrendChart } from '@/web/components/WeightTrendChart';
import { PhotoCompare } from '@/web/components/PhotoCompare';
import { Sheet } from '@/web/components/Sheet';
import { formatKg, weightOnOrBefore } from '@/domain/weightTrend';
import { formatRepsPerSet, formatScore } from '@/domain/progression';
import { toDateKey, todayKey } from '@/domain/dates';
import type { BiaValues, PhotoPose } from '@/domain/types';
import { parseDecimalOr } from '@/domain/numbers';

const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Vorne' },
  { value: 'side', label: 'Seitlich' },
  { value: 'back', label: 'Rücken' },
  { value: 'front_flexed', label: 'Angespannt' },
];

export function ProgressView() {
  const {
    metrics, photos, goals, targets, weight, exercises, stats, rangeDays, setRangeDays,
    loading, error, addMetric, addPhoto, removePhoto,
  } = useProgress();

  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pose, setPose] = useState<PhotoPose>('front');
  // A picked-but-not-yet-saved photo, so the date can be corrected first.
  const [pending, setPending] = useState<{ file: File; date: string } | null>(null);
  const [biaOpen, setBiaOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) return <div className="panel"><p className="copy">Fortschritt wird geladen …</p></div>;
  if (error) return <div className="panel"><p className="copy" style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!weight || !targets) return null;

  async function handleWeightSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseDecimalOr(weightInput, Number.NaN);
    if (!Number.isFinite(kg) || kg <= 0) return;
    setSaving(true);
    try {
      await addMetric(todayKey(), { weightKg: kg, waistCm: null, chestCm: null, armsCm: null });
      setWeightInput('');
    } finally {
      setSaving(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    // A photo picked from the gallery was taken when it was taken. Its file
    // date is the right default — the user only has to correct it when it is
    // wrong, instead of typing it every time.
    setPending({ file, date: toDateKey(new Date(file.lastModified)) });
  }

  async function savePending() {
    if (!pending) return;
    setUploading(true);
    try {
      // The weight that belongs to the photo's own day, not to today (§25).
      await addPhoto(pending.file, pending.date, pose, weightOnOrBefore(metrics, pending.date));
      setPending(null);
    } finally {
      setUploading(false);
    }
  }

  const posePhotos = photos.filter((p) => p.pose === pose);

  return (
    <>
      {/* ── Weight (§24/§25) ──────────────────────────────────────────── */}
      <section className="panel">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div>
            <p className="section-label">Aktuelles Gewicht</p>
            <p className="readout" style={{ marginTop: 4 }}>
              <span className="readout-value">{weight.latest !== null ? weight.latest.toLocaleString('de-DE') : '–'}</span>
              <span className="readout-unit">kg</span>
            </p>
            {weight.trendNow !== null && (
              <p className="muted-sm" style={{ marginTop: 2 }}>7-Tage-Trend: {weight.trendNow.toLocaleString('de-DE')} kg</p>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span className="pill">{targets.phase.label}</span>
          </div>
        </div>

        <div className="split-3" style={{ marginBottom: 14 }}>
          <ChangeCard label="7 Tage" change={weight.change7d} />
          <ChangeCard label="30 Tage" change={weight.change30d} />
          <ChangeCard label="Seit Start" change={weight.changeTotal} />
        </div>

        <WeightTrendChart points={weight.points} goalKg={goals?.weightGoal ?? null} />

        <form onSubmit={handleWeightSubmit} style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="weight">Gewicht eintragen (kg)</label>
            <input
              id="weight"
              className="input"
              inputMode="decimal"
              placeholder="73,2"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </div>
          <button type="submit" className="button" disabled={saving || !weightInput.trim()}>
            {saving ? '…' : 'Speichern'}
          </button>
        </form>

        <button type="button" className="button ghost compact" style={{ marginTop: 6, padding: 0 }} onClick={() => setBiaOpen(true)}>
          <Plus size={14} /> Werte der Körperanalysewaage
        </button>

        <p className="muted-sm" style={{ marginTop: 10 }}>
          Am aussagekräftigsten: morgens, nach der Toilette, vor dem Essen und Trinken. Tagesschwankungen
          durch Wasser und Salz sind normal — der Trend zählt.
        </p>
      </section>

      {/* ── Statistics, always on screen, over a span the user picks ──── */}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-label">Statistik</p>
            <p className="h3" style={{ fontSize: 15 }}>{RANGE_LABEL[rangeDays] ?? `${rangeDays} Tage`}</p>
          </div>
        </div>

        <div className="chip-row" style={{ marginBottom: 12 }}>
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={`chip${rangeDays === range.days ? ' active' : ''}`}
              style={{ minHeight: 32, fontSize: 12 }}
              onClick={() => setRangeDays(range.days)}
              aria-pressed={rangeDays === range.days}
            >
              {range.label}
            </button>
          ))}
        </div>

        {!stats || stats.trackedDays === 0 ? (
          <p className="muted-sm">
            In diesem Zeitraum ist nichts erfasst. Trag über den Kalender nach, was fehlt.
          </p>
        ) : (
          <>
            <div className="stat-grid">
              <Stat label="Ø Kalorien" value={fmt(stats.avgKcal)} unit="kcal" />
              <Stat label="Ø Protein" value={fmt(stats.avgProtein)} unit="g" />
              <Stat label="Ø Schritte" value={fmt(stats.avgSteps)} />
              <Stat label="Ø Schlaf" value={stats.avgSleepH !== null ? stats.avgSleepH.toLocaleString('de-DE') : '–'} unit="h" />
              <Stat label="Ø Trinken" value={stats.avgWaterMl !== null ? (stats.avgWaterMl / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–'} unit="l" />
              <Stat label="Einheiten / Woche" value={stats.workoutsPerWeek !== null ? stats.workoutsPerWeek.toLocaleString('de-DE') : '–'} />
              <Stat label="Trainingstage" value={String(stats.trainingDays)} unit={`von ${stats.days}`} />
              <Stat label="Erfasste Tage" value={String(stats.trackedDays)} unit={`von ${stats.days}`} />
            </div>

            <div className="stack-sm" style={{ marginTop: 12 }}>
              <Bar
                label="Kalorien im Zielbereich"
                hit={stats.daysInCalorieRange}
                of={stats.nutritionDays}
              />
              <Bar label="Proteinziel erreicht" hit={stats.daysProteinHit} of={stats.nutritionDays} />
              <Bar label="Schrittziel erreicht" hit={stats.daysStepGoalHit} of={stats.trackedDays} />
            </div>

            <p className="muted-sm" style={{ marginTop: 10 }}>
              Längste Serie ohne Lücke: {stats.longestStreak} {stats.longestStreak === 1 ? 'Tag' : 'Tage'}.
              {stats.miniSessions > 0 ? ` ${stats.fullWorkouts} volle Einheiten, ${stats.miniSessions} Mini.` : ` ${stats.fullWorkouts} volle Einheiten.`}
            </p>
          </>
        )}
      </section>

      {/* ── Exercise progression (§61) ────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={16} color="var(--gold)" />
            <p className="h3" style={{ fontSize: 15 }}>Trainingsleistung</p>
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="empty-state">
            <p className="copy" style={{ margin: 0 }}>Noch keine abgeschlossenen Sätze.</p>
            <p className="muted-sm">Sobald du ein Training aufzeichnest, siehst du hier deine Entwicklung.</p>
          </div>
        ) : (
          <div className="stack">
            {exercises.map((exercise) => {
              const latest = exercise.snapshots[exercise.snapshots.length - 1];
              const trend = exercise.trend;
              const tone =
                trend?.direction === 'up' ? 'var(--teal)'
                : trend?.direction === 'down' ? 'var(--gold)'
                : 'var(--muted)';

              return (
                <div key={exercise.name} className="habit-row" style={{ alignItems: 'flex-start' }}>
                  <div className="habit-body">
                    <div className="row-between">
                      <p className="h3" style={{ fontSize: 14 }}>{exercise.name}</p>
                      {trend?.percent !== null && trend?.percent !== undefined && trend.direction !== 'new' && (
                        <span style={{ color: tone, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                          {trend.percent > 0 ? '+' : ''}{trend.percent} %
                        </span>
                      )}
                    </div>
                    <p className="muted-sm">
                      {trend && trend.direction !== 'new'
                        ? trend.summary
                        : latest
                          ? `Zuletzt: ${formatScore(latest)}`
                          : ''}
                    </p>
                    {latest && latest.repsPerSet.length > 0 && (
                      <p className="muted-sm">
                        Letzte Sätze: {formatRepsPerSet(latest.repsPerSet)} · {exercise.snapshots.length} Einheiten
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Photos (§27/§28) ──────────────────────────────────────────── */}
      <section className="panel">
        <div className="section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={16} color="var(--violet)" />
            <p className="h3" style={{ fontSize: 15 }}>Fortschrittsbilder</p>
          </div>
          <span className="muted-sm">{photos.length} Bilder</span>
        </div>

        <div className="chip-row" style={{ marginBottom: 12 }}>
          {POSES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip${pose === option.value ? ' active' : ''}`}
              style={{ minHeight: 32, fontSize: 12 }}
              onClick={() => setPose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <PhotoCompare photos={posePhotos} />

        {/* No `capture` attribute: forcing the camera made it impossible to add
            a photo from last week, which is most of what back-filling is. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />

        {pending ? (
          <div className="panel soft" style={{ marginTop: 12, padding: 12, display: 'grid', gap: 10 }}>
            <p className="section-label" style={{ margin: 0 }}>Bild eintragen</p>
            <div className="field">
              <label className="field-label" htmlFor="photo-date">Aufnahmedatum</label>
              <input
                id="photo-date"
                className="input"
                type="date"
                value={pending.date}
                max={todayKey()}
                onChange={(e) => setPending((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
              />
            </div>
            <p className="muted-sm" style={{ margin: 0 }}>
              Pose: {POSES.find((p) => p.value === pose)?.label}
              {weightOnOrBefore(metrics, pending.date) !== null && ` · ${weightOnOrBefore(metrics, pending.date)} kg an diesem Tag`}
            </p>
            <div className="button-row">
              <button type="button" className="button" disabled={uploading || !pending.date} onClick={() => void savePending()}>
                {uploading ? 'Wird hochgeladen …' : 'Speichern'}
              </button>
              <button type="button" className="button ghost compact" disabled={uploading} onClick={() => setPending(null)}>
                Verwerfen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="button secondary block"
            style={{ marginTop: 12 }}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={16} /> Bild hinzufügen ({POSES.find((p) => p.value === pose)?.label})
          </button>
        )}

        {posePhotos.length > 0 && (
          <div className="metric-thumb-grid" style={{ marginTop: 12 }}>
            {posePhotos.slice(0, 6).map((photo) => (
              <div key={photo.id} style={{ position: 'relative' }}>
                <div style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--surface-2)' }}>
                  {photo.url && (
                    <Image src={photo.url} alt={photo.takenAt} fill sizes="45vw" style={{ objectFit: 'cover' }} unoptimized />
                  )}
                </div>
                <div className="row-between" style={{ marginTop: 4 }}>
                  <span className="muted-sm">{photo.takenAt}</span>
                  <button
                    type="button"
                    className="icon-button danger"
                    style={{ width: 26, height: 26 }}
                    onClick={() => void removePhoto(photo)}
                    aria-label="Bild löschen"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="muted-sm" style={{ marginTop: 10 }}>
          Gleiche Position, gleicher Abstand, gleiches Licht — nur so ist ein Vergleich aussagekräftig.
        </p>
      </section>

      {biaOpen && (
        <BiaSheet
          onClose={() => setBiaOpen(false)}
          onSave={async (values, weightKg) => {
            await addMetric(todayKey(), {
              weightKg,
              waistCm: null,
              chestCm: null,
              armsCm: null,
              bia: values,
              source: 'bia',
            });
            setBiaOpen(false);
          }}
          currentWeight={weight.latest}
        />
      )}
    </>
  );
}

function ChangeCard({ label, change }: { label: string; change: { deltaKg: number | null; reliable: boolean } }) {
  const tone = change.deltaKg === null ? 'var(--muted)' : change.deltaKg < 0 ? 'var(--teal)' : change.deltaKg > 0 ? 'var(--gold)' : 'var(--muted)';
  return (
    <div className="metric-card">
      <span className="metric-value" style={{ fontSize: 17, color: tone }}>
        {change.deltaKg === null ? '–' : formatKg(change.deltaKg, true)}
      </span>
      <span className="metric-label">{label}</span>
      {change.deltaKg !== null && !change.reliable && (
        <span className="metric-label" style={{ fontSize: 10, color: 'var(--subtle)' }}>wenig Daten</span>
      )}
    </div>
  );
}

// ── BIA input (§29) ─────────────────────────────────────────────────────────

const BIA_FIELDS: { key: keyof BiaValues; label: string; unit: string }[] = [
  { key: 'bodyFatPct', label: 'Körperfett', unit: '%' },
  { key: 'muscleMassKg', label: 'Muskelmasse', unit: 'kg' },
  { key: 'skeletalMusclePct', label: 'Skelettmuskel', unit: '%' },
  { key: 'bodyWaterPct', label: 'Körperwasser', unit: '%' },
  { key: 'visceralFat', label: 'Viszerales Fett', unit: '' },
  { key: 'bmr', label: 'Grundumsatz', unit: 'kcal' },
];

function BiaSheet({
  onClose,
  onSave,
  currentWeight,
}: {
  onClose: () => void;
  onSave: (values: Partial<BiaValues>, weightKg: number | null) => Promise<void>;
  currentWeight: number | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [weightInput, setWeightInput] = useState(currentWeight !== null ? String(currentWeight) : '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const parsed: Partial<BiaValues> = {};
      for (const field of BIA_FIELDS) {
        const raw = values[field.key];
        if (!raw?.trim()) continue;
        const n = parseDecimalOr(raw, Number.NaN);
        if (Number.isFinite(n)) parsed[field.key] = n;
      }
      const kg = parseDecimalOr(weightInput, Number.NaN);
      await onSave(parsed, Number.isFinite(kg) && kg > 0 ? kg : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Körperanalysewaage"
      onClose={onClose}
      footer={
        <button type="button" className="button block" onClick={submit} disabled={saving}>
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
      }
    >
      <p className="muted-sm">
        Diese Werte sind BIA-Schätzungen deiner Waage — sie schwanken mit Wasserhaushalt und Tageszeit
        und sind nicht medizinisch exakt. Das Gewicht bleibt die verlässlichste Zahl.
      </p>

      <div className="field">
        <label className="field-label">Gewicht (kg)</label>
        <input className="input" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
      </div>

      <div className="split">
        {BIA_FIELDS.map((field) => (
          <div className="field" key={field.key}>
            <label className="field-label">{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
            <input
              className="input"
              inputMode="decimal"
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

const RANGES = [
  { days: 7,   label: '7 Tage' },
  { days: 30,  label: '30 Tage' },
  { days: 90,  label: '3 Monate' },
  { days: 365, label: '1 Jahr' },
] as const;

const RANGE_LABEL: Record<number, string> = {
  7: 'Letzte 7 Tage', 30: 'Letzte 30 Tage', 90: 'Letzte 3 Monate', 365: 'Letztes Jahr',
};

function fmt(value: number | null): string {
  return value === null ? '–' : Math.round(value).toLocaleString('de-DE');
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat-cell">
      <p className="stat-cell-label">{label}</p>
      <p className="stat-cell-value">
        {value}
        {unit && <span className="stat-cell-unit"> {unit}</span>}
      </p>
    </div>
  );
}

/** How often a target was met, as a share of the days it could have been. */
function Bar({ label, hit, of }: { label: string; hit: number; of: number }) {
  const share = of > 0 ? hit / of : 0;
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="muted-sm">{label}</span>
        <span className="muted-sm">
          {of > 0 ? `${hit} / ${of}` : '–'}
        </span>
      </div>
      <div className="stat-bar" aria-hidden>
        <span style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  );
}
