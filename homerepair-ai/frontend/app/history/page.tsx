// homerepair-ai/frontend/app/history/page.tsx
//
// Displays a paginated list of the user's past conversations.  Only
// accessible when the user is signed in; otherwise prompts for login.

'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAccessToken } from '../../src/hooks/useAccessToken';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:7071';

type Item = {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  lastPreview?: string;
  lastRole?: string | null;
};

export default function HistoryPage() {
  const { signedIn, getToken } = useAccessToken();
  const [items, setItems] = useState<Item[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPage = useCallback(async (nextToken?: string | null) => {
    if (!signedIn) return;
    setLoading(true);
    setMsg(null);
    try {
      const token = await getToken({ forceLogin: true });
      if (!token) {
        throw new Error('No auth token');
      }
      const url = new URL(`${API_BASE}/api/list-conversations`);
      url.searchParams.set('limit', '20');
      if (nextToken) url.searchParams.set('continuationToken', nextToken);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        setItems(prev => [...prev, ...data.items]);
        setContinuation(data?.continuationToken || null);
      } else {
        setMsg('No conversations yet.');
      }
    } catch {
      setMsg('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [getToken, signedIn]);

  useEffect(() => {
    setItems([]);
    setContinuation(null);
    if (signedIn) loadPage(null);
  }, [signedIn, loadPage]);

  if (!signedIn) {
    return (
      <div className="page-shell">
        <section className="page-card primary centered">
          <p className="eyebrow">History</p>
          <h2>Sign in to review past advice</h2>
          <p>Your repair threads are encrypted against your account ID to keep landlord/tenant notes private.</p>
        </section>
      </div>
    );
  }

  const total = items.length;

  return (
    <div className="page-shell">
      <header className="page-card primary">
        <p className="eyebrow">History</p>
        <div className="page-header__row">
          <div>
            <h1>Conversation Timeline</h1>
            <p>Revisit diagnoses, costs and sourcing links you shared with Home Service Assistant.</p>
          </div>
          <div className="page-metrics">
            <div>
              <span className="metric-value">{total.toString().padStart(2, '0')}</span>
              <span className="metric-label">Threads cached</span>
            </div>
            <div>
              <span className="metric-value">{loading ? 'Syncing' : 'Ready'}</span>
              <span className="metric-label">Status</span>
            </div>
            <div>
              <span className="metric-value">{continuation ? 'More' : 'Complete'}</span>
              <span className="metric-label">Pagination</span>
            </div>
          </div>
        </div>
      </header>

      <section className="page-card primary">
        {items.length === 0 && !loading && !msg && (
          <p>No conversations yet. Start a chat from the dashboard to build your history.</p>
        )}
        <ul className="timeline-list">
          {items.map(row => (
            <li key={row.id} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="history-id">#{row.id}</span>
                  <span className="history-badge">{row.lastRole || 'assistant'}</span>
                </div>
                <p className="timeline-preview">{row.lastPreview || 'No preview available yet.'}</p>
                <p className="timeline-date">{row.updatedAt || row.createdAt || 'Unknown date'}</p>
              </div>
            </li>
          ))}
        </ul>
        {msg && <p className="form-status">{msg}</p>}
        {continuation && (
          <div className="form-actions">
            <button type="button" disabled={loading} onClick={() => loadPage(continuation)}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
