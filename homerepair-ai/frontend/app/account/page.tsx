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
    return (
      <div className="page-shell">
        <section className="page-card primary centered">
          <p className="eyebrow">Account</p>
          <h2>Sign in to manage your profile</h2>
          <p>Secure your repairs, track history and unlock realtime sourcing by signing in first.</p>
        </section>
      </div>
    );
  }

  const lastUpdated = profile.updatedAt
    ? new Date(profile.updatedAt).toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Not saved yet';

  return (
    <div className="page-shell">
      <header className="page-card primary">
        <p className="eyebrow">Account</p>
        <div className="page-header__row">
          <div>
            <h1>Profile & Preferences</h1>
            <p>Keep your contact details current so the assistant can tailor costs, pros and safety alerts.</p>
          </div>
          <div className="page-metrics">
            <div>
              <span className="metric-value">{profile.preferredUsername?.length ? 'Active' : 'Draft'}</span>
              <span className="metric-label">Profile status</span>
            </div>
            <div>
              <span className="metric-value">{profile.contactEmail ? 'Verified' : 'Pending'}</span>
              <span className="metric-label">Email</span>
            </div>
            <div>
              <span className="metric-value">{profile.updatedAt ? '✓' : '–'}</span>
              <span className="metric-label">Last save</span>
            </div>
          </div>
        </div>
      </header>

      <div className="page-grid two-columns">
        <section className="page-card primary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contact</p>
              <h3>Your details</h3>
            </div>
            <span className="page-chip subtle">Updated {lastUpdated}</span>
          </div>
          <form className="form-grid" onSubmit={onSubmit}>
            <div className="form-field">
              <label htmlFor="preferredUsername">Preferred username</label>
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
            <div className="form-field">
              <label htmlFor="defaultUserId">Account ID</label>
              <input
                id="defaultUserId"
                name="defaultUserId"
                type="text"
                value={profile.defaultUserId || defaultUserId || ''}
                readOnly
              />
              <small>This identifier ties your conversations and preferences together. Keep it private.</small>
            </div>
            <div className="form-field">
              <label htmlFor="contactEmail">Email</label>
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
            <div className="form-field">
              <label htmlFor="mobileNumber">Mobile number (optional)</label>
              <input
                id="mobileNumber"
                name="mobileNumber"
                type="tel"
                value={profile.mobileNumber || ''}
                onChange={(e) => setProfile(p => ({ ...p, mobileNumber: e.target.value }))}
                placeholder="+61 4XX XXX XXX"
              />
            </div>
            <div className="form-field">
              <label htmlFor="address">Address (optional)</label>
              <textarea
                id="address"
                name="address"
                value={profile.address || ''}
                onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))}
                placeholder="Apartment 3B, 120 Collins St, Melbourne VIC 3000"
                rows={3}
                maxLength={280}
              />
              <small>Stored securely and only used for personalised service recommendations.</small>
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </button>
              {msg && <span className="form-status">{msg}</span>}
            </div>
          </form>
        </section>

        <aside className="page-card secondary">
          <p className="eyebrow">Premium stack</p>
          <h3>What you control</h3>
          <ul className="status-list vertical">
            <li>
              <div className="status-info">
                <span className="status-icon">🌐</span>
                <div>
                  <strong>Live sourcing</strong>
                  <p>Signed-in members stream Bunnings pricing and DuckDuckGo professional leads.</p>
                </div>
              </div>
              <span className="status-chip good">{signedIn ? 'Active' : 'Locked'}</span>
            </li>
            <li>
              <div className="status-info">
                <span className="status-icon">📷</span>
                <div>
                  <strong>Vision uploads</strong>
                  <p>Photos route through Azure Computer Vision for contextual repairs.</p>
                </div>
              </div>
              <span className="status-chip good">Enabled</span>
            </li>
            <li>
              <div className="status-info">
                <span className="status-icon">🛡️</span>
                <div>
                  <strong>Identity</strong>
                  <p>Account ID {profile.defaultUserId || defaultUserId || 'pending'} secures your history.</p>
                </div>
              </div>
              <span className="status-chip idle">Private</span>
            </li>
          </ul>
          <div className="status-callout">
            <h4>Need to list your business?</h4>
            <p>We verify ABN, licences and insurance before featuring any professional.</p>
            <Link href="/professional" className="link-button">
              Complete pro profile →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
