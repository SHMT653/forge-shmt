/**
 * Liquid counts as liquid.
 *
 * Water was the only thing that moved the hydration target, so a day spent on
 * tea, an Isoclear and a Red Bull read as a day of drinking nothing. Anything
 * with a volume now credits the fluid target as well as the calorie one.
 *
 * Three ways to find the volume, in order of how much they are actually
 * knowing rather than guessing:
 *
 *  1. A volume written in the entry itself ("Red Bull 250 ml", "0,5 l Cola").
 *  2. The stored serving size, for a food the user has saved as a drink —
 *     1 g of a drink is close enough to 1 ml for a hydration target.
 *  3. A drink recognised by name with no volume anywhere: one glass, 250 ml.
 *     A stated default beats both ignoring it and inventing a bottle.
 *
 * Alcohol is deliberately excluded. Counting a beer toward a hydration goal
 * would be the one case where the number moves the wrong way.
 */

const DRINK_WORDS = [
  'wasser', 'sprudel', 'mineralwasser', 'leitungswasser',
  'tee', 'kaffee', 'espresso', 'cappuccino', 'latte', 'milchkaffee',
  'cola', 'limo', 'limonade', 'fanta', 'sprite', 'spezi', 'brause',
  'saft', 'juice', 'schorle', 'nektar', 'smoothie',
  'milch', 'buttermilch', 'kefir', 'ayran', 'kakao',
  'energy', 'energydrink', 'red bull', 'redbull', 'monster', 'rockstar',
  'iso', 'isoclear', 'isodrink', 'isotonisch', 'elektrolyt',
  'shake', 'proteinshake', 'eiweissshake', 'whey',
  'brühe', 'bruehe', 'suppe', 'infusion', 'kombucha', 'eistee',
];

/** Excluded on purpose — see the note above. */
const ALCOHOL_WORDS = [
  'bier', 'pils', 'weizen', 'radler', 'wein', 'sekt', 'prosecco', 'champagner',
  'schnaps', 'wodka', 'vodka', 'whisky', 'whiskey', 'rum', 'gin', 'likör', 'likoer',
  'cocktail', 'aperol', 'hugo', 'longdrink', 'shot',
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

export function isAlcohol(name: string): boolean {
  const folded = fold(name);
  return ALCOHOL_WORDS.some((word) => folded.includes(fold(word)));
}

export function isDrink(name: string): boolean {
  if (isAlcohol(name)) return false;
  const folded = fold(name);
  return DRINK_WORDS.some((word) => folded.includes(fold(word)));
}

/** A volume written into the text, in millilitres. Null when there is none. */
export function volumeInText(text: string): number | null {
  // Matched with the unit attached or spaced, and with a German decimal comma.
  const match = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l|liter|litre)\b/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2]!.toLowerCase();
  const ml = unit === 'ml' ? value : unit === 'cl' ? value * 10 : value * 1000;
  // Above five litres in one entry is a typo, not a drink.
  return ml > 0 && ml <= 5000 ? Math.round(ml) : null;
}

/** One glass — the stated fallback for a drink with no volume anywhere. */
export const GLASS_ML = 250;

export type FluidSource = 'text' | 'serving' | 'glass';

export type FluidEstimate = {
  ml: number;
  source: FluidSource;
};

/**
 * How much fluid a logged entry contributed, or null when it is not a drink.
 *
 * `servings` multiplies a volume read from the text or the serving size, so
 * "2 × Red Bull 250 ml" credits half a litre. It does not multiply the glass
 * fallback beyond the same rule — two glasses is still two glasses.
 */
export function fluidFromEntry(entry: {
  name: string;
  servingLabel?: string | null;
  servingG?: number | null;
  servings?: number | null;
}): FluidEstimate | null {
  if (!isDrink(entry.name)) return null;

  const count = entry.servings && entry.servings > 0 ? entry.servings : 1;

  const fromName = volumeInText(entry.name) ?? (entry.servingLabel ? volumeInText(entry.servingLabel) : null);
  if (fromName !== null) return { ml: Math.round(fromName * count), source: 'text' };

  // A drink's grams and millilitres are close enough for a hydration target.
  if (entry.servingG && entry.servingG > 0 && entry.servingG <= 5000) {
    return { ml: Math.round(entry.servingG * count), source: 'serving' };
  }

  return { ml: Math.round(GLASS_ML * count), source: 'glass' };
}
