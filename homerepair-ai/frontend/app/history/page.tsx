// homerepair-ai/frontend/app/history/page.tsx
//
// Conversation history redesigned with Tailwind-based timeline/detail panes.

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

  const loadPage = useCallback(
    async (nextToken?: string | null) => {
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
          setItems((prev) => [...prev, ...data.items]);
          setContinuation(data?.continuationToken || null);
        } else {
          setMsg('No conversations yet.');
        }
      } catch {
        setMsg('Failed to load history');
      } finally {
        setLoading(false);
      }
    },
    [getToken, signedIn]
  );

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
      <div className="space-y-6">
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">History</p>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">Sign in to review past advice</h2>
          <p className="mt-3 text-sm text-slate-600">
            Your repair threads are encrypted against your account ID to keep landlord/tenant notes private.
          </p>
        </section>
      </div>
    );
  }

  const total = items.length;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.5em] text-[#0D47A1]/70">History</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Conversation timeline</h1>
            <p className="mt-2 text-sm text-slate-600">
              Revisit diagnoses, costs, and sourcing links you shared with Home Service Assistant.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Threads cached', value: total.toString().padStart(2, '0') },
              { label: 'Status', value: loading ? 'Syncing' : 'Ready' },
              { label: 'Pagination', value: continuation ? 'More' : 'Complete' }
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xl font-semibold text-slate-900">{metric.value}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Timeline</p>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {items.length} entries
            </span>
          </div>
          {items.length === 0 && !loading && !msg && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              No conversations yet. Start a chat from the dashboard to build your history.
            </p>
          )}
          <ul className="space-y-3">
            {items.map((row) => {
              const active = selectedId === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-[#0D47A1]/30 bg-[#0D47A1]/5 shadow-inner'
                        : 'border-slate-100 bg-slate-50/40 hover:border-[#0D47A1]/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      <span>#{row.id}</span>
                      <span>{row.lastRole || 'assistant'}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{row.lastPreview || 'No preview available yet.'}</p>
                    <p className="mt-2 text-xs text-slate-400">{row.updatedAt || row.createdAt || 'Unknown date'}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          {msg && <p className="text-sm text-amber-600">{msg}</p>}
          {continuation && (
            <button
              type="button"
              disabled={loading}
              onClick={() => loadPage(continuation)}
              className="w-full rounded-full border border-[#0D47A1] px-4 py-2 text-sm font-semibold text-[#0D47A1] transition hover:bg-[#0D47A1] hover:text-white disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </section>

        <section className="min-h-[28rem] rounded-3xl border border-slate-100 bg-white p-6 shadow">
          {!selectedId && <p className="text-sm text-slate-500">Select a conversation to review messages.</p>}
          {conversationLoading && <p className="text-sm text-slate-500">Loading conversation…</p>}
          {conversationMsg && <p className="text-sm text-amber-600">{conversationMsg}</p>}
          {conversation && (
            <div className="space-y-4 overflow-y-auto rounded-2xl bg-slate-50/60 p-4">
              {Array.isArray(conversation.messages) && conversation.messages.length > 0 ? (
                conversation.messages.map((msg, idx) => (
                  <div
                    key={`${conversation.id}-${idx}`}
                    className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.role === 'assistant'
                        ? 'border-[#0D47A1]/20 bg-white'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
                      <span>{msg.role}</span>
                      <span className="text-[0.6rem] normal-case">{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{msg.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No messages stored for this conversation.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
