'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Flame, Dumbbell, TrendingUp, CheckCircle2, Settings, Search, LogOut } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';
import { signOut } from '@/services/supabase/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Heute', icon: Flame },
  { href: '/plans', label: 'Pläne', icon: Dumbbell },
  { href: '/progress', label: 'Fortschritt', icon: TrendingUp },
  { href: '/habits', label: 'Gewohnheiten', icon: CheckCircle2 },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Guten Abend';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function displayNameFor(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return '';
  const fromMetadata = user.user_metadata?.display_name;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) return fromMetadata.trim();
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
      <Image src="/brand-logo.png" alt="FORGE by SHMT" width={120} height={106} className="brand-logo" />
    </div>
  );
}

function NavButtons({ pathname }: { pathname: string }) {
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={`nav-button${isActive(pathname, href) ? ' active' : ''}`}>
          <Icon size={18} />
          <span>{label}</span>
        </Link>
      ))}
    </>
  );
}

function ProfileCard({ user }: { user: { email?: string | null; user_metadata?: Record<string, unknown> } }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const name = displayNameFor(user);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/auth');
    } finally {
      setSigningOut(false);
    }
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
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = NAV_ITEMS.find((item) => item.label.toLowerCase().includes(needle));
    if (match) {
      router.push(match.href);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  return (
    <div className="app-header">
      <div>
        <h1 className="greeting-title">
          {greeting}{name ? `, ${name}` : ''} 👋
        </h1>
        <p className="greeting-date">{dateLabel}</p>
      </div>
      <form className="search-field" onSubmit={handleSearchSubmit} role="search">
        <Search size={16} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Suchen … (z. B. Pläne)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="In FORGE suchen"
        />
        <span className="search-kbd">⌘K</span>
      </form>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
      <aside className="sidebar">
        <Brand />
        <nav className="nav-list">
          <NavButtons pathname={pathname} />
        </nav>
        <div className="sidebar-footer">
          <ProfileCard user={user} />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
        </header>
        <div className="page">
          <AppHeader user={user} />
          {children}
        </div>
      </div>

      <nav className="bottom-nav">
        <NavButtons pathname={pathname} />
      </nav>
    </div>
  );
}
