'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { createCustomExercise } from '@/data/exercises';
import { MuscleMapSvg } from './MuscleMapSvg';
import type { MuscleKey } from '@/domain/exerciseDatabase';

const MUSCLE_GROUPS: { label: string; keys: MuscleKey[] }[] = [
  { label: 'Brust',           keys: ['chest'] },
  { label: 'Schultern',       keys: ['front-delt', 'side-delt', 'rear-delt'] },
  { label: 'Rücken',          keys: ['traps', 'rhomboids', 'lats', 'lower-back'] },
  { label: 'Arme',            keys: ['biceps', 'triceps', 'forearms'] },
  { label: 'Bauch',           keys: ['abs', 'obliques'] },
  { label: 'Beine / Gesäß',  keys: ['quads', 'hamstrings', 'glutes', 'calves'] },
];

const MUSCLE_LABELS: Record<MuscleKey, string> = {
  'chest':      'Brust',
  'front-delt': 'Vordere Schulter',
  'side-delt':  'Seitl. Schulter',
  'rear-delt':  'Hintere Schulter',
  'traps':      'Trapez',
  'rhomboids':  'Rhomboiden',
  'lats':       'Latissimus',
  'lower-back': 'Unterer Rücken',
  'biceps':     'Bizeps',
  'triceps':    'Trizeps',
  'forearms':   'Unterarme',
  'abs':        'Bauch',
  'obliques':   'Schrägmuskeln',
  'quads':      'Quadrizeps',
  'hamstrings': 'Hamstrings',
  'glutes':     'Gesäß',
  'calves':     'Waden',
};

const MUSCLE_TO_GROUP: Record<MuscleKey, string> = {
  'chest': 'Brust', 'front-delt': 'Schultern', 'side-delt': 'Schultern', 'rear-delt': 'Schultern',
  'traps': 'Rücken', 'rhomboids': 'Rücken', 'lats': 'Rücken', 'lower-back': 'Rücken',
  'biceps': 'Bizeps', 'triceps': 'Trizeps', 'forearms': 'Bizeps',
  'abs': 'Bauch', 'obliques': 'Bauch',
  'quads': 'Beine', 'hamstrings': 'Beine', 'glutes': 'Beine', 'calves': 'Beine',
};

const EQUIPMENT_OPTIONS = [
  'Langhantel', 'Kurzhantel', 'Maschine', 'Kabel', 'Körpergewicht', 'Stange', 'Ausdauer',
] as const;

export function CreateExerciseModal({
  userId,
  initialName,
  onCreated,
  onClose,
}: {
  userId: string;
  initialName?: string;
  onCreated: (name: string, sets: number, reps: string) => void;
  onClose: () => void;
}) {
  const [name, setName]           = useState(initialName ?? '');
  const [equipment, setEquipment] = useState<string>('Körpergewicht');
  const [muscles, setMuscles]     = useState<MuscleKey[]>([]);
  const [machineInfo, setMachineInfo] = useState('');
  const [sets, setSets]           = useState('3');
  const [reps, setReps]           = useState('8-12');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  function toggleMuscle(key: MuscleKey) {
    setMuscles((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const primaryGroup = muscles.length > 0
    ? (MUSCLE_TO_GROUP[muscles[0]!] ?? 'Sonstiges')
    : 'Sonstiges';

  async function handleSave() {
    if (!name.trim()) { setError('Bitte einen Namen eingeben.'); return; }
    if (muscles.length === 0) { setError('Bitte mindestens eine Muskelgruppe auswählen.'); return; }
    setSaving(true);
    setError('');
    try {
      await createCustomExercise(userId, {
        name: name.trim(),
        muscleGroup: primaryGroup,
        equipment,
        muscles,
        ...(machineInfo.trim() ? { machineInfo: machineInfo.trim() } : {}),
        defaultSets: Math.max(1, Number(sets) || 3),
        defaultReps: reps.trim() || '8-12',
      });
      onCreated(name.trim(), Math.max(1, Number(sets) || 3), reps.trim() || '8-12');
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      <div
        style={{ position: 'relative', background: 'var(--surface, #1a1a22)', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '92dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Neue Übung erstellen</p>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--subtle)', padding: 4 }} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">Name der Übung *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Kabelzug Seitheben"
            autoFocus
          />
        </div>

        {/* Equipment */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">Equipment</label>
          <select
            className="select"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            {EQUIPMENT_OPTIONS.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </div>

        {/* Machine info */}
        {(equipment === 'Maschine' || equipment === 'Kabel') && (
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Maschinen-/Kabel-Info (optional)</label>
            <input
              className="input"
              value={machineInfo}
              onChange={(e) => setMachineInfo(e.target.value)}
              placeholder="z. B. Kabelturm oben, breiter Griff"
            />
          </div>
        )}

        {/* Sets + Reps */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Sätze</label>
            <input className="input compact" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Wiederholungen</label>
            <input className="input compact" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
          </div>
        </div>

        {/* Muscle picker */}
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Welche Muskeln werden angesprochen? *</p>
        {MUSCLE_GROUPS.map(({ label, keys }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {keys.map((key) => {
                const active = muscles.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMuscle(key)}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                      background: active ? 'rgba(123,92,240,0.25)' : 'rgba(255,255,255,0.07)',
                      border: `1.5px solid ${active ? '#7b5cf0' : 'rgba(255,255,255,0.1)'}`,
                      color: active ? '#a990ff' : 'var(--subtle)',
                    }}
                  >
                    {active && <Check size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                    {MUSCLE_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Live muscle map preview */}
        {muscles.length > 0 && (
          <div style={{ marginTop: 4, marginBottom: 16 }}>
            <MuscleMapSvg muscles={muscles} />
          </div>
        )}

        {error && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--danger)' }}>{error}</p>
        )}

        <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--subtle)' }}>
          Die Übung wird in der Community-Datenbank gespeichert und ist für alle Nutzer sichtbar.
        </p>

        <button
          type="button"
          className="button"
          style={{ width: '100%' }}
          disabled={saving || !name.trim() || muscles.length === 0}
          onClick={handleSave}
        >
          {saving ? 'Wird gespeichert …' : 'Übung erstellen & hinzufügen'}
        </button>
      </div>
    </div>
  );
}
