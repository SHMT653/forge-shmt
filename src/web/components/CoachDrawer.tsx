'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, CornerDownLeft } from 'lucide-react';
import { Sheet } from './Sheet';
import { useAuth } from '@/web/hooks/useAuth';
import { todayKey } from '@/domain/dates';

type Turn = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Was kann ich heute noch essen?',
  'Soll ich heute trainieren?',
  'Wie läuft mein Cut?',
  'Werde ich stärker?',
];

/**
 * The coach chat (§33).
 *
 * The context it reasons over is assembled server-side from the database —
 * this component sends only the question and the conversation so far.
 */
export function CoachDrawer({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const history = turns;
    setTurns([...history, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ question: trimmed, history, today: todayKey() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Der Coach ist gerade nicht erreichbar.');
        return;
      }
      setTurns((prev) => [...prev, { role: 'assistant', content: String(data.answer ?? '') }]);
    } catch {
      setError('Keine Verbindung zum Server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Coach"
      onClose={onClose}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <div className="search-field" style={{ width: '100%', borderColor: 'rgba(139,92,246,0.35)' }}>
            <Sparkles size={15} color="var(--violet)" />
            <input
              type="text"
              placeholder="Frag deinen Coach …"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Frage an den Coach"
              autoComplete="off"
            />
            <button
              type="submit"
              className="icon-button"
              disabled={busy || !input.trim()}
              aria-label="Senden"
              style={{ color: 'var(--violet)' }}
            >
              <CornerDownLeft size={15} />
            </button>
          </div>
        </form>
      }
    >
      {turns.length === 0 && (
        <div className="stack-sm">
          <p className="copy" style={{ marginTop: 0, fontSize: 14 }}>
            Ich sehe deine echten FORGE-Daten — Ernährung, Training, Gewicht, Schlaf. Frag mich etwas.
          </p>
          <div className="chip-row">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" style={{ minHeight: 34, fontSize: 12 }} onClick={() => void ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((turn, index) => (
        <div
          key={index}
          className={turn.role === 'user' ? 'panel soft' : 'coach-card'}
          style={turn.role === 'user' ? { padding: '10px 13px', marginLeft: 'auto', maxWidth: '85%' } : undefined}
        >
          {turn.role === 'assistant' && (
            <span className="coach-avatar" aria-hidden><Sparkles size={16} /></span>
          )}
          <p className={turn.role === 'assistant' ? 'coach-text' : 'copy'} style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>
            {turn.content}
          </p>
        </div>
      ))}

      {busy && <p className="muted-sm">Coach denkt nach …</p>}
      {error && <p className="muted-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div ref={bottomRef} />
    </Sheet>
  );
}
