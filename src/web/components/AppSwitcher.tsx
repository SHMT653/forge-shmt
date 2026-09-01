'use client';

import { ArrowUpRight } from 'lucide-react';
import { OTHER_APPS } from '@/lib/navigation/apps';

/**
 * Umschalter zu den beiden Schwester-Apps. Steht in allen drei SHMT-Apps
 * an derselben Stelle (Sidebar-Fuß, ueber der Profilkarte) und benutzt
 * ueberall dieselben Klassen aus globals.css.
 *
 * Die Schwester-Apps sind eigene Deployments — ein Wechsel dorthin kostet
 * sonst erst DNS, dann TLS, dann die Seite. Der Browser baut die Verbindung
 * deshalb schon auf, waehrend der Umschalter nur dasteht, und beim Hover
 * kommt das HTML gleich mit.
 */
export function AppSwitcher({ showLabel = true }: { showLabel?: boolean }) {
  return (
    <div className="app-switch">
      {OTHER_APPS.map((app) => (
        <link key={`preconnect-${app.id}`} rel="preconnect" href={app.url} crossOrigin="" />
      ))}
      {showLabel && <p className="app-switch-label">Wechseln zu</p>}
      <div className="app-switch-row">
        {OTHER_APPS.map((app) => (
          <a
            key={app.id}
            href={app.url}
            className="app-switch-chip"
            title={`${app.name} — ${app.tagline}`}
            style={{ ['--app-hue' as string]: app.hue }}
            onMouseEnter={() => prefetchApp(app.url)}
            onTouchStart={() => prefetchApp(app.url)}
          >
            <span aria-hidden className="app-switch-dot" />
            <span className="app-switch-name">{app.name}</span>
            <ArrowUpRight size={13} className="app-switch-arrow" />
          </a>
        ))}
      </div>
    </div>
  );
}

const prefetched = new Set<string>();

/** Holt das HTML der Schwester-App in den Cache, bevor der Klick kommt. */
function prefetchApp(url: string) {
  if (typeof document === 'undefined' || prefetched.has(url)) return;
  prefetched.add(url);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'document';
  link.href = url;
  document.head.appendChild(link);
}
