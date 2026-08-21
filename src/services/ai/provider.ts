/**
 * Provider-agnostic AI surface (§53).
 *
 * The rest of FORGE talks to this interface, never to a vendor SDK, so the
 * model behind it can change without touching a single screen or hook.
 */

import type { RawParseResult } from '@/domain/aiSchema';

/** The user's own items, sent so the model can reference instead of guess (§35). */
export type LibraryEntry = {
  id: string;
  kind: 'food' | 'recipe';
  name: string;
  brand?: string;
  servingLabel: string;
};

export type ParseRequest = {
  text: string;
  library: LibraryEntry[];
  /** Local time, so "heute Morgen" and meal slots resolve correctly. */
  localTime: string;
};

export type CoachRequest = {
  question: string;
  /** Pre-rendered, already-filtered FORGE data (§34/§71). */
  context: string;
  history: { role: 'user' | 'assistant'; content: string }[];
};

export interface AIProvider {
  readonly name: string;
  parseEntry(request: ParseRequest): Promise<RawParseResult>;
  coach(request: CoachRequest): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}
