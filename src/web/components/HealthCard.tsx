'use client';

import { Activity, RefreshCw, Check } from 'lucide-react';
import { useHealth } from '@/web/hooks/useHealth';
import { HEALTH_METRIC_LABEL, HEALTH_ROLLOUT, formatSyncedAgo } from '@/domain/health';

/**
 * Apple Health settings (§9/§17).
 *
 * Three states, and the browser one is a first-class outcome rather than an
 * error: a web user is told plainly that manual tracking is the path, with no
 * dead button to tap.
 */
export function HealthCard() {
  const { state, sync, connect, disconnect } = useHealth();

  if (state.loading) {
    return (
      <section className="panel">
        <p className="copy" style={{ margin: 0 }}>Health-Status wird geprüft …</p>
      </section>
    );
  }

  const syncedAgo = formatSyncedAgo(state.connection.lastSyncedAt);
  const connected = state.connection.connected && state.granted.length > 0;

  return (
    <section className="panel">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--violet)" />
          <p className="h3" style={{ fontSize: 15 }}>Apple Health</p>
        </div>
        <span className="pill" style={{ flexShrink: 0 }}>
          {!state.available ? 'Nicht verfügbar' : connected ? 'Verbunden' : 'Nicht verbunden'}
        </span>
      </div>

      {!state.available ? (
        <p className="copy" style={{ marginTop: 0 }}>
          Apple Health steht nur in der iPhone-App zur Verfügung. Im Browser trägst du Schritte, Schlaf
          und Gewicht weiterhin von Hand ein — alles andere funktioniert identisch.
        </p>
      ) : !connected ? (
        <>
          <p className="copy" style={{ marginTop: 0 }}>
            FORGE kann deine Aktivitäts- und Fitnessdaten automatisch aus Apple Health übernehmen.
            Es wird ausschließlich gelesen, nichts zurückgeschrieben.
          </p>
          <ul className="list" style={{ marginTop: 10, marginBottom: 12 }}>
            {HEALTH_ROLLOUT.map((metric) => (
              <li key={metric} className="check-line">
                <Check size={15} />
                {HEALTH_METRIC_LABEL[metric]}
              </li>
            ))}
          </ul>
          <button type="button" className="button block" onClick={() => void connect()} disabled={state.syncing}>
            {state.syncing ? 'Wird verbunden …' : 'Apple Health verbinden'}
          </button>
        </>
      ) : (
        <>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {HEALTH_ROLLOUT.map((metric) => {
              const on = state.granted.includes(metric);
              return (
                <span key={metric} className={`chip${on ? ' active' : ''}`} style={{ minHeight: 30, fontSize: 12 }}>
                  {on ? <Check size={12} /> : null}
                  {HEALTH_METRIC_LABEL[metric]}
                </span>
              );
            })}
          </div>

          {state.granted.length < HEALTH_ROLLOUT.length && (
            <p className="muted-sm" style={{ marginBottom: 10 }}>
              Nicht alle Berechtigungen sind erteilt. Die fehlenden Werte trägst du weiterhin selbst ein —
              ändern kannst du das in der Health-App unter „Datenzugriff und Geräte“.
            </p>
          )}

          {state.connection.lastError ? (
            <p className="muted-sm" style={{ color: 'var(--danger)', marginBottom: 10 }}>
              {state.connection.lastError}
            </p>
          ) : syncedAgo ? (
            <p className="muted-sm" style={{ marginBottom: 10 }}>✓ Synchronisiert {syncedAgo}</p>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="button secondary compact" style={{ flex: 1 }} onClick={() => void sync({ days: 7 })} disabled={state.syncing}>
              <RefreshCw size={15} /> {state.syncing ? 'Aktualisiert …' : 'Health aktualisieren'}
            </button>
            <button type="button" className="button ghost compact" onClick={() => void disconnect()}>
              Trennen
            </button>
          </div>
        </>
      )}
    </section>
  );
}
