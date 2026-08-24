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
    // The manifest has no media queries, so it carries the dark tile: the app
    // itself is dark, and an installed icon that matches it beats one that does
    // not. Light-mode phones get the light tile through the apple-touch-icon
    // and favicon links in the layout instead.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
