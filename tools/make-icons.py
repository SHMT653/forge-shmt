#!/usr/bin/env python3
"""
Builds the app icons from public/logo.png.

The shipped apple-touch-icons were three byte-identical copies of one file, all
carrying a flat #1a191c background that matched neither the app (#0a0a0d) nor
anything on the home screen — which is why the tile read as a grey patch. There
was no light variant at all despite the filename claiming one.

The background is replaced by flood-filling inward from the border, not by
colour-keying the whole image. The logo mark has a dark centre in almost exactly
the background colour, and a colour key would punch a hole straight through it.
A fill that can only reach pixels connected to the edge cannot.

Pure standard library: zlib for the PNG, no image dependency to install.
"""

import struct
import sys
import zlib
from collections import deque
from pathlib import Path


def read_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path}: not a PNG')
    pos, idat, meta = 8, b'', {}
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b'IHDR':
            meta['w'], meta['h'], meta['depth'], meta['color'] = struct.unpack('>IIBB', chunk[:10])
            meta['interlace'] = chunk[12]
        elif kind == b'IDAT':
            idat += chunk
        pos += 12 + length
    if meta.get('depth') != 8 or meta.get('color') not in (2, 6) or meta.get('interlace'):
        raise SystemExit(f'{path}: only non-interlaced 8-bit RGB/RGBA is supported')
    return meta, unfilter(zlib.decompress(idat), meta['w'], meta['h'], 4 if meta['color'] == 6 else 3)


def unfilter(raw, w, h, channels):
    stride = w * channels
    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f == 1:
            for x in range(channels, stride):
                line[x] = (line[x] + line[x - channels]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - channels] if x >= channels else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - channels] if x >= channels else 0
                b = prev[x]
                c = prev[x - channels] if x >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        elif f != 0:
            raise SystemExit(f'unsupported filter {f}')
        out += line
        prev = line
    return out


def write_png(path, w, h, rgb):
    """Writes opaque RGB. No alpha: iOS composites a transparent icon against
    a colour of its own choosing, which is the other half of the weird tile."""
    raw = bytearray()
    stride = w * 3
    for y in range(h):
        raw.append(0)
        raw += rgb[y * stride:(y + 1) * stride]

    def chunk(kind, payload):
        return (struct.pack('>I', len(payload)) + kind + payload
                + struct.pack('>I', zlib.crc32(kind + payload) & 0xFFFFFFFF))

    Path(path).write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )


def flatten(pixels, w, h, channels, background):
    """RGBA over a background colour, as plain RGB."""
    out = bytearray(w * h * 3)
    for i in range(w * h):
        src = i * channels
        if channels == 4:
            a = pixels[src + 3] / 255
            for c in range(3):
                out[i * 3 + c] = round(pixels[src + c] * a + background[c] * (1 - a))
        else:
            out[i * 3:i * 3 + 3] = pixels[src:src + 3]
    return out


def replace_border_background(rgb, w, h, target, tolerance=26):
    """
    Repaints the background by flooding inward from the border.

    Only pixels reachable from an edge without crossing the artwork change, so
    the mark's dark centre — nearly the same colour as the background — is left
    alone. Edge pixels are blended rather than snapped, which keeps the
    anti-aliased outline of the logo from turning into a hard jaggy edge.
    """
    seed = tuple(rgb[0:3])
    seen = bytearray(w * h)
    queue = deque()

    def close(i):
        return all(abs(rgb[i * 3 + c] - seed[c]) <= tolerance for c in range(3))

    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not seen[i] and close(i):
                seen[i] = 1; queue.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not seen[i] and close(i):
                seen[i] = 1; queue.append(i)

    filled = 0
    while queue:
        i = queue.popleft()
        filled += 1
        rgb[i * 3:i * 3 + 3] = bytes(target)
        x, y = i % w, i // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not seen[j]:
                    seen[j] = 1
                    if close(j):
                        queue.append(j)
    return filled


def box_resize(rgb, w, h, size):
    """Area-average downscale. Good enough, and it needs no dependency."""
    out = bytearray(size * size * 3)
    for oy in range(size):
        y0, y1 = oy * h // size, max(oy * h // size + 1, (oy + 1) * h // size)
        for ox in range(size):
            x0, x1 = ox * w // size, max(ox * w // size + 1, (ox + 1) * w // size)
            totals = [0, 0, 0]
            count = 0
            for y in range(y0, y1):
                row = y * w
                for x in range(x0, x1):
                    src = (row + x) * 3
                    totals[0] += rgb[src]; totals[1] += rgb[src + 1]; totals[2] += rgb[src + 2]
                    count += 1
            for c in range(3):
                out[(oy * size + ox) * 3 + c] = totals[c] // count
    return out


DARK = (10, 10, 13)      # matches the app background and the manifest theme
LIGHT = (244, 244, 247)  # a near-white tile for a phone in light mode

def main():
    source = sys.argv[1] if len(sys.argv) > 1 else 'public/logo.png'
    meta, pixels = read_png(source)
    w, h = meta['w'], meta['h']
    channels = 4 if meta['color'] == 6 else 3
    print(f'{source}: {w}x{h}, {channels} channels')

    for name, background in (('dark', DARK), ('light', LIGHT)):
        rgb = flatten(pixels, w, h, channels, background)
        filled = replace_border_background(rgb, w, h, background)
        print(f'  {name}: repainted {filled} background pixels ({filled * 100 // (w * h)} %)')
        for size, out in ((180, f'public/icons/apple-touch-icon-{name}.png'),
                          (192, f'public/icons/icon-192-{name}.png'),
                          (512, f'public/icons/icon-512-{name}.png')):
            write_png(out, size, size, box_resize(rgb, w, h, size))
            print(f'    → {out}')

    # The unsuffixed names stay, for anything that asks without a media query.
    dark = flatten(pixels, w, h, channels, DARK)
    replace_border_background(dark, w, h, DARK)
    for size, out in ((180, 'public/icons/apple-touch-icon.png'),
                      (192, 'public/icons/icon-192.png'),
                      (512, 'public/icons/icon-512.png')):
        write_png(out, size, size, box_resize(dark, w, h, size))
        print(f'    → {out} (default)')


if __name__ == '__main__':
    main()
