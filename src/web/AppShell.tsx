'use client';

import { useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Flame, Dumbbell, TrendingUp, CheckCircle2, Settings } from 'lucide-react';
import { useAuth } from '@/web/hooks/useAuth';

const NAV_ITEMS = [
  { href: '/', label: 'Heute', icon: Flame },
  { href: '/plans', label: 'Pläne', icon: Dumbbell },
  { href: '/progress', label: 'Fortschritt', icon: TrendingUp },
  { href: '/habits', label: 'Gewohnheiten', icon: CheckCircle2 },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function Brand() {
  return (
    <div className="brand">
      <Image src="/forge-logo.svg" alt="FORGE" width={50} height={50} className="brand-logo" />
      <div className="brand-copy">
        <p className="brand-title">FORGE</p>
        <p className="brand-subtitle">by SHMT</p>
      </div>
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
          <div className="sync-row">
            <span className="sync-dot online" />
            <span>Cloud Sync aktiv</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
        </header>
        <div className="page">{children}</div>
      </div>

      <nav className="bottom-nav">
        <NavButtons pathname={pathname} />
      </nav>
    </div>
  );
}
