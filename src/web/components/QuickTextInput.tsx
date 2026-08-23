'use client';

import { useState } from 'react';
import { PenLine, Check, X, CornerDownLeft } from 'lucide-react';
import { formatKcalRange } from '@/domain/nutritionMath';
import { parseLocally, type LibraryItem } from '@/domain/localParse';
import type { ValidatedEntry, ValidatedParseResult } from '@/domain/parsedEntry';
import type { MealEntryInput } from '@/data/nutrition';

const EXAMPLES = ['2 Isoclear', '450 g Skyr mit Himbeeren', '7000 Schritte', 'Liegestütze 10 9 8'];

/**
 * Type a line, get a proposal, confirm it.
 *
 * Runs entirely on the device against a rule parser and the user's own saved
 * foods. There was a model-backed fallback for anything the rules missed; it
 * needed an API key that was never configured, so in practice it only ever
 * produced an error message. Removed — what is left is the part that worked.
 *
 * The flow stays: text → parsed proposal → user confirms → save. Nothing is
 * written until the user taps "Hinzufügen" (§53).
 */
export function QuickTextInput({
  onAdd,
  onMetric,
  compact,
  library = [],
}: {
  onAdd: (entry: MealEntryInput) => void;
  onMetric?: (metric: 'steps' | 'water_ml' | 'sleep_h' | 'weight_kg', value: number) => void;
  compact?: boolean;
  /** The user's saved foods and recipes, so the parser can match them. */
  library?: readonly LibraryItem[];
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidatedParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    setResult(null);

    // Rules first. "7000 Schritte" or "2 Isoclear" needs no model — this is
    // instant, works offline, and costs nothing.
    const local = parseLocally(value, library);
    if (local.entries.length > 0 && local.unresolved.length === 0) {
      setResult({ entries: local.entries, question: null, note: null, rejected: 0 });
      setBusy(false);
      return;
    }

    // Say what was not understood rather than failing silently.
    if (local.entries.length > 0) {
      setResult({
        entries: local.entries,
        question: null,
        note: local.unresolved.length > 0
          ? `Nicht erkannt: ${local.unresolved.join(', ')}. Trag das über „Eintragen“ ein.`
          : null,
        rejected: 0,
      });
    } else {
      setError('Das konnte ich nicht zuordnen. Nutze „Eintragen“ und trag die Werte direkt ein.');
    }
    setBusy(false);
  }

  function acceptEntry(entry: ValidatedEntry) {
    if (entry.kind === 'metric') {
      onMetric?.(entry.metric, entry.value);
    } else if (entry.kind === 'food') {
      // Library hits are resolved by the caller against real stored macros;
      // estimates carry their range so the UI can stay honest about precision.
      const macros = entry.estimate
        ? {
            kcal: Math.round(entry.estimate.kcal * entry.quantity),
            proteinG: Math.round(entry.estimate.proteinG * entry.quantity),
            carbsG: Math.round(entry.estimate.carbsG * entry.quantity),
            fatG: Math.round(entry.estimate.fatG * entry.quantity),
          }
        : { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

      onAdd({
        name: entry.quantity !== 1 ? `${entry.quantity}× ${entry.name}` : entry.name,
        macros,
        dataQuality: entry.dataQuality,
        kcalMin: entry.range ? entry.range.min * entry.quantity : null,
        kcalMax: entry.range ? entry.range.max * entry.quantity : null,
        servings: entry.quantity,
        source: 'ai',
        ...(entry.libraryId && entry.libraryKind === 'food' ? { foodItemId: entry.libraryId } : {}),
        ...(entry.libraryId && entry.libraryKind === 'recipe' ? { recipeId: entry.libraryId } : {}),
      });
    }

    setResult((prev) =>
      prev ? { ...prev, entries: prev.entries.filter((candidate) => candidate !== entry) } : prev,
    );
  }

  function acceptAll() {
    if (!result) return;
    for (const entry of result.entries) acceptEntry(entry);
    setResult(null);
    setText('');
  }

  return (
    <div className="stack-sm">
      <form onSubmit={submit}>
        <div className="search-field" style={{ width: '100%', borderColor: 'rgba(139,92,246,0.35)' }}>
          <PenLine size={15} color="var(--violet)" />
          <input
            type="text"
            placeholder={compact ? 'Was hast du gegessen?' : 'Was hast du gegessen oder gemacht?'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Eintrag in eigenen Worten"
            autoComplete="off"
          />
          {text.trim() && (
            <button
              type="submit"
              className="icon-button"
              disabled={busy}
              aria-label="Auswerten"
              style={{ color: 'var(--violet)' }}
            >
              <CornerDownLeft size={15} />
            </button>
          )}
        </div>
      </form>

      {busy && <p className="muted-sm">Wird ausgewertet …</p>}
      {error && <p className="muted-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!result && !busy && !error && !compact && (
        <div className="chip-row">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              style={{ minHeight: 30, fontSize: 12, fontWeight: 600 }}
              onClick={() => setText(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="panel soft" style={{ padding: 12 }}>
          {result.question && (
            <p className="copy" style={{ marginTop: 0, fontSize: 13 }}>{result.question}</p>
          )}
          {result.note && !result.question && (
            <p className="muted-sm" style={{ marginBottom: 8 }}>{result.note}</p>
          )}

          <div className="stack-sm">
            {result.entries.map((entry, index) => (
              <div key={`${entry.kind}-${index}`} className="row-between" style={{ gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="h3" style={{ fontSize: 14 }}>
                    {entry.kind === 'food' && entry.quantity !== 1 ? `${entry.quantity}× ` : ''}
                    {entry.name}
                    {entry.kind === 'food' && entry.dataQuality !== 'verified' && (
                      <span className="quality-badge estimated" style={{ marginLeft: 6 }}>geschätzt</span>
                    )}
                  </p>
                  <p className="muted-sm">{describeEntry(entry)}</p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button type="button" className="icon-button" onClick={() => acceptEntry(entry)} aria-label="Übernehmen">
                    <Check size={16} color="var(--teal)" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setResult((prev) =>
                        prev ? { ...prev, entries: prev.entries.filter((c) => c !== entry) } : prev,
                      )
                    }
                    aria-label="Verwerfen"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {result.entries.length > 1 && (
            <button type="button" className="button block compact" style={{ marginTop: 10 }} onClick={acceptAll}>
              <Check size={15} /> Alle hinzufügen
            </button>
          )}
          {result.entries.length === 0 && result.question && (
            <button
              type="button"
              className="button secondary block compact"
              style={{ marginTop: 10 }}
              onClick={() => { setResult(null); setText(''); }}
            >
              Verstanden
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function describeEntry(entry: ValidatedEntry): string {
  if (entry.kind === 'metric') {
    switch (entry.metric) {
      case 'steps': return `${Math.round(entry.value).toLocaleString('de-DE')} Schritte`;
      case 'water_ml': return `${Math.round(entry.value)} ml Wasser`;
      case 'sleep_h': return `${entry.value} Stunden Schlaf`;
      case 'weight_kg': return `${entry.value} kg`;
    }
  }
  if (entry.kind === 'workout') {
    return `${entry.reps.join(' / ')} — ${entry.reps.reduce((a, b) => a + b, 0)} Wiederholungen gesamt`;
  }
  if (entry.dataQuality === 'unknown') {
    return 'Nährwerte unklar — bitte selbst ergänzen';
  }
  if (entry.libraryId) {
    return 'Aus deiner Bibliothek — exakte Werte';
  }
  const kcal = entry.estimate ? entry.estimate.kcal * entry.quantity : 0;
  const kcalText = entry.range
    ? formatKcalRange(entry.range.min * entry.quantity, entry.range.max * entry.quantity, kcal)
    : `~${Math.round(kcal)} kcal`;
  const protein = entry.estimate ? Math.round(entry.estimate.proteinG * entry.quantity) : 0;
  return `${kcalText} · ${protein} g Protein`;
}
