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
      const token = await getToken();
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
    } catch (e: any) {
      setMsg('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [getToken, signedIn]);

  useEffect(() => {
    setItems([]);
    setContinuation(null);
    if (signedIn) loadPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, loadPage]);

  if (!signedIn) {
    return <div style={{ padding: 16 }}><p>Please sign in to view your history.</p></div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 800 }}>
      <h2>My History</h2>
      {items.length === 0 && !loading && !msg && <p>No conversations yet.</p>}
      {items.map(row => (
        <div key={row.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
          <div><strong>ID:</strong> {row.id}</div>
          <div><strong>Updated:</strong> {row.updatedAt || '-'}</div>
          <div><strong>Last:</strong> {row.lastRole || '-'} — {row.lastPreview || ''}</div>
        </div>
      ))}
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      {continuation && (
        <button disabled={loading} onClick={() => loadPage(continuation)} style={{ marginTop: 12 }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
