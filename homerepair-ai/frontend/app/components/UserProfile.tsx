'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useAccessToken } from '../../src/hooks/useAccessToken';
import { useHttp } from '../../src/api/http';

type ProfileState = {
  preferredUsername: string;
  contactEmail: string;
  mobileNumber: string;
  defaultUserId: string;
  address: string;
  createdAt?: string;
  updatedAt?: string;
};

const INITIAL_STATE: ProfileState = {
  preferredUsername: '',
  contactEmail: '',
  mobileNumber: '',
  defaultUserId: '',
  address: ''
};

export default function UserProfile() {
  const { signedIn, getToken } = useAccessToken();
  const { post } = useHttp();
  const { accounts } = useMsal();
  const account = accounts[0];

  const accountEmail = useMemo(() => {
    if (!account) return '';
    const claims: any = account.idTokenClaims || {};
    if (Array.isArray(claims.emails) && claims.emails.length) return claims.emails[0];
    return claims.email || account.username || '';
  }, [account, accounts]);

  const userIdFromAuth = useMemo(() => {
    if (!account) return '';
    const claims: any = account.idTokenClaims || {};
    return claims.oid || account.localAccountId || account.homeAccountId || '';
  }, [account, accounts]);

  const [profile, setProfile] = useState<ProfileState>({
    ...INITIAL_STATE,
    contactEmail: accountEmail,
    defaultUserId: userIdFromAuth
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setMessage(null);
    try {
      const token = await getToken({ forceLogin: true });
      if (!token) throw new Error('No auth token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071'}/api/get-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      const user = data?.user ?? {};
      setProfile({
        preferredUsername: user.preferredUsername || user.displayName || '',
        contactEmail: user.contactEmail || accountEmail || '',
        mobileNumber: user.mobileNumber || '',
        defaultUserId: user.defaultUserId || user.id || userIdFromAuth,
        address: user.address || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (err) {
      console.error(err);
      setMessage('Unable to load your profile right now.');
    } finally {
      setLoading(false);
    }
  }, [signedIn, getToken, accountEmail, userIdFromAuth]);

  useEffect(() => {
    if (signedIn) {
      loadProfile();
    }
  }, [signedIn, loadProfile]);

  useEffect(() => {
    setProfile(prev => ({
      ...prev,
      contactEmail: prev.contactEmail || accountEmail,
      defaultUserId: prev.defaultUserId || userIdFromAuth
    }));
  }, [accountEmail, userIdFromAuth]);

  const handleChange = (field: keyof ProfileState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await post('/api/register-user', {
        preferredUsername: profile.preferredUsername,
        contactEmail: profile.contactEmail,
        mobileNumber: profile.mobileNumber,
        address: profile.address
      });
      setMessage('Profile saved!');
      await loadProfile();
    } catch (err: any) {
      console.error(err);
      setMessage(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!signedIn) {
    return <div style={{ padding: 24 }}>Please sign in to view your profile.</div>;
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Account Profile</h2>
        <p style={{ color: '#555', marginTop: 8 }}>Manage the information we use to personalise your experience.</p>
      </header>

      <section
        style={{
          border: '1px solid #e0e6ff',
          borderRadius: 12,
          padding: 20,
          background: '#f8f9ff',
          marginBottom: 24
        }}
      >
        <h3 style={{ marginTop: 0 }}>Identity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Preferred username</span>
            <input
              type="text"
              value={profile.preferredUsername}
              onChange={handleChange('preferredUsername')}
              maxLength={100}
              placeholder="Choose how we'd address you"
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Email</span>
            <input
              type="email"
              value={profile.contactEmail}
              onChange={handleChange('contactEmail')}
              required
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Mobile number (optional)</span>
            <input
              type="tel"
              value={profile.mobileNumber}
              onChange={handleChange('mobileNumber')}
              placeholder="+61 4XX XXX XXX"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Address (optional)</span>
            <textarea
              value={profile.address}
              onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Apartment 3B, 120 Collins St, Melbourne VIC 3000"
              rows={3}
              maxLength={280}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Default user ID</span>
            <input type="text" value={profile.defaultUserId} readOnly />
            <small style={{ color: '#666' }}>
              This identifier is generated automatically and links your conversations, purchases and preferences.
              Keep it private.
            </small>
          </label>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          style={{
            padding: '10px 18px',
            background: '#4c6ef5',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {message && <span style={{ color: message.includes('failed') ? '#c92a2a' : '#2f9e44' }}>{message}</span>}
      </div>

      {profile.updatedAt && (
        <p style={{ marginTop: 16, color: '#666' }}>
          Last updated: {new Date(profile.updatedAt).toLocaleString('en-AU')}
        </p>
      )}
    </div>
  );
}
