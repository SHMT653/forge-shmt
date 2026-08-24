import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FORGE — by SHMT',
    short_name: 'FORGE',
    description: 'Dein persönliches Fortschrittssystem für Körper, Training und Ernährung.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0d',
    theme_color: '#0a0a0d',
    // Two different pictures, not one relabelled twice.
    //
    // `any` is the full tile. `maskable` is a separate file with the artwork
    // pulled well inside the safe zone, because a launcher may crop anything
    // outside the middle 80 %. Pointing `maskable` at an edge-to-edge design —
    // which is what this did — is what made the icon render as a small square
    // sitting on a plate.
    //
    // Both are the dark tile: the manifest has no media query, and the app
    // itself is dark. Light-mode phones get the light tile through the
    // apple-touch-icon and favicon links in the layout.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
