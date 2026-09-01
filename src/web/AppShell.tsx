'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { flushSync } from 'react-dom';
import {
  Flame, Dumbbell, TrendingUp, LogOut, Menu, X, Utensils, Activity, CalendarDays, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { signOut } from '@/services/supabase/auth';
import { QuickActionBar } from '@/web/components/QuickActionBar';
import { TodayDataProvider } from '@/web/hooks/TodayDataProvider';
import { OfflineBanner } from '@/web/components/OfflineBanner';
import { AppSwitcher } from '@/web/components/AppSwitcher';
import { useTheme } from '@/web/hooks/useTheme';
import { DashboardView } from '@/web/views/DashboardView';
import { CalendarView } from '@/web/views/CalendarView';
import { NutritionView } from '@/web/views/NutritionView';
import { PlansView } from '@/web/views/PlansView';
import { ProgressView } from '@/web/views/ProgressView';
import { CardioView } from '@/web/views/CardioView';
import { SettingsView } from '@/web/views/SettingsView';
import { PlanDetailView } from '@/web/views/PlanDetailView';
import { WorkoutView } from '@/web/views/WorkoutView';
import { RoutePane } from '@/web/components/RoutePanes';
import { WARM_ROUTE_EVENT, warmRoute as warmRoutePane } from '@/web/components/routeWarmup';

/**
 * One primary navigation, four destinations (§49).
 *
 * The app previously offered a hamburger drawer AND a long-press-customisable
 * bottom bar covering the same seven routes, which meant two ways to reach
 * everything and no clear hierarchy. Now the bottom bar is the four screens
 * you use daily and the drawer holds everything else.
 */
const PRIMARY_NAV = [
  { href: '/',          label: 'Heute',     icon: Flame },
  { href: '/kalender',  label: 'Kalender',  icon: CalendarDays },
  { href: '/nutrition', label: 'Ernährung', icon: Utensils },
  { href: '/plans',     label: 'Training',  icon: Dumbbell },
] as const;

const SECONDARY_NAV = [
  { href: '/progress', label: 'Fortschritt', icon: TrendingUp },
  { href: '/cardio',   label: 'Cardio',      icon: Activity },
] as const;

function greetingForHour(hour: number): string {
  if (hour < 5)  return 'Guten Abend';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function displayNameFor(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return '';
  const meta = user.user_metadata?.display_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  return user.email?.split('@')[0] ?? '';
}

function initialsFor(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '·';
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function isPlainClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

/**
 * Die festen Screens der App. Sie bleiben nach dem ersten Oeffnen montiert,
 * ein Klick tauscht nur die sichtbare Flaeche — niemand wartet auf den Server.
 */
const ROUTE_PANES: Record<string, () => ReactNode> = {
  '/':          () => <DashboardView />,
  '/kalender':  () => <CalendarView />,
  '/nutrition': () => <NutritionView />,
  '/plans':     () => <PlansView />,
  '/progress':  () => <ProgressView />,
  '/cardio':    () => <CardioView />,
  '/settings':  () => <SettingsView />,
};

/** Diese Screens werden nach dem Start still im Hintergrund aufgebaut. */
const PRELOAD_PATHS = ['/', '/kalender', '/nutrition', '/plans'];

/**
 * Detailseiten haengen an einer ID und werden beim Verlassen wieder
 * abgeraeumt — sie sofort zu zeigen reicht, am Leben halten will man sie
 * nicht (ein laufendes Workout gehoert nicht in den Hintergrund).
 */
/** Kennt die App diesen Pfad als eigenen Screen? */
function isKnownPath(pathname: string): boolean {
  return Boolean(ROUTE_PANES[pathname])
    || /^\/plans\/[^/]+$/.test(pathname)
    || /^\/workout\/[^/]+$/.test(pathname);
}

function transientViewFor(pathname: string) {
  const planId = /^\/plans\/([^/]+)$/.exec(pathname)?.[1];
  if (planId) return <PlanDetailView planId={decodeURIComponent(planId)} />;

  const sessionId = /^\/workout\/([^/]+)$/.exec(pathname)?.[1];
  if (sessionId) return <WorkoutView sessionId={decodeURIComponent(sessionId)} />;

  return null;
}

function Brand() {
  return (
    <div className="brand">
      <Image src="/icons/mark.png" alt="FORGE" width={50} height={50} className="brand-logo" />
      <div className="brand-copy">
        <p className="brand-title">FORGE</p>
        <p className="brand-subtitle">by SHMT</p>
      </div>
    </div>
  );
}

function ProfileCard({ user, pathname, onNavigate }: {
  user: { email?: string | null; user_metadata?: Record<string, unknown> };
  pathname: string;
  onNavigate?: ((href: string) => void) | undefined;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const name = displayNameFor(user);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); router.replace('/auth'); } finally { setSigningOut(false); }
  }

  return (
    <div className={`profile-card${pathname.startsWith('/settings') ? ' active' : ''}`}>
      <AppNavLink href="/settings" className="profile-link" onNavigate={onNavigate} title="Einstellungen">
        <span className="avatar">{initialsFor(name)}</span>
        <div className="profile-body">
          <p className="profile-name">{name || 'Konto'}</p>
          <p className="profile-email">{user.email}</p>
        </div>
      </AppNavLink>
      <button type="button" className="profile-logout" onClick={handleSignOut} disabled={signingOut} aria-label="Abmelden">
        <LogOut size={16} />
      </button>
    </div>
  );
}

function ThemeToggle({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Hell-Modus' : 'Dunkel-Modus';

  return (
    <button
      type="button"
      className={size === 'lg' ? 'icon-button framed lg' : 'icon-button md'}
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function AppHeader({ user }: { user: { email?: string | null; user_metadata?: Record<string, unknown> } }) {
  const name = displayNameFor(user);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  return (
    <div className="app-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="greeting-title">{greeting}{name ? `, ${name}` : ''}</h1>
      </div>
      <ThemeToggle size="lg" />
    </div>
  );
}

/* ── Drawer (mobile full-nav) ────────────────────────────── */
function Drawer({ open, onClose, pathname, user }: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  user: { email?: string | null; user_metadata?: Record<string, unknown> };
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const name = displayNameFor(user);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); router.replace('/auth'); } finally { setSigningOut(false); }
  }

  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={onClose} aria-hidden />
      <div className={`drawer${open ? ' open' : ''}`} aria-label="Navigation">
        <div className="drawer-header">
          <Brand />
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Menü schließen">
            <X size={18} />
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
            <AppNavLink
              key={href}
              href={href}
              className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}
              onNavigate={() => onClose()}
            >
              <Icon size={18} />
              <span>{label}</span>
            </AppNavLink>
          ))}
          <p className="section-label" style={{ margin: '12px 0 4px 13px' }}>Mehr</p>
          {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
            <AppNavLink
              key={href}
              href={href}
              className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}
              onNavigate={() => onClose()}
            >
              <Icon size={18} />
              <span>{label}</span>
            </AppNavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <AppSwitcher />
          <ProfileCard user={user} pathname={pathname} onNavigate={onClose} />
        </div>
      </div>
    </>
  );
}

