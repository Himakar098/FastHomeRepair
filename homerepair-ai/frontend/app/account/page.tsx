// homerepair-ai/frontend/app/account/page.tsx
//
// Allows a signed-in user to view and update their account/profile
// details persisted in the backend.  Falls back to prompting the
// user to sign in if no account is detected.  This page wires up
// authentication via the useAccessToken hook and posts updates
// through the useHttp wrapper so that JWTs are sent automatically.

'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMsal } from '@azure/msal-react';
import { useHttp } from '../../src/api/http';
import { useAccessToken } from '../../src/hooks/useAccessToken';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

type UserProfile = {
  id?: string;
  preferredUsername?: string | null;
  contactEmail?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  defaultUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function AccountPage() {
  const { post } = useHttp();
  const { getToken, signedIn } = useAccessToken();
  const { accounts } = useMsal();
  const account = accounts[0];
  const accountEmail = useMemo(() => {
    if (!account) return '';
    const claims: any = account.idTokenClaims || {};
    if (Array.isArray(claims.emails) && claims.emails.length) return claims.emails[0];
    return claims.email || account.username || '';
  }, [account, accounts]);
  const defaultUserId = useMemo(() => {
    if (!account) return '';
    const claims: any = account.idTokenClaims || {};
    return claims.oid || account.localAccountId || account.homeAccountId || '';
  }, [account, accounts]);
  const [profile, setProfile] = useState<UserProfile>({
    preferredUsername: '',
    contactEmail: accountEmail,
    mobileNumber: '',
    address: '',
    defaultUserId
  });
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
      if (data?.user) {
        setProfile({
          id: data.user.id,
          preferredUsername: data.user.preferredUsername || data.user.displayName || '',
          contactEmail: data.user.contactEmail || accountEmail || '',
          mobileNumber: data.user.mobileNumber || '',
          address: data.user.address || '',
          defaultUserId: data.user.defaultUserId || data.user.id || defaultUserId,
          createdAt: data.user.createdAt,
          updatedAt: data.user.updatedAt
        });
      } else {
        setProfile(prev => ({
          ...prev,
          contactEmail: accountEmail || prev.contactEmail,
          defaultUserId: defaultUserId || prev.defaultUserId
        }));
      }
    } catch (e: any) {
      setMsg('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [accountEmail, defaultUserId, getToken]);

  useEffect(() => {
    if (signedIn) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, loadProfile]);

  useEffect(() => {
    setProfile(prev => ({
      ...prev,
      contactEmail: prev.contactEmail || accountEmail || prev.contactEmail,
      defaultUserId: prev.defaultUserId || defaultUserId || prev.defaultUserId
    }));
  }, [accountEmail, defaultUserId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await post('/api/register-user', {
        preferredUsername: profile.preferredUsername,
        contactEmail: profile.contactEmail,
        mobileNumber: profile.mobileNumber,
        address: profile.address
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
          <label htmlFor="preferredUsername">Preferred username</label><br />
          <input
            id="preferredUsername"
            name="preferredUsername"
            type="text"
            value={profile.preferredUsername || ''}
            onChange={(e) => setProfile(p => ({ ...p, preferredUsername: e.target.value }))}
            required
            maxLength={100}
            placeholder="Choose how we'd address you"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="defaultUserId">Account ID</label><br />
          <input
            id="defaultUserId"
            name="defaultUserId"
            type="text"
            value={profile.defaultUserId || defaultUserId || ''}
            readOnly
          />
          <small style={{ color: '#666' }}>This identifier ties your conversations and preferences together. Keep it private.</small>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="contactEmail">Email</label><br />
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={profile.contactEmail || accountEmail || ''}
            onChange={(e) => setProfile(p => ({ ...p, contactEmail: e.target.value }))}
            placeholder="you@example.com"
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="mobileNumber">Mobile number (optional)</label><br />
          <input
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            value={profile.mobileNumber || ''}
            onChange={(e) => setProfile(p => ({ ...p, mobileNumber: e.target.value }))}
            placeholder="+61 4XX XXX XXX"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="address">Address (optional)</label><br />
          <textarea
            id="address"
            name="address"
            value={profile.address || ''}
            onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))}
            placeholder="Apartment 3B, 120 Collins St, Melbourne VIC 3000"
            rows={3}
            maxLength={280}
          />
          <small style={{ color: '#666' }}>Stored securely and only used for personalised service recommendations.</small>
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      <section
        style={{
          marginTop: 32,
          padding: '16px',
          border: '1px solid #d0dcff',
          borderRadius: 8,
          background: '#f5f8ff'
        }}
      >
        <h3>Premium Features & Professional Network</h3>
        <p>
          As a signed-in member you unlock live web search, real-time product pricing and vision
          analysis. To list your business on HomeRepairAI you must hold an Australian ABN, provide
          trade qualifications, licences and proof of insurance. We review every submission before
          it appears in customer results.
        </p>
        <p>
          Ready to offer services?&nbsp;
          <Link href="/professional" style={{ textDecoration: 'underline' }}>
            Complete your professional profile
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
