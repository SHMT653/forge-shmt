'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Flame, Dumbbell, TrendingUp, Settings, LogOut, Menu, X, Utensils, Activity, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { signOut } from '@/services/supabase/auth';
import { QuickActionBar } from '@/web/components/QuickActionBar';
import { TodayDataProvider } from '@/web/hooks/TodayDataProvider';
import { OfflineBanner } from '@/web/components/OfflineBanner';
import { DashboardView } from '@/web/views/DashboardView';
import { CalendarView } from '@/web/views/CalendarView';
import { NutritionView } from '@/web/views/NutritionView';
import { PlansView } from '@/web/views/PlansView';
import { ProgressView } from '@/web/views/ProgressView';
import { CardioView } from '@/web/views/CardioView';
import { SettingsView } from '@/web/views/SettingsView';

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
  { href: '/progress', label: 'Fortschritt',   icon: TrendingUp },
  { href: '/cardio',   label: 'Cardio',        icon: Activity },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
] as const;

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

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

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function instantViewFor(pathname: string) {
  if (pathname === '/') return <DashboardView />;
  if (pathname === '/kalender') return <CalendarView />;
  if (pathname === '/nutrition') return <NutritionView />;
  if (pathname === '/plans') return <PlansView />;
  if (pathname === '/progress') return <ProgressView />;
  if (pathname === '/cardio') return <CardioView />;
  if (pathname === '/settings') return <SettingsView />;
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

function ProfileCard({ user }: { user: { email?: string | null; user_metadata?: Record<string, unknown> } }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const name = displayNameFor(user);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); router.replace('/auth'); } finally { setSigningOut(false); }
  }

  return (
    <div className="profile-card">
      <span className="avatar">{initialsFor(name)}</span>
      <div className="profile-body">
        <p className="profile-name">{name || 'Konto'}</p>
        <p className="profile-email">{user.email}</p>
      </div>
      <button type="button" className="profile-logout" onClick={handleSignOut} disabled={signingOut} aria-label="Abmelden">
        <LogOut size={16} />
      </button>
    </div>
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
    </div>
  );
}

/* ── Drawer (mobile full-nav) ────────────────────────────── */
function Drawer({ open, onClose, pathname, user, onNavigate }: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  user: { email?: string | null; user_metadata?: Record<string, unknown> };
  onNavigate: (href: string) => void;
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
              onNavigate={(nextHref) => {
                onNavigate(nextHref);
                onClose();
              }}
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
              onNavigate={(nextHref) => {
                onNavigate(nextHref);
                onClose();
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </AppNavLink>
          ))}
        </nav>

        <div className="profile-card" style={{ marginTop: 'auto' }}>
          <span className="avatar">{initialsFor(name)}</span>
          <div className="profile-body">
            <p className="profile-name">{name || 'Konto'}</p>
            <p className="profile-email">{user.email}</p>
          </div>
          <button type="button" className="profile-logout" onClick={handleSignOut} disabled={signingOut} aria-label="Abmelden">
            <LogOut size={16} />
          </button>
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
  style,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate: (href: string) => void;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch
      className={className}
      aria-label={ariaLabel}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...style }}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onNavigate(href);
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
  const instantView = instantViewFor(displayedPath);

  const navigateInstantly = useCallback((href: string) => {
    setInstantPath(href);
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
          <ProfileCard user={user} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} pathname={displayedPath} user={user} onNavigate={navigateInstantly} />

      <div className="main">
        {/* Mobile topbar */}
        <header className="topbar">
          <AppNavLink href="/" ariaLabel="Startseite" style={{ textDecoration: 'none' }} onNavigate={navigateInstantly}>
            <Brand />
          </AppNavLink>
          <button type="button" className="hamburger" onClick={openDrawer} aria-label="Menü öffnen">
            <Menu size={20} />
          </button>
        </header>

        <OfflineBanner />

        <div className="page">
          <AppHeader user={user} />
          {instantView ?? children}
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
