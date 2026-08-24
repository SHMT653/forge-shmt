import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const DARK_TILE: [number, number, number] = [8, 7, 12];
const LIGHT_TILE: [number, number, number] = [244, 245, 251];

/**
 * The app icon follows the same contract as NEO: transparent lockups for plain
 * icon slots, plus RGBA light/dark tiles for installed app surfaces.
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

  it('uses RGBA PNGs like NEO, including transparent lockup icons', () => {
    for (const name of ['favicon-16', 'favicon-32', 'lockup', 'mark', 'mark-256',
                        'apple-touch-icon', 'apple-touch-icon-light', 'apple-touch-icon-dark',
                        'app-icon-light-192', 'app-icon-dark-192', 'app-icon-light-512', 'app-icon-dark-512',
                        'icon-192', 'icon-512', 'maskable-512']) {
      expect(png(`public/icons/${name}.png`).colorType, name).toBe(6);
    }
  });

  it('is the size each filename claims', () => {
    for (const [name, size] of [
      ['favicon-16', 16], ['favicon-32', 32],
      ['lockup', 512], ['mark', 512], ['mark-256', 256],
      ['apple-touch-icon', 180], ['apple-touch-icon-light', 180], ['apple-touch-icon-dark', 180],
      ['app-icon-light-192', 192], ['app-icon-dark-192', 192],
      ['app-icon-light-512', 512], ['app-icon-dark-512', 512],
      ['icon-192', 192], ['icon-192-light', 192], ['icon-192-dark', 192],
      ['icon-512', 512], ['icon-512-light', 512], ['icon-512-dark', 512],
      ['icon-192-maskable', 192], ['icon-512-maskable', 512], ['maskable-512', 512],
    ] as const) {
      const file = png(`public/icons/${name}.png`);
      expect(file.width, name).toBe(size);
      expect(file.height, name).toBe(size);
      expect(file.depth, name).toBe(8);
    }
  });

  it('paints each tile in the colour its name promises', () => {
    expect(cornerPixel('public/icons/apple-touch-icon-dark.png')).toEqual(DARK_TILE);
    expect(cornerPixel('public/icons/app-icon-dark-512.png')).toEqual(DARK_TILE);
    expect(cornerPixel('public/icons/apple-touch-icon-light.png')).toEqual(LIGHT_TILE);
    expect(cornerPixel('public/icons/app-icon-light-512.png')).toEqual(LIGHT_TILE);
    // iOS/macOS install surfaces often ignore media-qualified apple icons.
    // The stable fallback must therefore match the dark NEO-looking tile.
    expect(cornerPixel('public/icons/apple-touch-icon.png')).toEqual(DARK_TILE);
  });

  it('keeps the stable apple fallback before optional light/dark variants', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const apple = /apple: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(apple).toMatch(/apple-touch-icon\.png[\s\S]*?apple-touch-icon-light\.png[\s\S]*?apple-touch-icon-dark\.png/);
    expect(apple).toMatch(/apple-touch-icon-light\.png[\s\S]*?prefers-color-scheme: light/);
    expect(apple).toMatch(/apple-touch-icon-dark\.png[\s\S]*?prefers-color-scheme: dark/);
  });

  it('uses the same static manifest path as NEO', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("manifest: '/manifest.json'");
    expect(layout).not.toContain('manifest.webmanifest');
    expect(existsSync('app/manifest.ts')).toBe(false);
  });

  it('keeps both variants for the tab icon, where the query does work', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const favicons = /icon: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(favicons).toMatch(/favicon-16\.png[\s\S]*?favicon-32\.png[\s\S]*?icon-192\.png[\s\S]*?icon-512\.png/);
    expect(favicons).toMatch(/app-icon-light-512\.png[\s\S]*?prefers-color-scheme: light/);
    expect(favicons).toMatch(/app-icon-dark-512\.png[\s\S]*?prefers-color-scheme: dark/);
  });

  it('keeps the unsuffixed home-screen fallback on the NEO dark tile', () => {
    expect(cornerPixel('public/icons/apple-touch-icon.png')).toEqual(DARK_TILE);
  });

  it('gives maskable its own artwork rather than relabelling the full tile', () => {
    // Declaring an edge-to-edge design maskable is what made the icon render as
    // a small square on a plate: the launcher crops to the safe zone and pads
    // whatever is left.
    const full = readFileSync('public/icons/icon-512.png');
    const maskable = readFileSync('public/icons/icon-512-maskable.png');
    expect(full.equals(maskable)).toBe(false);

    const manifest = readFileSync('public/manifest.json', 'utf8');
    expect(manifest).toMatch(/app-icon\.svg[\s\S]*?"purpose": "any"/);
    expect(manifest).toMatch(/maskable-icon\.svg[\s\S]*?"purpose": "maskable"/);
    expect(manifest).toMatch(/maskable-512\.png[\s\S]*?"purpose": "maskable"/);
    expect(manifest).not.toMatch(/icon-512\.png', sizes: '512x512', type: 'image\/png', purpose: 'maskable'/);
  });

  it('keeps the artwork clear of the mask', () => {
    // A squircle eats the corners. Anything at the very edge of the tile is a
    // pixel the phone will not show.
    for (const name of ['apple-touch-icon', 'apple-touch-icon-light']) {
      expect(cornerPixel(`public/icons/${name}.png`), name)
        .toEqual(name.endsWith('light') ? LIGHT_TILE : DARK_TILE);
    }
  });
});
