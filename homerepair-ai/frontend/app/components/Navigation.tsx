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
    <nav
      style={{
        padding: '1rem',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          Chat
        </Link>
        <Link href="/account" style={{ textDecoration: 'none' }}>
          Account
        </Link>
        <Link href="/professional" style={{ textDecoration: 'none' }}>
          Pro Signup
        </Link>
        <Link href="/history" style={{ textDecoration: 'none' }}>
          History
        </Link>
      </div>
      <AuthButtons />
    </nav>
  );
}