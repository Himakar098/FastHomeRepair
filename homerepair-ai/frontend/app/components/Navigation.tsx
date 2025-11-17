// homerepair-ai/frontend/app/components/Navigation.tsx
//
// Top-level navigation bar.  Includes links to the chat, account,
// professional signup and history pages, and surfaces sign-in/out
// controls via the AuthButtons component.

'use client';
import Link from 'next/link';
import AuthButtons from '../../src/components/AuthButtons';

export default function Navigation() {
  return (
    <nav className="main-nav">
      <div className="main-nav__links">
        <Link href="/" className="nav-link">
          Chat
        </Link>
        <Link href="/account" className="nav-link">
          Account
        </Link>
        <Link href="/professional" className="nav-link">
          Pro Signup
        </Link>
        <Link href="/history" className="nav-link">
          History
        </Link>
      </div>
      <AuthButtons />
    </nav>
  );
}
