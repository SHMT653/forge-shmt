'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Flame, Dumbbell, TrendingUp, CheckCircle2, Settings, Search, LogOut, Menu, X, Check, Utensils,
} from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { signOut } from '@/services/supabase/auth';

const ALL_NAV = [
  { href: '/',           label: 'Heute',          icon: Flame },
  { href: '/plans',      label: 'Pläne',          icon: Dumbbell },
  { href: '/nutrition',  label: 'Ernährung',      icon: Utensils },
  { href: '/progress',   label: 'Fortschritt',    icon: TrendingUp },
  { href: '/habits',     label: 'Gewohnheiten',   icon: CheckCircle2 },
  { href: '/settings',   label: 'Einstellungen',  icon: Settings },
] as const;

const DEFAULT_BOTTOM = ['/', '/plans', '/nutrition', '/progress'] as const;
const STORAGE_KEY = 'forge_bottom_nav';

function loadBottomKeys(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_BOTTOM];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length === 4) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_BOTTOM];
}

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

function Brand() {
  return (
    <div className="brand">
      <Image src="/brand-logo.png" alt="FORGE" width={50} height={50} className="brand-logo" />
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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const name = displayNameFor(user);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = ALL_NAV.find((n) => n.label.toLowerCase().includes(needle));
    if (match) { router.push(match.href); setQuery(''); inputRef.current?.blur(); }
  }

  return (
    <div className="app-header">
      <div>
        <h1 className="greeting-title">{greeting}{name ? `, ${name}` : ''} 👋</h1>
        <p className="greeting-date">{dateLabel}</p>
      </div>
      <form className="search-field" onSubmit={handleSearch} role="search">
        <Search size={16} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="In FORGE suchen"
        />
        <span className="search-kbd">⌘K</span>
      </form>
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
          {ALL_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
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

/* ── Customisable 4-item bottom nav ─────────────────────── */
function BottomNav({ pathname }: { pathname: string }) {
  const [bottomKeys, setBottomKeys] = useState<string[]>(() => loadBottomKeys());
  const [customising, setCustomising] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress() {
    longPressTimer.current = setTimeout(() => setCustomising(true), 600);
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function toggleItem(href: string) {
    setBottomKeys((prev) => {
      const next = prev.includes(href)
        ? prev.filter((k) => k !== href)
        : prev.length < 4 ? [...prev, href] : prev;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const bottomItems = ALL_NAV.filter((n) => bottomKeys.includes(n.href));

  return (
    <>
      {customising && (
        <>
          <div className="drawer-overlay open" onClick={() => setCustomising(false)} aria-hidden />
          <div className="nav-customize-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="h3" style={{ margin: 0, fontSize: 15 }}>Navigation anpassen</p>
              <button type="button" className="button ghost compact" onClick={() => setCustomising(false)}><X size={16} /></button>
            </div>
            <p className="copy" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>Wähle 4 Seiten für die Leiste unten.</p>
            <div className="nav-customize-grid">
              {ALL_NAV.map(({ href, label, icon: Icon }) => {
                const selected = bottomKeys.includes(href);
                return (
                  <button
                    key={href}
                    type="button"
                    className={`nav-button${selected ? ' active' : ''}`}
                    style={{ flexDirection: 'column', gap: 4, minHeight: 64, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => toggleItem(href)}
                    disabled={!selected && bottomKeys.length >= 4}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {selected && <Check size={12} style={{ position: 'absolute', top: 6, right: 6 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav
        className="bottom-nav"
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
      >
        {bottomItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

/* ── App Shell ───────────────────────────────────────────── */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

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
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <Link href="/" aria-label="Startseite" style={{ textDecoration: 'none' }}>
          <Brand />
        </Link>
        <nav className="nav-list">
          {ALL_NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ProfileCard user={user} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} pathname={pathname} user={user} />

      <div className="main">
        {/* Mobile topbar */}
        <header className="topbar">
          <Link href="/" aria-label="Startseite" style={{ textDecoration: 'none' }}>
            <Brand />
          </Link>
          <button type="button" className="hamburger" onClick={openDrawer} aria-label="Menü öffnen">
            <Menu size={20} />
          </button>
        </header>

        <div className="page">
          <AppHeader user={user} />
          {children}
        </div>
      </div>

      {/* Mobile 4-item bottom nav */}
      <BottomNav pathname={pathname} />
    </div>
  );
}
