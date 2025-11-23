// homerepair-ai/frontend/app/components/Navigation.tsx
//
// Responsive sidebar navigation. Collapses to a toggleable drawer on
// mobile and stays pinned on desktop. Includes primary app routes and
// sign-in/out controls.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, Fragment } from 'react';
import {
  Menu,
  X,
  MessageSquare,
  BriefcaseBusiness,
  UserRound,
  History,
  Shield,
  ClipboardList
} from 'lucide-react';
import AuthButtons from '../../src/components/AuthButtons';

const NAV_LINKS = [
  { href: '/', label: 'Copilot', description: 'Ask about any repair', icon: MessageSquare },
  { href: '/jobs', label: 'Jobs', description: 'Quotes & dispatch', icon: BriefcaseBusiness },
  { href: '/account', label: 'Account', description: 'Billing & settings', icon: UserRound },
  { href: '/history', label: 'History', description: 'Conversations & files', icon: History },
  { href: '/professional', label: 'Pro Signup', description: 'Join the network', icon: ClipboardList }
] as const;

type NavigationContentProps = {
  pathname: string;
  onClose?: () => void;
  showClose?: boolean;
};

function NavigationContent({ pathname, onClose, showClose }: NavigationContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.5em] text-white/70">HomeService AI</p>
          <p className="text-xl font-semibold text-white">Operations Suite</p>
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-6 text-sm text-white/80">
        An inspired workspace for diagnosing issues, approving spend, and routing trusted pros.
      </p>
      <nav className="mt-8 space-y-1">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? 'border-white/70 bg-white/15 text-white shadow-lg shadow-slate-900/20'
                  : 'border-transparent text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <div className="flex-1 text-left">
                <p>{link.label}</p>
                <span className="text-xs font-normal text-white/60">{link.description}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 space-y-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-white/90" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Compliance</p>
            <p className="text-base font-semibold">Azure Protected</p>
          </div>
        </div>
        <p className="text-white/70">
          Data residency locked to AU East with 24/7 monitoring and audit logging retained for 365 days.
        </p>
      </div>
      <div className="mt-auto pt-8">
        <AuthButtons className="w-full justify-center" />
      </div>
    </div>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMode, setDesktopMode] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setDesktopMode(isDesktop);
      if (!isDesktop) {
        setDesktopCollapsed(false);
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (desktopMode) {
      body.classList.toggle('nav-collapsed', desktopCollapsed);
    } else {
      body.classList.remove('nav-collapsed');
    }
    return () => body.classList.remove('nav-collapsed');
  }, [desktopMode, desktopCollapsed]);

  return (
    <Fragment>
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-6 z-40 inline-flex items-center justify-center rounded-full bg-white p-3 text-[#0D47A1] shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 transition hover:-translate-y-0.5 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/60 bg-gradient-to-b from-[#0D47A1] to-[#052A6E] px-6 py-8 text-white shadow-2xl shadow-slate-900/40 transition-transform duration-300 lg:flex ${
          desktopCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <NavigationContent pathname={pathname} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 bg-gradient-to-b from-[#0D47A1] to-[#052A6E] px-6 py-8 text-white shadow-2xl shadow-slate-900/50">
            <NavigationContent pathname={pathname} onClose={() => setMobileOpen(false)} showClose />
          </div>
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="flex-1 bg-slate-900/60"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {desktopMode && (
        <button
          type="button"
          aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setDesktopCollapsed((prev) => !prev)}
          className={`fixed top-6 z-30 hidden rounded-full bg-white p-2 text-[#0D47A1] shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 transition hover:-translate-y-0.5 lg:flex ${
            desktopCollapsed ? 'left-4' : 'left-[17rem]'
          }`}
        >
          {desktopCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      )}
    </Fragment>
  );
}
