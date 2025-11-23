// homerepair-ai/frontend/app/jobs/page.tsx
//
// Jobs dashboard redesigned with modern SaaS cards while preserving the
// existing job + quote logic.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAccessToken } from '../../src/hooks/useAccessToken';

type Job = {
  id: string;
  title: string;
  description: string;
  status: string;
  quotes?: Quote[];
  createdAt?: string;
};

type Quote = {
  id: string;
  professionalName: string;
  priceMin: number | null;
  priceMax: number | null;
  availability?: string;
  message?: string;
  status?: string;
};

export default function JobsPage() {
  const { signedIn, getToken } = useAccessToken();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [boardJobs, setBoardJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [proProfile, setProProfile] = useState<boolean>(false);
  const [quoteModal, setQuoteModal] = useState<{ job: Job | null }>({ job: null });
  const [quoteForm, setQuoteForm] = useState({ priceMin: '', priceMax: '', availability: '', message: '' });
  const [quotesView, setQuotesView] = useState<{ job: Job | null; quotes: Quote[] }>({ job: null, quotes: [] });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getToken({ forceLogin: true });
      if (!token) throw new Error('Auth required');
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Request failed');
      }
      return res.json();
    },
    [API_BASE, getToken]
  );

  const loadJobs = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    try {
      const profile = await authedFetch('/api/get-profile');
      setProProfile(Boolean(profile?.professional));
      const [userJobs, board] = await Promise.all([
        authedFetch('/api/jobs?role=user'),
        authedFetch('/api/jobs?role=professional').catch(() => [])
      ]);
      setMyJobs(Array.isArray(userJobs) ? userJobs : []);
      setBoardJobs(Array.isArray(board) ? board : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, signedIn]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const openQuoteModal = (job: Job) => {
    setQuoteForm({ priceMin: '', priceMax: '', availability: '', message: '' });
    setQuoteModal({ job });
  };

  const submitQuote = async () => {
    if (!quoteModal.job) return;
    setQuoteLoading(true);
    try {
      await authedFetch('/api/job-quotes', {
        method: 'POST',
        body: JSON.stringify({
          jobId: quoteModal.job.id,
          priceMin: quoteForm.priceMin,
          priceMax: quoteForm.priceMax,
          availability: quoteForm.availability,
          message: quoteForm.message
        })
      });
      setQuoteModal({ job: null });
      loadJobs();
    } catch (err) {
      console.error(err);
    } finally {
      setQuoteLoading(false);
    }
  };

  const viewQuotes = async (job: Job) => {
    try {
      const quotes = await authedFetch(`/api/job-quotes?jobId=${job.id}`);
      setQuotesView({ job, quotes: Array.isArray(quotes) ? quotes : [] });
    } catch (err) {
      console.error(err);
    }
  };

  const acceptQuote = async (quoteId: string) => {
    if (!quotesView.job) return;
    try {
      await authedFetch('/api/job-quotes', {
        method: 'PATCH',
        body: JSON.stringify({
          jobId: quotesView.job.id,
          quoteId,
          action: 'accept',
          scheduledSlot: ''
        })
      });
      setQuotesView({ job: null, quotes: [] });
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  };

  if (!signedIn) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">Jobs</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">Sign in to manage jobs</h2>
          <p className="mt-3 text-sm text-slate-600">Quotes, dispatch, and compliance workflows require authentication.</p>
        </section>
      </div>
    );
  }

  const openJobs = myJobs.filter((job) => job.status?.toLowerCase() === 'open').length;
  const totalQuotes = myJobs.reduce((sum, job) => sum + (Array.isArray(job.quotes) ? job.quotes.length : 0), 0);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-[#0D47A1]/70">Jobs</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Your repair jobs</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track requests, review professional quotes, and confirm bookings across every HomeRepair AI workflow.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Open jobs', value: openJobs },
              { label: 'Total jobs', value: myJobs.length },
              { label: 'Quotes recd.', value: totalQuotes }
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xl font-semibold text-slate-900">{metric.value}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow">
          Syncing latest jobs…
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Customer</p>
              <h3 className="text-xl font-semibold text-slate-900">My jobs</h3>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {myJobs.length} active
            </span>
          </div>
          {myJobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              No jobs posted yet. Convert a conversation into a job from the chat panel.
            </div>
          )}
          {myJobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 shadow-inner">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-500">
                    Job #{job.id.slice(0, 6)}
                  </p>
                  <h4 className="text-lg font-semibold text-slate-900">{job.title}</h4>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    job.status?.toLowerCase() === 'open'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{job.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => viewQuotes(job)}
                  className="inline-flex items-center rounded-full border border-[#0D47A1] px-4 py-2 text-sm font-semibold text-[#0D47A1] transition hover:bg-[#0D47A1] hover:text-white"
                >
                  View quotes
                </button>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'No timestamp'}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
                {proProfile ? 'Job board' : 'Professional network'}
              </p>
              <h3 className="text-xl font-semibold text-slate-900">
                {proProfile ? 'Available jobs' : 'Get verified'}
              </h3>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {proProfile ? `${boardJobs.length} posted` : 'ID required'}
            </span>
          </div>
          {!proProfile && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              Register your business in the Pro Signup tab to start quoting on live jobs.
            </div>
          )}
          {proProfile && boardJobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              No open jobs nearby right now. Check back soon or expand your service areas.
            </div>
          )}
          {proProfile &&
            boardJobs.map((job) => (
              <article key={job.id} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-500">
                      New request
                    </p>
                    <h4 className="text-lg font-semibold text-slate-900">{job.title}</h4>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {job.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{job.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openQuoteModal(job)}
                    className="inline-flex items-center rounded-full bg-[#0D47A1] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#0D47A1]/30 transition hover:-translate-y-0.5"
                  >
                    Submit quote
                  </button>
                </div>
              </article>
            ))}
        </section>
      </div>

      {quoteModal.job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Quote</p>
                <h3 className="text-xl font-semibold text-slate-900">{quoteModal.job.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuoteModal({ job: null })}
                className="rounded-full bg-slate-100 p-2 text-slate-600"
                aria-label="Close quote modal"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Price min (AUD)
                <input
                  type="number"
                  value={quoteForm.priceMin}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, priceMin: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Price max (AUD)
                <input
                  type="number"
                  value={quoteForm.priceMax}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, priceMax: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
            </div>
            <label className="text-sm font-semibold text-slate-700">
              Availability
              <input
                type="text"
                value={quoteForm.availability}
                onChange={(e) => setQuoteForm((prev) => ({ ...prev, availability: e.target.value }))}
                placeholder="e.g. Mon-Wed afternoons"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Message
              <textarea
                rows={3}
                value={quoteForm.message}
                onChange={(e) => setQuoteForm((prev) => ({ ...prev, message: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
              />
            </label>
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={() => setQuoteModal({ job: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitQuote}
                disabled={quoteLoading}
                className="inline-flex items-center rounded-full bg-[#0D47A1] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {quoteLoading ? 'Submitting…' : 'Submit quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {quotesView.job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Quotes</p>
                <h3 className="text-xl font-semibold text-slate-900">{quotesView.job.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuotesView({ job: null, quotes: [] })}
                className="rounded-full bg-slate-100 p-2 text-slate-600"
                aria-label="Close quotes modal"
              >
                ✕
              </button>
            </div>
            {quotesView.quotes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                No quotes yet.
              </p>
            )}
            <div className="grid gap-4">
              {quotesView.quotes.map((quote) => (
                <div key={quote.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <strong className="text-base text-slate-900">{quote.professionalName}</strong>
                    <span className="text-sm font-semibold text-slate-600">
                      {quote.priceMin ? `$${quote.priceMin}` : '—'} - {quote.priceMax ? `$${quote.priceMax}` : '—'}
                    </span>
                  </div>
                  {quote.availability && <p className="mt-2 text-sm text-slate-600">Availability: {quote.availability}</p>}
                  {quote.message && <p className="mt-2 text-sm text-slate-600">{quote.message}</p>}
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Status: {quote.status || 'pending'}
                  </p>
                  {quotesView.job?.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => acceptQuote(quote.id)}
                      className="mt-3 inline-flex items-center rounded-full bg-[#0D47A1] px-4 py-2 text-sm font-semibold text-white shadow hover:-translate-y-0.5"
                    >
                      Accept quote
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
