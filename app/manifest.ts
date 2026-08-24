import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const forgeManifest = {
    name: 'FORGE — by SHMT',
    short_name: 'FORGE',
    description: 'Dein persönliches Fortschrittssystem für Körper, Training und Ernährung.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'de',
    dir: 'ltr',
    background_color: '#08070c',
    theme_color: '#08070c',
    color_scheme_dark: {
      background_color: '#08070c',
      theme_color: '#08070c',
    },
    icons: [
      { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/app-icon-dark-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon-dark-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return forgeManifest as MetadataRoute.Manifest;
}
