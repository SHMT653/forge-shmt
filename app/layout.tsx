import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/web/hooks/useAuth';
import { ThemeProvider } from '@/web/hooks/useTheme';
import { ServiceWorkerRegistrar } from '@/web/components/ServiceWorkerRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORGE — by SHMT',
  description: 'Dein persönliches Fortschrittssystem für Körper, Gewohnheiten und Disziplin.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FORGE',
  },
  // Same icon contract as NEO: transparent icons first, then explicit
  // light/dark app tiles for platforms that honour media queries.
  icons: {
    icon: [
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/app-icon-light-512.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/app-icon-dark-512.png', sizes: '512x512', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/icon-32.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon-light.png', sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/apple-touch-icon-dark.png', sizes: '180x180', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
  },
};

export const viewport: Viewport = {
  // The status bar follows the phone too, so the tile and the chrome agree.
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5fb' },
    { media: '(prefers-color-scheme: dark)', color: '#08070c' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        {/* Vor dem ersten Pixel Theme setzen — sonst blitzt Weiß auf. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var mode = localStorage.getItem('theme-mode');
                var src = localStorage.getItem('theme-source');
                var chosen = src === 'system' ? null : mode;
                var dark = chosen
                  ? chosen === 'dark'
                  : window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', dark);
                var accent = localStorage.getItem('theme-accent');
                if (accent) document.documentElement.setAttribute('data-accent', accent);
              } catch(e) {
                document.documentElement.classList.add('dark');
              }
            `,
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
