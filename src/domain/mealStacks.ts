/**
 * Gleiches Essen an einem Tag steht einmal da.
 *
 * Wer sich zweimal dasselbe Glas Milch einträgt, will keine zwei gleich
 * aussehenden Zeilen lesen, sondern „2× Milch" mit der Summe darunter. Die
 * Einträge bleiben einzeln in der Datenbank — nur die Anzeige fasst zusammen,
 * sonst könnte man später nicht mehr einen davon zurücknehmen.
 *
 * Was „dasselbe" ist, fällt hier: dieselbe Quelle (Lebensmittel oder Rezept,
 * sonst der Name), dieselben Werte pro Portion und derselbe Zeitpunkt im Tag.
 * Zwei Einträge mit demselben Namen, aber anderen Werten bleiben getrennt —
 * das eine Glas Milch mit 90 kcal ist eben nicht das andere mit 240.
 *
 * Reine Logik, kein IO: die Struktur der Einträge reicht.
 */

import type { DataQuality, MealSlot } from './types';
import { combineQuality } from './nutritionMath';

export type StackableEntry = {
  id: string;
  name: string;
  slot: MealSlot | null;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalMin: number | null;
  kcalMax: number | null;
  dataQuality: DataQuality;
  loggedAt: string;
  foodItemId: string | null;
  recipeId: string | null;
};

export type MealStack<T extends StackableEntry = StackableEntry> = {
  key: string;
  /** Chronologisch, ältester zuerst. */
  entries: T[];
  /** Der älteste — er bestimmt Platz und Uhrzeit in der Liste. */
  first: T;
  /** Der jüngste — ihn nimmt „einen entfernen" zuerst zurück. */
  latest: T;
  name: string;
  slot: MealSlot | null;
  /** Summe der Portionen: 1 + 1 = 2, halbe zählen halb. */
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalMin: number | null;
  kcalMax: number | null;
  dataQuality: DataQuality;
};

function servingsOf(entry: StackableEntry): number {
  return entry.servings > 0 ? entry.servings : 1;
}

/** Wert einer einzelnen Portion, grob gerundet gegen Fließkomma-Rauschen. */
function perServing(value: number, entry: StackableEntry): number {
  return Math.round((value / servingsOf(entry)) * 10) / 10;
}

function stackKey(entry: StackableEntry): string {
  const identity = entry.foodItemId ?? entry.recipeId ?? entry.name.trim().toLowerCase();
  return [
    entry.slot ?? 'other',
    identity,
    perServing(entry.kcal, entry),
    perServing(entry.proteinG, entry),
  ].join('|');
}

/**
 * Fasst gleiche Einträge zusammen. Die Reihenfolge folgt dem jeweils ersten
 * Eintrag eines Stapels, damit ein zweites Glas Milch die Zeile nicht plötzlich
 * ans Ende der Liste schiebt.
 */
export function stackMealEntries<T extends StackableEntry>(entries: readonly T[]): MealStack<T>[] {
  const byKey = new Map<string, MealStack<T>>();

  const chronological = [...entries].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  for (const entry of chronological) {
    const key = stackKey(entry);
    const stack = byKey.get(key);

    if (!stack) {
      byKey.set(key, {
        key,
        entries: [entry],
        first: entry,
        latest: entry,
        name: entry.name,
        slot: entry.slot,
        servings: servingsOf(entry),
        kcal: entry.kcal,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        kcalMin: entry.kcalMin,
        kcalMax: entry.kcalMax,
        dataQuality: entry.dataQuality,
      });
      continue;
    }

    const kcalSoFar = stack.kcal;
    const hasRange =
      stack.kcalMin !== null || stack.kcalMax !== null || entry.kcalMin !== null || entry.kcalMax !== null;

    stack.entries.push(entry);
    stack.latest = entry;
    stack.servings += servingsOf(entry);
    stack.kcal += entry.kcal;
    stack.proteinG += entry.proteinG;
    stack.carbsG += entry.carbsG;
    stack.fatG += entry.fatG;
    stack.dataQuality = combineQuality([stack.dataQuality, entry.dataQuality]);

    // Spannen addieren sich; wo keine steht, zählt der feste Wert.
    if (hasRange) {
      stack.kcalMin = (stack.kcalMin ?? kcalSoFar) + (entry.kcalMin ?? entry.kcal);
      stack.kcalMax = (stack.kcalMax ?? kcalSoFar) + (entry.kcalMax ?? entry.kcal);
    }
  }

  return [...byKey.values()];
}

/** „2", „1,5" — das Vielfache vor dem × in der Liste. */
export function formatServings(servings: number): string {
  return servings.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
