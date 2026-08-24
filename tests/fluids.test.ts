import { describe, expect, it } from 'vitest';
import { fluidFromEntry, isAlcohol, isDrink, volumeInText, GLASS_ML } from '@/domain/fluids';

describe('recognising a drink', () => {
  it('knows the obvious ones', () => {
    for (const name of ['Wasser', 'Grüner Tee', 'Kaffee', 'Cola Zero', 'Apfelsaft', 'Milch']) {
      expect(isDrink(name), name).toBe(true);
    }
  });

  it('knows the ones this app actually sees', () => {
    // The user's own examples.
    expect(isDrink('Red Bull')).toBe(true);
    expect(isDrink('Isoclear Zitrone')).toBe(true);
    expect(isDrink('Proteinshake')).toBe(true);
  });

  it('tolerates umlauts and ß', () => {
    expect(isDrink('Hühnerbrühe')).toBe(true);
    expect(isDrink('Eiweißshake')).toBe(true);
  });

  it('leaves solid food alone', () => {
    for (const name of ['Brötchen mit Marmelade', 'Hähnchenbrust', 'Skyr', 'Reis']) {
      expect(isDrink(name), name).toBe(false);
    }
  });

  it('excludes alcohol, which does not hydrate', () => {
    expect(isAlcohol('Feierabendbier')).toBe(true);
    expect(isDrink('Feierabendbier')).toBe(false);
    expect(isDrink('Rotwein')).toBe(false);
  });
});

describe('reading a volume out of the text', () => {
  it('reads millilitres, centilitres and litres', () => {
    expect(volumeInText('Red Bull 250 ml')).toBe(250);
    expect(volumeInText('Cola 33cl')).toBe(330);
    expect(volumeInText('Wasser 1 l')).toBe(1000);
    expect(volumeInText('0,5 Liter Saft')).toBe(500);
  });

  it('handles the German decimal comma', () => {
    expect(volumeInText('1,5l Wasser')).toBe(1500);
  });

  it('returns null when there is no volume', () => {
    expect(volumeInText('Red Bull')).toBeNull();
    expect(volumeInText('Kaffee schwarz')).toBeNull();
  });

  it('rejects an implausible volume rather than crediting 40 litres', () => {
    expect(volumeInText('Wasser 40 l')).toBeNull();
  });
});

describe('fluidFromEntry', () => {
  it('prefers a volume written in the name', () => {
    expect(fluidFromEntry({ name: 'Red Bull 250 ml' })).toEqual({ ml: 250, source: 'text' });
  });

  it('multiplies by the servings', () => {
    expect(fluidFromEntry({ name: 'Red Bull 250 ml', servings: 2 })?.ml).toBe(500);
  });

  it('falls back to the stored serving size', () => {
    expect(fluidFromEntry({ name: 'Isoclear', servingG: 500 })).toEqual({ ml: 500, source: 'serving' });
  });

  it('reads a volume out of the serving label', () => {
    expect(fluidFromEntry({ name: 'Cola', servingLabel: '0,33 l Dose' })).toEqual({ ml: 330, source: 'text' });
  });

  it('falls back to one glass, and says that is what it did', () => {
    expect(fluidFromEntry({ name: 'Kaffee' })).toEqual({ ml: GLASS_ML, source: 'glass' });
  });

  it('returns null for food', () => {
    expect(fluidFromEntry({ name: 'Brötchen mit Marmelade' })).toBeNull();
  });

  it('returns null for beer, even with a volume on it', () => {
    expect(fluidFromEntry({ name: 'Bier 0,5 l' })).toBeNull();
  });
});