/* ── Fixed 4-item bottom nav ─────────────────────────────── */
function BottomNav({ pathname, onNavigate }: { pathname: string; onNavigate: (href: string) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Hauptnavigation">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
        <AppNavLink key={href} href={href} className={`nav-button${isActive(pathname, href) ? ' active' : ''}`} onNavigate={onNavigate}>
          <Icon size={20} />
          <span>{label}</span>
        </AppNavLink>
      ))}
    </nav>
  );
}

function AppNavLink({
  href,
  className,
  children,
  onNavigate,
  title,
  style,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: ((href: string) => void) | undefined;
  title?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const router = useRouter();

  /** Schon beim Hover/Antippen aufbauen — vor dem eigentlichen Klick. */
  function warm() {
    router.prefetch(href);
    warmRoutePane(href);
  }

  /**
   * Der sichtbare Wechsel wird sofort gezeichnet, nicht erst mit dem naechsten
   * Rendern: React fasst Zustandsaenderungen sonst zusammen und der Tab bleibt
   * bis nach der Router-Arbeit stehen — auf dem Handy sind das die paar
   * hundert Millisekunden, die sich wie Warten anfuehlen.
   */
  function switchNow() {
    flushSync(() => onNavigate?.(href));
  }

  return (
    <Link
      href={href}
      prefetch
      className={className}
      title={title}
      aria-label={ariaLabel}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...style }}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      onPointerDown={(event) => {
        // Am Finger haengt der Wechsel schon am Beruehren; die Maus wartet auf
        // ihren Klick, sonst zieht ein Rechtsklick die Ansicht mit.
        if (
          event.defaultPrevented ||
          event.pointerType === 'mouse' ||
          (typeof window !== 'undefined' && href === window.location.pathname)
        ) return;
        warm();
        switchNow();
      }}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        switchNow();
        router.push(href);
      }}
    >
      {children}
    </Link>
  );
}

