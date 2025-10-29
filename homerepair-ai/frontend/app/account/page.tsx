// homerepair-ai/frontend/app/account/page.tsx
//
// Allows a signed-in user to view and update their account/profile
// details persisted in the backend.  Falls back to prompting the
// user to sign in if no account is detected.  This page wires up
// authentication via the useAccessToken hook and posts updates
// through the useHttp wrapper so that JWTs are sent automatically.

'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useHttp } from '../../src/api/http';
import { useAccessToken } from '../../src/hooks/useAccessToken';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

type UserProfile = {
  id?: string;
  displayName?: string;
  contactEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function AccountPage() {
  const { post } = useHttp();
  const { getToken, signedIn } = useAccessToken();
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', contactEmail: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const token = await getToken({ forceLogin: true });
      if (!token) {
        throw new Error('No auth token');
      }
      const res = await fetch(`${API_BASE}/api/get-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.user) setProfile({ ...data.user });
    } catch (e: any) {
      setMsg('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (signedIn) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, loadProfile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await post('/api/register-user', {
        displayName: profile.displayName,
        contactEmail: profile.contactEmail
      });
      setMsg('Saved!');
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  if (!signedIn) {
    return <div style={{ padding: 16 }}><p>Please sign in to view your account.</p></div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <h2>My Account</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="displayName">Display name</label><br />
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={profile.displayName || ''}
            onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
            required
            maxLength={100}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="contactEmail">Contact email</label><br />
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={profile.contactEmail || ''}
            onChange={(e) => setProfile(p => ({ ...p, contactEmail: e.target.value }))}
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
