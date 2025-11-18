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
          'Content-Type': options.body ? 'application/json' : 'application/json'
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
      <div className="page-shell">
        <section className="page-card primary centered">
          <p className="eyebrow">Jobs</p>
          <h2>Sign in to manage jobs</h2>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="page-card primary">
        <p className="eyebrow">Jobs</p>
        <div className="page-header__row">
          <div>
            <h1>Your repair jobs</h1>
            <p>Track requests, review professional quotes, and confirm bookings.</p>
          </div>
        </div>
      </header>
      {loading && <p>Loading…</p>}
      <div className="page-grid two-columns">
        <section className="page-card primary">
          <h3>My jobs</h3>
          {myJobs.length === 0 && <p>No jobs posted yet.</p>}
          {myJobs.map((job) => (
            <article key={job.id} className="page-card primary">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Job #{job.id.slice(0, 6)}</p>
                  <h3>{job.title}</h3>
                </div>
                <span className="page-chip subtle">{job.status}</span>
              </div>
              <p>{job.description}</p>
              <div className="form-actions">
                <button type="button" onClick={() => viewQuotes(job)}>
                  View quotes
                </button>
              </div>
            </article>
          ))}
        </section>
        {proProfile && (
          <section className="page-card secondary">
            <h3>Job board</h3>
            {boardJobs.length === 0 && <p>No open jobs nearby. Check back soon.</p>}
            {boardJobs.map((job) => (
              <article key={job.id} className="page-card secondary">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">New job</p>
                    <h3>{job.title}</h3>
                  </div>
                  <span className="page-chip subtle">{job.status}</span>
                </div>
                <p>{job.description}</p>
                <div className="form-actions">
                  <button type="button" onClick={() => openQuoteModal(job)}>
                    Submit quote
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {quoteModal.job && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Quote for {quoteModal.job.title}</h3>
            <div className="modal-grid">
              <label>
                <span>Price min (AUD)</span>
                <input
                  type="number"
                  value={quoteForm.priceMin}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, priceMin: e.target.value }))}
                />
              </label>
              <label>
                <span>Price max (AUD)</span>
                <input
                  type="number"
                  value={quoteForm.priceMax}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, priceMax: e.target.value }))}
                />
              </label>
              <label>
                <span>Availability</span>
                <input
                  type="text"
                  value={quoteForm.availability}
                  onChange={(e) => setQuoteForm((prev) => ({ ...prev, availability: e.target.value }))}
                  placeholder="e.g. Mon-Wed afternoons"
                />
              </label>
            </div>
            <label>
              <span>Message</span>
              <textarea
                rows={3}
                value={quoteForm.message}
                onChange={(e) => setQuoteForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setQuoteModal({ job: null })}>
                Cancel
              </button>
              <button type="button" onClick={submitQuote} disabled={quoteLoading}>
                {quoteLoading ? 'Submitting…' : 'Submit quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {quotesView.job && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Quotes for {quotesView.job.title}</h3>
            {quotesView.quotes.length === 0 && <p>No quotes yet.</p>}
            <div className="quote-list">
              {quotesView.quotes.map((quote) => (
                <div key={quote.id} className="quote-card">
                  <strong>{quote.professionalName}</strong>
                  <p>
                    {quote.priceMin && <span>${quote.priceMin}</span>} - {quote.priceMax && <span>${quote.priceMax}</span>}
                  </p>
                  {quote.availability && <p>Availability: {quote.availability}</p>}
                  {quote.message && <p>{quote.message}</p>}
                  <p>Status: {quote.status || 'pending'}</p>
                  {quotesView.job?.status === 'open' && (
                    <button type="button" onClick={() => acceptQuote(quote.id)}>
                      Accept quote
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setQuotesView({ job: null, quotes: [] })}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
