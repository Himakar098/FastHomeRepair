// homerepair-ai/frontend/src/components/AuthButtons.tsx
//
// Simple sign in / sign out toggle.  When the user is not signed in,
// pressing the button triggers the MSAL login popup.  When signed
// in, pressing the button triggers the logout popup.

'use client';
import { useAccessToken } from '../hooks/useAccessToken';

export default function AuthButtons() {
  const { signedIn, logout, getToken } = useAccessToken();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {!signedIn ? (
        <button onClick={() => getToken()}>Sign in</button>
      ) : (
        <button onClick={logout}>Sign out</button>
      )}
    </div>
  );
}