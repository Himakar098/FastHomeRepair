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

type HistoryMessage = {
  role: string;
  content: string;
  timestamp?: string;
};

type ConversationDetail = {
  id: string;
  messages?: HistoryMessage[];
  createdAt?: string;
  updatedAt?: string;
};

export default function HistoryPage() {
  const { signedIn, getToken } = useAccessToken();
  const [items, setItems] = useState<Item[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationMsg, setConversationMsg] = useState<string | null>(null);

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
    setSelectedId(null);
    setConversation(null);
    if (signedIn) loadPage(null);
  }, [signedIn, loadPage]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setConversationLoading(true);
      setConversationMsg(null);
      try {
        const token = await getToken({ forceLogin: true });
        if (!token) {
          throw new Error('No auth token');
        }
        const url = new URL(`${API_BASE}/api/get-conversation`);
        url.searchParams.set('id', conversationId);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error('Failed to load conversation');
        }
        const data = (await res.json()) as ConversationDetail;
        setConversation(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load conversation';
        setConversation(null);
        setConversationMsg(message);
      } finally {
        setConversationLoading(false);
      }
    },
    [getToken]
  );

  const handleSelect = (row: Item) => {
    setSelectedId(row.id);
    loadConversation(row.id);
  };

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

      <div className="page-grid two-columns">
        <section className="page-card primary">
          {items.length === 0 && !loading && !msg && (
            <p>No conversations yet. Start a chat from the dashboard to build your history.</p>
          )}
          <ul className="timeline-list">
            {items.map(row => (
              <li key={row.id} className={`timeline-item ${selectedId === row.id ? 'selected' : ''}`}>
                <div className="timeline-dot" />
                <button type="button" onClick={() => handleSelect(row)}>
                  <div className="timeline-content">
                    <div className="timeline-row">
                      <span className="history-id">#{row.id}</span>
                      <span className="history-badge">{row.lastRole || 'assistant'}</span>
                    </div>
                    <p className="timeline-preview">{row.lastPreview || 'No preview available yet.'}</p>
                    <p className="timeline-date">{row.updatedAt || row.createdAt || 'Unknown date'}</p>
                  </div>
                </button>
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

        <section className="page-card secondary history-detail">
          {!selectedId && <p>Select a conversation to review messages.</p>}
          {conversationLoading && <p>Loading conversation…</p>}
          {conversationMsg && <p className="form-status">{conversationMsg}</p>}
          {conversation && (
            <div className="history-messages">
              {Array.isArray(conversation.messages) && conversation.messages.length > 0 ? (
                conversation.messages.map((msg, idx) => (
                  <div key={`${conversation.id}-${idx}`} className={`history-message ${msg.role}`}>
                    <div className="history-message__body">
                      <p>{msg.content}</p>
                    </div>
                    <span className="history-message__time">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                ))
              ) : (
                <p>No messages stored for this conversation.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
