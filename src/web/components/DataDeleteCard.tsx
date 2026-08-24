'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { DATA_SCOPES, deleteScopes, type DataScope } from '@/data/dataManagement';

/**
 * Deleting stored data, deliberately in two steps.
 *
 * Nothing in FORGE expires on its own — a day from two years ago is still
 * readable. That promise only holds up if there is a way out, and a way out
 * this destructive has to be hard to trigger by accident: pick what goes, then
 * confirm it with the count in front of you.
 *
 * Settings stay. Targets, equipment and plans are configuration, not history.
 */
export function DataDeleteCard() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<DataScope[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const allScopes = DATA_SCOPES.map((s) => s.scope);
  const everything = selected.length === allScopes.length;

  function toggle(scope: DataScope) {
    setResult(null);
    setConfirming(false);
    setSelected((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function confirmDelete() {
    if (!user || selected.length === 0) return;
    setBusy(true);
    try {
      const results = await deleteScopes(user.id, selected);
      const failed = results.flatMap((r) => r.failed);
      setResult(
        failed.length === 0
          ? `Gelöscht: ${selected.map((s) => DATA_SCOPES.find((d) => d.scope === s)?.label).join(', ')}.`
          : `Teilweise fehlgeschlagen. Nicht gelöscht: ${[...new Set(failed)].join(', ')}.`,
      );
      setSelected([]);
      setConfirming(false);
    } catch {
      setResult('Das Löschen ist fehlgeschlagen. Nichts wurde verändert.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="danger-zone">
      <p className="copy" style={{ marginTop: 0, fontSize: 13 }}>
        FORGE behält alles, bis du hier etwas löschst — nichts läuft von selbst ab. Wähle aus,
        was weg soll. Deine Ziele, dein Equipment und deine Pläne bleiben.
      </p>

      <div className="stack-sm">
        {DATA_SCOPES.map((item) => (
          <button
            key={item.scope}
            type="button"
            className={`scope-row${selected.includes(item.scope) ? ' selected' : ''}`}
            onClick={() => toggle(item.scope)}
            aria-pressed={selected.includes(item.scope)}
          >
            <span className="scope-box" aria-hidden>
              {selected.includes(item.scope) && <Check size={13} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="scope-label">{item.label}</span>
              <span className="scope-detail">{item.detail}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="button-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="button ghost compact"
          onClick={() => { setSelected(everything ? [] : allScopes); setConfirming(false); setResult(null); }}
        >
          {everything ? 'Auswahl aufheben' : 'Alles auswählen'}
        </button>
      </div>

      {selected.length > 0 && !confirming && (
        <button
          type="button"
          className="button danger"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={16} /> {selected.length === 1 ? '1 Bereich' : `${selected.length} Bereiche`} löschen
        </button>
      )}

      {confirming && (
        <div className="confirm-box">
          <p className="confirm-title">
            <AlertTriangle size={15} />
            {everything ? 'Wirklich alles löschen?' : 'Wirklich löschen?'}
          </p>
          <p className="muted-sm" style={{ margin: '6px 0 0' }}>
            {selected.map((s) => DATA_SCOPES.find((d) => d.scope === s)?.label).join(', ')} —
            das lässt sich nicht rückgängig machen.
          </p>
          <div className="button-row" style={{ marginTop: 10 }}>
            <button type="button" className="button danger compact" disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? 'Wird gelöscht …' : 'Ja, löschen'}
            </button>
            <button type="button" className="button secondary compact" disabled={busy} onClick={() => setConfirming(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {result && <p className="muted-sm" style={{ marginTop: 10 }}>{result}</p>}
    </div>
  );
}
