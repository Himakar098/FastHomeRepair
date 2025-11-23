// homerepair-ai/frontend/app/account/page.tsx
//
// Account preferences form upgraded to the new Lawpath-style SaaS UI while
// preserving the original data loading and submission logic.

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useHttp } from '../../src/api/http';
import { useAccessToken } from '../../src/hooks/useAccessToken';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

type AccountClaims = {
  emails?: string[];
  email?: string;
  oid?: string;
};

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
    const claims = (account.idTokenClaims || {}) as AccountClaims;
    if (Array.isArray(claims.emails) && claims.emails.length) return claims.emails[0];
    return claims.email || account.username || '';
  }, [account]);

  const defaultUserId = useMemo(() => {
    if (!account) return '';
    const claims = (account.idTokenClaims || {}) as AccountClaims;
    return claims.oid || account.localAccountId || account.homeAccountId || '';
  }, [account]);

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
        setProfile((prev) => ({
          ...prev,
          contactEmail: accountEmail || prev.contactEmail,
          defaultUserId: defaultUserId || prev.defaultUserId
        }));
      }
    } catch {
      setMsg('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [accountEmail, defaultUserId, getToken]);

  useEffect(() => {
    if (signedIn) loadProfile();
  }, [signedIn, loadProfile]);

  useEffect(() => {
    setProfile((prev) => ({
      ...prev,
      contactEmail: prev.contactEmail || accountEmail || prev.contactEmail,
      defaultUserId: prev.defaultUserId || defaultUserId || prev.defaultUserId
    }));
  }, [accountEmail, defaultUserId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      setMsg('Profile saved');
    } catch (err) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMsg(errorMessage || 'Save failed');
    } finally {
      setLoading(false);
      loadProfile();
    }
  }

  const lastUpdated = profile.updatedAt
    ? new Date(profile.updatedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not saved yet';

  if (!signedIn) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">Account</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">Sign in to manage your profile</h2>
          <p className="mt-3 text-sm text-slate-600">
            Secure your repairs, track history, and unlock realtime sourcing by authenticating first.
          </p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          {['Realtime sourcing', 'Vision uploads', 'Professional referrals'].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 bg-white p-4 shadow">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Locked</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item}</p>
              <p className="mt-1 text-sm text-slate-500">Available immediately after sign in.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-[#0D47A1]/70">Account</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Profile & Preferences</h1>
            <p className="mt-2 text-sm text-slate-600">
              Keep your contact details current so the assistant can tailor costs, pros, and safety alerts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{profile.preferredUsername ? 'Active' : 'Draft'}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Profile status</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{profile.contactEmail ? 'Verified' : 'Pending'}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Email</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{profile.updatedAt ? '✓' : '–'}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Last save</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <header className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Contact</p>
              <h3 className="text-xl font-semibold text-slate-900">Your details</h3>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              Updated {lastUpdated}
            </span>
          </header>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Preferred username
                <input
                  id="preferredUsername"
                  name="preferredUsername"
                  type="text"
                  value={profile.preferredUsername || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, preferredUsername: e.target.value }))}
                  required
                  maxLength={100}
                  placeholder="Choose how we'd address you"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Contact email
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  value={profile.contactEmail || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, contactEmail: e.target.value }))}
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Mobile number
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  value={profile.mobileNumber || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, mobileNumber: e.target.value }))}
                  placeholder="+61 4XX XXX XXX"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Default user ID
                <input
                  id="defaultUserId"
                  name="defaultUserId"
                  type="text"
                  value={profile.defaultUserId || ''}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                />
              </label>
            </div>

            <label className="text-sm font-semibold text-slate-700">
              Address (optional)
              <textarea
                id="address"
                name="address"
                rows={3}
                value={profile.address || ''}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                placeholder="Apartment 3B, 120 Collins St, Melbourne VIC 3000"
                maxLength={280}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-full bg-[#0D47A1] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0D47A1]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save profile'}
              </button>
              {msg && <span className="text-sm font-semibold text-slate-600">{msg}</span>}
            </div>
          </form>
        </section>

        <aside className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Profile completeness</p>
          <div className="space-y-3">
            {[
              { label: 'Realtime sourcing', done: Boolean(profile.contactEmail) },
              { label: 'Vision uploads', done: Boolean(profile.mobileNumber) },
              { label: 'Pro referrals', done: Boolean(profile.address) }
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.done ? 'Enabled' : 'Complete profile to unlock'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.done ? 'Ready' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-[#0D47A1]/40 bg-[#E8F1FF] p-4 text-sm text-[#0D47A1]">
            Prefer white-glove onboarding? Email support@homerepair.ai with your account ID ({profile.defaultUserId || 'N/A'})
            and we&#39;ll sync details for you.
          </div>
        </aside>
      </div>
    </div>
  );
}
