import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/web/hooks/useAuth';
import './globals.css';

export const metadata: Metadata = {
  title: 'FORGE — by SHMT',
  description: 'Dein persönliches Fortschrittssystem für Körper, Gewohnheiten und Disziplin.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FORGE',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* iOS 18 adaptive icons — dark/light mode */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" media="(prefers-color-scheme: dark)" href="/icons/apple-touch-icon-dark.png" />
        <link rel="apple-touch-icon" media="(prefers-color-scheme: light)" href="/icons/apple-touch-icon-light.png" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