/* ── App Shell ───────────────────────────────────────────── */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [instantPath, setInstantPath] = useState(pathname);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const displayedPath = instantPath || pathname;
  const hasPane = Boolean(ROUTE_PANES[displayedPath]);
  const transientView = hasPane ? null : transientViewFor(displayedPath);
  const [mountedPanes, setMountedPanes] = useState<string[]>(
    () => (ROUTE_PANES[pathname] ? [pathname] : []),
  );
  const scrollPositions = useRef(new Map<string, number>());
  const shownPath = useRef(displayedPath);

  const mountPane = useCallback((path: string) => {
    if (!ROUTE_PANES[path]) return;
    setMountedPanes((previous) => (previous.includes(path) ? previous : [...previous, path]));
  }, []);

  const navigateInstantly = useCallback((href: string) => {
    setInstantPath(href);
  }, []);

  // Der sichtbare Screen muss montiert sein, sobald er gebraucht wird.
  useEffect(() => {
    mountPane(displayedPath);
  }, [displayedPath, mountPane]);

  // Hover/Antippen eines Navigationslinks baut den Screen schon vorher auf.
  useEffect(() => {
    function handleWarm(event: Event) {
      const path = (event as CustomEvent<string>).detail;
      if (typeof path === 'string') mountPane(path);
    }
    window.addEventListener(WARM_ROUTE_EVENT, handleWarm);
    return () => window.removeEventListener(WARM_ROUTE_EVENT, handleWarm);
  }, [mountPane]);

  // Sobald der Browser Luft hat, die haeufigsten Ziele still vorladen.
  useEffect(() => {
    if (loading || !user) return;
    const idle = window.requestIdleCallback?.bind(window);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const handles: number[] = [];

    PRELOAD_PATHS.forEach((path, index) => {
      const start = () => mountPane(path);
      if (idle) handles.push(idle(start, { timeout: 4000 + index * 600 }));
      else timers.push(setTimeout(start, 1200 + index * 400));
    });

    return () => {
      timers.forEach(clearTimeout);
      handles.forEach((handle) => window.cancelIdleCallback?.(handle));
    };
  }, [loading, user, mountPane]);

  // Jeder Screen behaelt seine Scrollposition — wie die Tabs einer echten App.
  useLayoutEffect(() => {
    if (shownPath.current === displayedPath) return;
    scrollPositions.current.set(shownPath.current, window.scrollY);
    window.scrollTo(0, scrollPositions.current.get(displayedPath) ?? 0);
    shownPath.current = displayedPath;
  }, [displayedPath]);

  // Auch Links mitten im Inhalt — "Plan oeffnen", "Ernaehrung", "Fortschritt"
  // — sollen sofort umschalten. Der Klick wird in der Capture-Phase gelesen,
  // also bevor Next ihn abfaengt; die Route kommt dahinter nach.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const link = element?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

      const destination = new URL(link.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;
      if (!isKnownPath(destination.pathname)) return;

      flushSync(() => setInstantPath(destination.pathname));
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setInstantPath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="auth-shell">
        <p className="copy">Lädt …</p>
      </div>
    );
  }

  return (
    <TodayDataProvider>
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <AppNavLink href="/" ariaLabel="Startseite" style={{ textDecoration: 'none' }} onNavigate={navigateInstantly}>
          <Brand />
        </AppNavLink>
        <nav className="nav-list">
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
            <AppNavLink key={href} href={href} className={`nav-button${isActive(displayedPath, href) ? ' active' : ''}`} onNavigate={navigateInstantly}>
              <Icon size={18} />
              <span>{label}</span>
            </AppNavLink>
          ))}
          <p className="section-label" style={{ margin: '14px 0 2px 13px' }}>Mehr</p>
          {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
            <AppNavLink key={href} href={href} className={`nav-button${isActive(displayedPath, href) ? ' active' : ''}`} onNavigate={navigateInstantly}>
              <Icon size={18} />
              <span>{label}</span>
            </AppNavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <AppSwitcher />
          <ProfileCard user={user} pathname={displayedPath} onNavigate={navigateInstantly} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} pathname={displayedPath} user={user} />

      <div className="main">
        {/* Mobile topbar */}
        <header className="topbar">
          <AppNavLink href="/" ariaLabel="Startseite" style={{ textDecoration: 'none' }} onNavigate={navigateInstantly}>
            <Brand />
          </AppNavLink>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ThemeToggle />
            <button type="button" className="hamburger" onClick={openDrawer} aria-label="Menü öffnen">
              <Menu size={20} />
            </button>
          </div>
        </header>

        <OfflineBanner />

        <div className="page">
          <AppHeader user={user} />
          {mountedPanes.map((path) => (
            <RoutePane key={path} active={path === displayedPath}>
              {ROUTE_PANES[path]!()}
            </RoutePane>
          ))}
          {!hasPane && (transientView ?? children)}
        </div>
      </div>

      {/* Reachable from every screen */}
      <QuickActionBar />

      {/* Mobile 4-item bottom nav */}
      <BottomNav pathname={displayedPath} onNavigate={navigateInstantly} />
    </div>
    </TodayDataProvider>
  );
}
