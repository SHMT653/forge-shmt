#!/usr/bin/env python3
"""
Builds the Forge app icons from public/logo.png.

The public logo includes a wordmark and a lot of transparent padding. That is
good for branding, but bad for launcher icons: the mark looks too small and the
text becomes unreadable. This generator crops the visible Forge mark from the
upper part of the artwork, then places it on the same adaptive light/dark tile
system used by NEO.

Pure standard library: zlib for PNG, base64 for the embedded SVG artwork.
"""

import base64
import struct
import sys
import zlib
from pathlib import Path


DARK = (8, 7, 12)
LIGHT = (244, 245, 251)
DARK_HEX = '#08070c'
LIGHT_HEX = '#f4f5fb'
ALPHA_THRESHOLD = 8

APP_SCALE = 0.82
MASKABLE_SCALE = 0.70


def read_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path}: not a PNG')

    pos = 8
    idat = b''
    meta = {}
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

    channels = 4 if meta['color'] == 6 else 3
    return meta, unfilter(zlib.decompress(idat), meta['w'], meta['h'], channels)


def unfilter(raw, w, h, channels):
    stride = w * channels
    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
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
            raise SystemExit(f'unsupported PNG filter {f}')
        out += line
        prev = line
    return out


def png_bytes(w, h, pixels, channels=3):
    raw = bytearray()
    stride = w * channels
    for y in range(h):
        raw.append(0)
        raw += pixels[y * stride:(y + 1) * stride]

    def chunk(kind, payload):
        return (
            struct.pack('>I', len(payload))
            + kind
            + payload
            + struct.pack('>I', zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6 if channels == 4 else 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )


def write_png(path, w, h, pixels, channels=3):
    Path(path).write_bytes(png_bytes(w, h, pixels, channels))


def alpha_at(pixels, channels, index):
    return pixels[index * channels + 3] if channels == 4 else 255


def alpha_bbox(pixels, w, h, channels, max_y=None):
    limit_y = h if max_y is None else min(h, max_y)
    x0, y0 = w, h
    x1, y1 = -1, -1

    for y in range(limit_y):
        row = y * w
        for x in range(w):
            if alpha_at(pixels, channels, row + x) > ALPHA_THRESHOLD:
                x0 = min(x0, x)
                y0 = min(y0, y)
                x1 = max(x1, x + 1)
                y1 = max(y1, y + 1)

    if x1 < x0 or y1 < y0:
        raise SystemExit('could not find visible artwork in source')
    return x0, y0, x1, y1


def crop(pixels, w, channels, bbox):
    x0, y0, x1, y1 = bbox
    out_w = x1 - x0
    out_h = y1 - y0
    out = bytearray(out_w * out_h * channels)
    for y in range(out_h):
        src = ((y0 + y) * w + x0) * channels
        dst = y * out_w * channels
        out[dst:dst + out_w * channels] = pixels[src:src + out_w * channels]
    return out, out_w, out_h


def resize(pixels, w, h, out_w, out_h, channels):
    """
    Area-average resize. RGB is averaged premultiplied by alpha so the
    transparent pixels around the cut-out do not darken the glowing edges.
    """
    out = bytearray(out_w * out_h * channels)
    for oy in range(out_h):
        y0 = oy * h // out_h
        y1 = max(y0 + 1, (oy + 1) * h // out_h)
        for ox in range(out_w):
            x0 = ox * w // out_w
            x1 = max(x0 + 1, (ox + 1) * w // out_w)
            totals = [0.0, 0.0, 0.0]
            alpha_total = 0.0
            count = 0
            for y in range(y0, y1):
                row = y * w
                for x in range(x0, x1):
                    src = (row + x) * channels
                    a = pixels[src + 3] / 255 if channels == 4 else 1.0
                    for c in range(3):
                        totals[c] += pixels[src + c] * a
                    alpha_total += a
                    count += 1

            dst = (oy * out_w + ox) * channels
            if channels == 4:
                mean_alpha = alpha_total / count
                for c in range(3):
                    out[dst + c] = 0 if alpha_total == 0 else min(255, round(totals[c] / alpha_total))
                out[dst + 3] = round(mean_alpha * 255)
            else:
                for c in range(3):
                    out[dst + c] = round(totals[c] / count)
    return out


def fit_dimensions(w, h, size, scale):
    max_w = round(size * scale)
    max_h = round(size * scale)
    if w >= h:
        out_w = max_w
        out_h = max(1, round(h * out_w / w))
        if out_h > max_h:
            out_h = max_h
            out_w = max(1, round(w * out_h / h))
    else:
        out_h = max_h
        out_w = max(1, round(w * out_h / h))
        if out_w > max_w:
            out_w = max_w
            out_h = max(1, round(h * out_w / w))
    return out_w, out_h


def compose_tile(mark, mark_w, mark_h, size, background, scale):
    out = bytearray(background * (size * size))
    art_w, art_h = fit_dimensions(mark_w, mark_h, size, scale)
    art = resize(mark, mark_w, mark_h, art_w, art_h, 4)
    offset_x = (size - art_w) // 2
    offset_y = (size - art_h) // 2

    for y in range(art_h):
        for x in range(art_w):
            src = (y * art_w + x) * 4
            dst = ((offset_y + y) * size + offset_x + x) * 3
            a = art[src + 3] / 255
            for c in range(3):
                out[dst + c] = round(art[src + c] * a + out[dst + c] * (1 - a))
    return out


def svg_image_box(mark_w, mark_h, size, scale):
    art_w, art_h = fit_dimensions(mark_w, mark_h, size, scale)
    return (size - art_w) // 2, (size - art_h) // 2, art_w, art_h


def write_adaptive_svg(path, mark, mark_w, mark_h, scale, rounded=False):
    x, y, width, height = svg_image_box(mark_w, mark_h, 512, scale)
    mark_png = base64.b64encode(png_bytes(mark_w, mark_h, mark, 4)).decode('ascii')
    radius = ' rx="112"' if rounded else ''
    Path(path).write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        '  <style>\n'
        '    :root { color-scheme: light dark; }\n'
        f'    .tile {{ fill: {DARK_HEX}; }}\n'
        f'    @media (prefers-color-scheme: light) {{ .tile {{ fill: {LIGHT_HEX}; }} }}\n'
        '  </style>\n'
        f'  <rect class="tile" width="512" height="512"{radius} />\n'
        f'  <image href="data:image/png;base64,{mark_png}" x="{x}" y="{y}" width="{width}" height="{height}" />\n'
        '</svg>\n',
        encoding='utf-8',
    )


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else 'public/logo.png'
    out_dir = Path('public/icons')
    out_dir.mkdir(parents=True, exist_ok=True)

    meta, pixels = read_png(source)
    channels = 4 if meta['color'] == 6 else 3
    print(f'{source}: {meta["w"]}x{meta["h"]}, {channels} channels')

    # The wordmark starts below this cut in the current Forge artwork.
    mark_limit_y = round(meta['h'] * 0.565)
    bbox = alpha_bbox(pixels, meta['w'], meta['h'], channels, max_y=mark_limit_y)
    mark, mark_w, mark_h = crop(pixels, meta['w'], channels, bbox)
    print(f'  mark crop: {bbox} -> {mark_w}x{mark_h}')

    write_adaptive_svg(out_dir / 'app-icon.svg', mark, mark_w, mark_h, APP_SCALE)
    write_adaptive_svg(out_dir / 'maskable-icon.svg', mark, mark_w, mark_h, MASKABLE_SCALE, rounded=True)
    print('  wrote adaptive SVG icons')

    for name, background in (('dark', DARK), ('light', LIGHT)):
        for size in (192, 512):
            icon = compose_tile(mark, mark_w, mark_h, size, background, APP_SCALE)
            write_png(out_dir / f'app-icon-{name}-{size}.png', size, size, icon)
            write_png(out_dir / f'icon-{size}-{name}.png', size, size, icon)
        apple = compose_tile(mark, mark_w, mark_h, 180, background, APP_SCALE)
        write_png(out_dir / f'apple-touch-icon-{name}.png', 180, 180, apple)
        print(f'  wrote {name} PNG variants')

    fallback = compose_tile(mark, mark_w, mark_h, 180, DARK, APP_SCALE)
    write_png(out_dir / 'apple-touch-icon.png', 180, 180, fallback)
    for size in (192, 512):
        fallback = compose_tile(mark, mark_w, mark_h, size, DARK, APP_SCALE)
        write_png(out_dir / f'icon-{size}.png', size, size, fallback)

        maskable = compose_tile(mark, mark_w, mark_h, size, DARK, MASKABLE_SCALE)
        write_png(out_dir / f'icon-{size}-maskable.png', size, size, maskable)
        if size == 512:
            write_png(out_dir / 'maskable-512.png', size, size, maskable)

    print('  wrote fallback and maskable PNG variants')


if __name__ == '__main__':
    main()
