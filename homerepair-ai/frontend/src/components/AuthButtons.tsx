// homerepair-ai/frontend/src/components/AuthButtons.tsx
'use client';
import { useAccessToken } from '../hooks/useAccessToken';

export default function AuthButtons() {
  const { isSignedIn, logout, getToken } = useAccessToken();

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {!isSignedIn() ? (
        <button onClick={() => getToken()}>Sign in</button>
      ) : (
        <button onClick={logout}>Sign out</button>
      )}
    </div>
  );
}
