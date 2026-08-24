import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/web/hooks/useAuth';
import { ServiceWorkerRegistrar } from '@/web/components/ServiceWorkerRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORGE — by SHMT',
  description: 'Dein persönliches Fortschrittssystem für Körper, Gewohnheiten und Disziplin.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FORGE',
  },
  /**
   * One tile for the home screen, and it is the dark one.
   *
   * iOS does not evaluate `media` on an apple-touch-icon link — it takes the
   * first one it finds. Offering a light variant therefore adapted to nothing;
   * it handed a dark-mode phone a white tile, which is worse than not adapting
   * at all. The home screen gets exactly one icon and it matches the app.
   *
   * A web clip's icon is also captured when the shortcut is added and never
   * re-rendered, so following the system theme afterwards is not something any
   * arrangement of these links can deliver.
   *
   * The favicon links keep both variants: browsers do honour `media` there,
   * and a tab icon is re-read on every load rather than frozen once.
   */
  icons: {
    icon: [
      { url: '/icons/icon-192-light.png', sizes: '192x192', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/icon-192-dark.png', sizes: '192x192', type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/icons/icon-512-light.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/icon-512-dark.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  // The status bar follows the phone too, so the tile and the chrome agree.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0d' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
