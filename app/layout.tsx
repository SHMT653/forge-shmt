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
   * Light and dark tiles, chosen by the phone's appearance setting.
   *
   * The three apple-touch-icons that used to ship were byte-identical copies of
   * one file, so there was never a light variant to pick. They also carried a
   * flat #1a191c background that matched neither the app nor anything else on
   * the home screen, which is what made the tile read as a grey patch.
   *
   * The unsuffixed files stay last as the fallback for anything that ignores
   * the media query.
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
    apple: [
      { url: '/icons/apple-touch-icon-light.png', sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/apple-touch-icon-dark.png', sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
