import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/**
 * The shipped apple-touch-icons were three byte-identical copies of one file,
 * all with an alpha channel and a background that matched nothing. Nobody
 * noticed because an icon has no types and no test.
 */

function png(path: string) {
  const data = readFileSync(path);
  expect(data.subarray(0, 8).toString('binary'), path).toBe('\x89PNG\r\n\x1a\n');
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    depth: data[24]!,
    colorType: data[25]!,
    bytes: data,
  };
}

/**
 * The top-left pixel, which every PNG filter reconstructs to its raw value:
 * each predictor reads from the pixel to the left and the row above, and at
 * (0, 0) both are zero.
 */
function cornerPixel(path: string): [number, number, number] {
  const data = readFileSync(path);
  let pos = 8;
  const parts: Buffer[] = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const kind = data.subarray(pos + 4, pos + 8).toString('ascii');
    if (kind === 'IDAT') parts.push(data.subarray(pos + 8, pos + 8 + length));
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  return [raw[1]!, raw[2]!, raw[3]!];
}

describe('app icons', () => {
  it('ships a light and a dark tile that are actually different images', () => {
    const light = png('public/icons/apple-touch-icon-light.png');
    const dark = png('public/icons/apple-touch-icon-dark.png');
    expect(light.bytes.equals(dark.bytes)).toBe(false);
  });

  it('has no alpha channel, so iOS cannot pick its own backdrop', () => {
    // colorType 2 is RGB; 6 would be RGBA.
    for (const name of ['apple-touch-icon', 'apple-touch-icon-light', 'apple-touch-icon-dark',
                        'icon-192', 'icon-512']) {
      expect(png(`public/icons/${name}.png`).colorType, name).toBe(2);
    }
  });

  it('is the size each filename claims', () => {
    for (const [name, size] of [
      ['apple-touch-icon', 180], ['apple-touch-icon-light', 180], ['apple-touch-icon-dark', 180],
      ['icon-192', 192], ['icon-192-light', 192], ['icon-192-dark', 192],
      ['icon-512', 512], ['icon-512-light', 512], ['icon-512-dark', 512],
      ['icon-192-maskable', 192], ['icon-512-maskable', 512],
    ] as const) {
      const file = png(`public/icons/${name}.png`);
      expect(file.width, name).toBe(size);
      expect(file.height, name).toBe(size);
      expect(file.depth, name).toBe(8);
    }
  });

  it('paints each tile in the colour its name promises', () => {
    // The old icon's #1a191c is what made the tile read as a grey patch next to
    // everything else on the home screen.
    expect(cornerPixel('public/icons/apple-touch-icon-dark.png')).toEqual([10, 10, 13]);
    expect(cornerPixel('public/icons/apple-touch-icon-light.png')).toEqual([244, 244, 247]);
    // The fallback is the dark one, because the app itself is dark.
    expect(cornerPixel('public/icons/apple-touch-icon.png')).toEqual([10, 10, 13]);
  });

  it('offers the home screen exactly one icon', () => {
    // iOS ignores `media` on an apple-touch-icon and takes the first link it
    // finds. With a light variant listed first, a dark-mode phone got a white
    // tile — worse than not adapting at all.
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const apple = /apple: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(apple).toMatch(/apple-touch-icon\.png/);
    expect(apple).not.toMatch(/apple-touch-icon-light/);
    expect(apple).not.toMatch(/apple-touch-icon-dark/);
    expect(apple).not.toMatch(/prefers-color-scheme/);
  });

  it('keeps both variants for the tab icon, where the query does work', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const favicons = /icon: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(favicons).toMatch(/icon-192-light\.png[\s\S]*?prefers-color-scheme: light/);
    expect(favicons).toMatch(/icon-192-dark\.png[\s\S]*?prefers-color-scheme: dark/);
  });

  it('makes the one home-screen tile the dark one', () => {
    expect(cornerPixel('public/icons/apple-touch-icon.png')).toEqual([10, 10, 13]);
  });

  it('gives maskable its own artwork rather than relabelling the full tile', () => {
    // Declaring an edge-to-edge design maskable is what made the icon render as
    // a small square on a plate: the launcher crops to the safe zone and pads
    // whatever is left.
    const full = readFileSync('public/icons/icon-512.png');
    const maskable = readFileSync('public/icons/icon-512-maskable.png');
    expect(full.equals(maskable)).toBe(false);

    const manifest = readFileSync('app/manifest.ts', 'utf8');
    expect(manifest).toMatch(/icon-512-maskable\.png[\s\S]*?purpose: 'maskable'/);
    expect(manifest).not.toMatch(/icon-512\.png', sizes: '512x512', type: 'image\/png', purpose: 'maskable'/);
  });

  it('keeps the artwork clear of the mask', () => {
    // A squircle eats the corners. Anything at the very edge of the tile is a
    // pixel the phone will not show.
    for (const name of ['apple-touch-icon', 'apple-touch-icon-light']) {
      expect(cornerPixel(`public/icons/${name}.png`), name)
        .toEqual(name.endsWith('light') ? [244, 244, 247] : [10, 10, 13]);
    }
  });
});
