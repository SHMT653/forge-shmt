import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const WHITE_TILE: [number, number, number] = [255, 255, 255];

/**
 * The install icon is intentionally static: a plain white tile with only the
 * Forge mark. macOS/iOS cache PWA artwork aggressively, so every legacy icon
 * path also points at the same visual fallback.
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
  const [r, g, b] = cornerRgba(path);
  return [r, g, b];
}

function cornerRgba(path: string): [number, number, number, number] {
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
  return [raw[1]!, raw[2]!, raw[3]!, raw[4]!];
}

describe('app icons', () => {
  it('ships one static white tile across legacy light and dark filenames', () => {
    const light = png('public/icons/apple-touch-icon-light.png');
    const dark = png('public/icons/apple-touch-icon-dark.png');
    expect(light.bytes.equals(dark.bytes)).toBe(true);
    expect(png('public/icons/app-icon-light-512.png').bytes.equals(png('public/icons/app-icon-dark-512.png').bytes)).toBe(true);
    expect(png('public/icon-512.png').bytes.equals(png('public/icons/forge-white-icon-512.png').bytes)).toBe(true);
  });

  it('uses RGBA PNGs for every shipped icon slot', () => {
    for (const name of ['favicon-16', 'favicon-32', 'lockup', 'mark', 'mark-256',
                        'apple-touch-icon', 'apple-touch-icon-light', 'apple-touch-icon-dark',
                        'app-icon-light-192', 'app-icon-dark-192', 'app-icon-light-512', 'app-icon-dark-512',
                        'icon-192', 'icon-512', 'maskable-512',
                        'forge-white-apple-touch-icon', 'forge-white-icon-192', 'forge-white-icon-512',
                        'forge-white-maskable-512']) {
      expect(png(`public/icons/${name}.png`).colorType, name).toBe(6);
    }
    for (const name of ['apple-touch-icon', 'icon-16', 'icon-32', 'icon-192', 'icon-512', 'icon-maskable-512']) {
      expect(png(`public/${name}.png`).colorType, name).toBe(6);
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
      ['forge-white-apple-touch-icon', 180],
      ['forge-white-icon-192', 192],
      ['forge-white-icon-512', 512],
      ['forge-white-maskable-512', 512],
    ] as const) {
      const file = png(`public/icons/${name}.png`);
      expect(file.width, name).toBe(size);
      expect(file.height, name).toBe(size);
      expect(file.depth, name).toBe(8);
    }
    for (const [name, size] of [
      ['apple-touch-icon', 180],
      ['icon-16', 16],
      ['icon-32', 32],
      ['icon-192', 192],
      ['icon-512', 512],
      ['icon-maskable-512', 512],
    ] as const) {
      const file = png(`public/${name}.png`);
      expect(file.width, name).toBe(size);
      expect(file.height, name).toBe(size);
      expect(file.depth, name).toBe(8);
    }
  });

  it('paints every installed app tile white', () => {
    for (const path of [
      'public/apple-touch-icon.png',
      'public/icon-192.png',
      'public/icon-512.png',
      'public/icon-maskable-512.png',
      'public/icons/apple-touch-icon.png',
      'public/icons/apple-touch-icon-light.png',
      'public/icons/apple-touch-icon-dark.png',
      'public/icons/app-icon-light-512.png',
      'public/icons/app-icon-dark-512.png',
      'public/icons/icon-512.png',
      'public/icons/icon-512-light.png',
      'public/icons/icon-512-dark.png',
      'public/icons/maskable-512.png',
      'public/icons/forge-white-apple-touch-icon.png',
      'public/icons/forge-white-icon-192.png',
      'public/icons/forge-white-icon-512.png',
      'public/icons/forge-white-maskable-512.png',
    ]) {
      expect(cornerPixel(path), path).toEqual(WHITE_TILE);
    }
  });

  it('uses one apple icon without colour-scheme media variants', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const apple = /apple: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(apple).toContain("url: '/icons/forge-white-apple-touch-icon.png'");
    expect(apple).not.toContain('prefers-color-scheme');
    expect(apple).not.toContain('apple-touch-icon-light.png');
    expect(apple).not.toContain('apple-touch-icon-dark.png');
  });

  it('uses the same static manifest path as NEO', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("manifest: '/manifest.json'");
    expect(layout).not.toContain('manifest.webmanifest');
    expect(existsSync('app/manifest.ts')).toBe(false);
  });

  it('keeps favicons first and adds the static install tile', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const favicons = /icon: \[(.*?)\],/s.exec(layout)?.[1] ?? '';
    expect(favicons).toMatch(/icon-16\.png[\s\S]*?icon-32\.png[\s\S]*?icon-192\.png[\s\S]*?icon-512\.png/);
    expect(favicons).toContain('/icons/forge-white-icon-512.png');
    expect(favicons).not.toContain('prefers-color-scheme');
  });

  it('keeps the unsuffixed home-screen fallback white for old cached paths', () => {
    expect(cornerRgba('public/icons/apple-touch-icon.png')).toEqual([255, 255, 255, 255]);
    expect(cornerRgba('public/apple-touch-icon.png')).toEqual([255, 255, 255, 255]);
  });

  it('gives maskable its own artwork rather than relabelling the full tile', () => {
    // Declaring an edge-to-edge design maskable is what made the icon render as
    // a small square on a plate: the launcher crops to the safe zone and pads
    // whatever is left.
    const full = readFileSync('public/icons/icon-512.png');
    const maskable = readFileSync('public/icons/icon-512-maskable.png');
    expect(full.equals(maskable)).toBe(false);

    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
      icons: Array<{ src: string; purpose: string; sizes: string; type: string }>;
    };
    expect(manifest.icons).toEqual([
      { src: '/icons/forge-white-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/forge-white-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/forge-white-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('keeps the artwork smaller on maskable icons', () => {
    expect(readFileSync('public/icons/forge-white-icon-512.png').equals(readFileSync('public/icons/forge-white-maskable-512.png'))).toBe(false);
    expect(cornerPixel('public/icons/forge-white-maskable-512.png')).toEqual(WHITE_TILE);
  });
});
