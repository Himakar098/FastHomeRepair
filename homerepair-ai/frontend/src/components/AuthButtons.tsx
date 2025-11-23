// homerepair-ai/frontend/src/components/AuthButtons.tsx
//
// Simple sign in / sign out toggle.  When the user is not signed in,
// pressing the button triggers the MSAL login popup.  When signed
// in, pressing the button triggers the logout popup.

'use client';

import Link from 'next/link';
import { useAccessToken } from '../hooks/useAccessToken';

type AuthButtonsProps = {
  className?: string;
  variant?: 'sidebar' | 'default';
};

const STYLE_MAP = {
  sidebar: {
    primary:
      'inline-flex items-center justify-center rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
    secondary:
      'inline-flex items-center justify-center rounded-full border border-white bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
  },
  default: {
    primary:
      'inline-flex items-center justify-center rounded-full border border-[#0D47A1] px-4 py-2 text-sm font-semibold text-[#0D47A1] transition hover:bg-[#0D47A1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D47A1]/60',
    secondary:
      'inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-[#0D47A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D47A1]/20'
  }
} as const;

export default function AuthButtons(props?: AuthButtonsProps) {
  const { signedIn, logout, login } = useAccessToken();
  const { className = '', variant = 'sidebar' } = props ?? {};
  const styles = STYLE_MAP[variant];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <Link href="/account" className={styles.secondary}>
        Register
      </Link>

      {!signedIn ? (
        <button
          type="button"
          className={styles.primary}
          onClick={async () => {
            try {
              await login();
            } catch (err) {
              console.error('Sign-in failed', err);
            }
          }}
        >
          Login
        </button>
      ) : (
        <button type="button" className={styles.primary} onClick={logout}>
          Sign out
        </button>
      )}
    </div>
  );
}
