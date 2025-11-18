// homerepair-ai/frontend/app/components/Navigation.tsx
//
// Responsive sidebar navigation. Collapses to a toggleable drawer on
// mobile and stays pinned on desktop. Includes primary app routes and
// sign-in/out controls.

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import AuthButtons from '../../src/components/AuthButtons';

const NAV_LINKS = [
  { href: '/', label: 'Chat' },
  { href: '/account', label: 'Account' },
  { href: '/history', label: 'History' },
  { href: '/professional', label: 'Pro Signup' }
];

export default function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setDesktop(isDesktop);
      setOpen(isDesktop);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggle = () => setOpen(prev => !prev);
  const close = () => setOpen(false);
  const sidebarOpen = desktop || open;

  return (
    <>
      {!sidebarOpen && (
        <>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggle}
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>
        </>
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <div>
            <p className="eyebrow">Home Service</p>
            <span className="brand-title">Assistant</span>
          </div>
          <button className="sidebar__close" type="button" onClick={close} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {NAV_LINKS.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar__link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="sidebar__auth">
            <AuthButtons />
          </div>
        </nav>
      </aside>
      {!desktop && sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={close} />
      )}
    </>
  );
}
