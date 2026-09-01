'use client';

import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { getSupabaseClient } from '@/services/supabase/client';
import type { Recipe } from '@/domain/types';

type State = 'idle' | 'sending' | 'done' | 'error';

/**
 * Schickt die Zutaten eines Rezepts auf NEOs Einkaufsliste.
 *
 * Kochen und Einkaufen gehören zusammen, liegen aber in zwei Apps — dieser
 * Knopf schließt die Lücke, statt die Zutaten abzutippen.
 */
export function SendToNeoButton({ recipe }: { recipe: Recipe }) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (state === 'sending') return;
    setState('sending');
    setMessage(null);

    try {
      const { data } = await getSupabaseClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Nicht angemeldet.');

      const res = await fetch('/api/neo/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.amountLabel || undefined,
          })),
        }),
      });

      const result = (await res.json().catch(() => ({}))) as { error?: string; added?: number; skipped?: number };
      if (!res.ok) throw new Error(result.error ?? 'Hat nicht geklappt.');

      const added = result.added ?? 0;
      const skipped = result.skipped ?? 0;
      setState('done');
      setMessage(
        added === 0
          ? 'Steht schon auf der Liste.'
          : `${added} ${added === 1 ? 'Zutat' : 'Zutaten'} auf NEOs Liste${skipped > 0 ? ` · ${skipped} schon da` : ''}.`,
      );
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Hat nicht geklappt.');
    }
  }

  if (recipe.ingredients.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="button ghost compact"
        style={{ padding: 0 }}
        onClick={() => void send()}
        disabled={state === 'sending'}
      >
        {state === 'done' ? <Check size={14} /> : <ShoppingCart size={14} />}
        {state === 'sending' ? 'Wird gesendet …' : 'Zutaten auf NEOs Einkaufsliste'}
      </button>
      {message && (
        <p className="muted-sm" style={{ marginTop: 4, color: state === 'error' ? 'var(--danger)' : undefined }}>
          {message}
        </p>
      )}
    </div>
  );
}
