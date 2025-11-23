'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader, X, Sparkles } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAccessToken } from '../../src/hooks/useAccessToken';

const formatLocationLabel = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  const parts = [
    location.city || location.suburb || null,
    location.state || null,
    location.postcode != null ? String(location.postcode) : null
  ].filter(Boolean);
  return parts.join(', ') || location.raw || '';
};

const formatServiceAreas = (areas) => {
  if (Array.isArray(areas) && areas.length > 0) return areas.join(', ');
  if (typeof areas === 'string' && areas.trim().length > 0) return areas;
  return 'Australia-wide';
};

const formatWebsiteLabel = (url) => {
  if (!url) return '';
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
};

const promptLibrary = [
  'Oven door glass has burnt stains - what removes them safely?',
  'Neighbourhood leak from bathroom ceiling - need short term fix?',
  'Outdoor timber deck has soft spots - can I repair myself?',
  'Tenant damage to benchtop and oven, what costs should I expect?'
];

export default function ChatInterface({ user }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { getToken, signedIn } = useAccessToken();
  const [authToken, setAuthToken] = useState(null);
  const [jobModal, setJobModal] = useState({ open: false, source: null });
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    preferredTime: '',
    budgetMin: '',
    budgetMax: ''
  });
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobNotice, setJobNotice] = useState(null);

  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:7071') + '/api';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!signedIn) {
      setSelectedImages([]);
    }
  }, [signedIn]);

  useEffect(() => {
    let cancelled = false;
    async function refreshToken() {
      if (signedIn) {
        try {
          const token = await getToken();
          if (!cancelled) setAuthToken(token || null);
        } catch (err) {
          console.error('Token refresh failed:', err);
          if (!cancelled) setAuthToken(null);
        }
      } else {
        setAuthToken(null);
      }
    }
    refreshToken();
    return () => {
      cancelled = true;
    };
  }, [signedIn, getToken]);

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && selectedImages.length === 0) || !user) return;

    const messageToSend = inputMessage;
    const imagesToSend = [...selectedImages];

    const userMessage = {
      role: 'user',
      content: messageToSend,
      images: imagesToSend,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    let token = authToken;
    if (signedIn && !token) {
      try {
        token = await getToken();
        setAuthToken(token || null);
      } catch (err) {
        console.error('Token refresh failed:', err);
        token = null;
      }
    }

    try {
      const payload = {
        message: messageToSend,
        conversationId,
        userId: user.id,
        images: imagesToSend
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(`${API_BASE}/chat-handler`, payload, { headers });
      const {
        response: aiResponse,
        conversationId: newConvId,
        products,
        professionals,
        realtimeResults,
        realtimeProducts,
        realtimeProfessionals,
        imageAnalysis,
        difficulty,
        estimatedCostHint,
        location,
        structured,
        featuresLimited
      } = response.data;

      if (!conversationId) {
        setConversationId(newConvId);
      }

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        products,
        professionals,
        realtimeResults,
        realtimeProducts,
        realtimeProfessionals,
        imageAnalysis,
        difficulty,
        estimatedCostHint,
        location,
        structured,
        featuresLimited: !!featuresLimited
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setSelectedImages([]);
    } catch (error) {
      console.error('Chat error:', error);
      const fallback =
        error?.response?.status === 401
          ? 'Your session expired. Please sign in for full features.'
          : 'Sorry, I encountered an error. Please try again.';
      const errorMessage = {
        role: 'assistant',
        content: fallback,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImages((prev) => [
            ...prev,
            {
              file,
              dataUrl: e.target?.result,
              name: file.name
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderPrice = (product) => {
    if (product.priceLow != null && product.priceHigh != null) {
      return `$${product.priceLow} – $${product.priceHigh}`;
    }
    if (product.price != null) {
      return `$${product.price}`;
    }
    return 'N/A';
  };

  const openJobModal = (message) => {
    if (!message || !signedIn) return;
    const defaultTitle = message?.structured?.problemDiagnosis
      ? `Help with ${message.structured.problemDiagnosis}`
      : 'Home service request';
    setJobForm({
      title: defaultTitle,
      description: message.content || '',
      preferredTime: '',
      budgetMin: message.estimatedCostHint ? message.estimatedCostHint.replace(/[^0-9]/g, '') : '',
      budgetMax: ''
    });
    setJobModal({ open: true, source: message });
    setJobNotice(null);
  };

  const submitJob = async () => {
    if (!signedIn || !jobModal.source) return;
    setJobSubmitting(true);
    setJobNotice(null);
    try {
      const token = await getToken({ forceLogin: true });
      if (!token) throw new Error('No auth token');
      const payload = {
        title: jobForm.title,
        description: jobForm.description,
        summary: jobModal.source.structured?.problemDiagnosis || jobForm.title,
        conversationId,
        preferredTime: jobForm.preferredTime,
        budgetMin: jobForm.budgetMin,
        budgetMax: jobForm.budgetMax,
        location: jobModal.source.location || null,
        products: jobModal.source.products || []
      };
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to post job');
      }
      setJobNotice('Job posted! Visit the Jobs tab to review quotes.');
      setJobModal({ open: false, source: null });
    } catch (err) {
      console.error(err);
      setJobNotice(err?.message || 'Job post failed');
    } finally {
      setJobSubmitting(false);
    }
  };

  const latestAssistant = [...messages].slice().reverse().find((m) => m.role === 'assistant');
  const lastProducts = Array.isArray(latestAssistant?.products) ? latestAssistant.products.length : 0;
  const lastPros = Array.isArray(latestAssistant?.professionals) ? latestAssistant.professionals.length : 0;
  const lastLive = Array.isArray(latestAssistant?.realtimeResults)
    ? latestAssistant.realtimeResults.length
    : 0;
  const lastDifficulty =
    latestAssistant?.difficulty || latestAssistant?.structured?.difficulty || 'Awaiting request';
  const lastCost = latestAssistant?.estimatedCostHint || latestAssistant?.structured?.estimatedCost || null;

  const capabilityCards = [
    {
      icon: '🛠️',
      title: 'Guided fixes',
      description: 'Diagnostic steps, difficulty, safety and landlord notes for every scenario.',
      state: 'live',
      badge: 'CORE'
    },
    {
      icon: '🌐',
      title: 'Realtime sourcing',
      description: signedIn
        ? 'Live Bunnings products and DuckDuckGo professional leads.'
        : 'Sign in to unlock live pricing and pro referrals.',
      state: signedIn ? 'live' : 'muted',
      badge: signedIn ? 'LIVE' : 'LOCKED'
    },
    {
      icon: '📷',
      title: 'Vision intelligence',
      description: signedIn
        ? 'Upload interior photos for Azure Computer Vision summaries.'
        : 'Requires sign in for secure uploads.',
      state: signedIn ? 'live' : 'muted',
      badge: signedIn ? 'READY' : 'SIGN IN'
    },
    {
      icon: '📊',
      title: 'Service insights',
      description: 'Difficulty bands, spend ranges and demand signals to guide next actions.',
      state: 'live',
      badge: 'INSIGHT'
    }
  ];

  const statusTiles = [
    {
      label: 'Realtime index',
      description: signedIn
        ? 'Bunnings + DuckDuckGo feeds are connected.'
        : 'Authentication required for live feeds.',
      icon: '⚡',
      badge: signedIn ? 'Online' : 'Limited',
      state: signedIn ? 'good' : 'idle'
    },
    {
      label: 'Vision uploads',
      description: signedIn ? 'JPEG, PNG or WebP up to 10MB.' : 'Sign in to attach property photos.',
      icon: '🖼️',
      badge: signedIn ? 'Ready' : 'Locked',
      state: signedIn ? 'good' : 'idle'
    },
    {
      label: 'Queue',
      description:
        selectedImages.length > 0
          ? `${selectedImages.length} image${selectedImages.length === 1 ? '' : 's'} attached`
          : 'No attachments yet',
      icon: '📁',
      badge: selectedImages.length > 0 ? 'In queue' : 'Empty',
      state: selectedImages.length > 0 ? 'good' : 'idle'
    }
  ];

  const latestSummary = latestAssistant
    ? `Includes ${lastProducts} product${lastProducts === 1 ? '' : 's'} and ${lastPros} professional option${
        lastPros === 1 ? '' : 's'
      }.`
    : 'Once a query is submitted, you will see cost estimates and sourcing suggestions here.';

  return (
    <div className="space-y-6 text-slate-900">
      {!signedIn && (
        <div className="rounded-3xl border border-dashed border-[#0D47A1]/40 bg-[#E8F1FF] px-6 py-4 text-sm text-[#0D47A1] shadow-inner">
          <strong className="font-semibold">Tip:</strong> Sign in to unlock live pricing, professional referrals, and photo
          analysis.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {capabilityCards.map((card) => (
          <article
            key={card.title}
            className={`rounded-2xl border p-5 shadow-lg transition ${
              card.state === 'muted'
                ? 'border-slate-200 bg-white/60 opacity-70'
                : 'border-white/80 bg-white shadow-slate-200/70'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0D47A1]/10 text-xl">
                {card.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-[0.65rem] font-semibold text-slate-500">
                    {card.badge}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {jobNotice && (
        <div className="rounded-2xl border-l-4 border-emerald-500 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow">
          {jobNotice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-h-[32rem] flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/80">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.5em] text-slate-500">Conversation</p>
              <p className="text-lg font-semibold text-slate-900">Home Service Copilot</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
              <span className="rounded-full bg-slate-50 px-3 py-1">Products {lastProducts}</span>
              <span className="rounded-full bg-slate-50 px-3 py-1">Pros {lastPros}</span>
              <span className="rounded-full bg-slate-50 px-3 py-1">Live {lastLive}</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#0D47A1]">
                  <Sparkles className="h-4 w-4" /> Welcome
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-900">Welcome to Home Service Assistant</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Describe your property issue or upload photos, and I’ll return a plan with products, pricing, and when to
                  escalate to a professional.
                </p>
                <div className="mt-6 text-left">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Try asking</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>“My oven has stubborn stains, how can I clean it?”</li>
                    <li>“There’s a small hole in my wall, can I fix it myself?”</li>
                    <li>“I want to move my furniture. Whom should I hire?”</li>
                  </ul>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant';
              return (
                <div
                  key={index}
                  className={`rounded-2xl border p-5 shadow-sm ${
                    isAssistant ? 'border-[#0D47A1]/15 bg-[#0D47A1]/5' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-slate-400">
                    <span>{isAssistant ? 'Assistant' : 'You'}</span>
                    <span className="tracking-normal text-[0.65rem] normal-case text-slate-400">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {message.images && message.images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {message.images.map((img, imgIndex) => (
                        <div key={imgIndex} className="overflow-hidden rounded-2xl border border-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.dataUrl} alt="User upload" className="h-20 w-20 object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      linkTarget="_blank"
                      components={{
                        a: (anchorProps) => (
                          <a {...anchorProps} rel="noopener noreferrer" target="_blank" className="text-[#0D47A1] underline" />
                        )
                      }}
                    >
                      {message.content || ''}
                    </ReactMarkdown>
                  </div>

                  {(message.difficulty || message.estimatedCostHint || formatLocationLabel(message.location)) && (
                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                      {message.difficulty && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                          Difficulty: {message.difficulty}
                        </span>
                      )}
                      {message.estimatedCostHint && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                          Est. cost: {message.estimatedCostHint}
                        </span>
                      )}
                      {formatLocationLabel(message.location) && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1">
                          Based on {formatLocationLabel(message.location)}
                        </span>
                      )}
                    </div>
                  )}

                  {message.featuresLimited && (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#0D47A1]/40 bg-[#E8F1FF] px-4 py-3 text-xs text-[#0D47A1]">
                      Sign in to unlock product recommendations, professional referrals, and detailed image analysis.
                    </div>
                  )}

                  {message.imageAnalysis && (
                    <div className="mt-5 rounded-2xl border border-[#0D47A1]/15 bg-white/80 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Image insights</h4>
                        <span className="rounded-full bg-[#0D47A1]/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#0D47A1]">
                          Vision
                        </span>
                      </div>
                      {message.imageAnalysis.description && (
                        <p className="mt-2 text-sm text-slate-600">{message.imageAnalysis.description}</p>
                      )}
                      {Array.isArray(message.imageAnalysis.usedFeatures) && message.imageAnalysis.usedFeatures.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.imageAnalysis.usedFeatures.map((feature, idx) => (
                            <span key={`feature-${idx}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              {feature}
                            </span>
                          ))}
                        </div>
                      )}
                      {Array.isArray(message.imageAnalysis.repairSuggestions) &&
                        message.imageAnalysis.repairSuggestions.length > 0 && (
                          <ul className="mt-3 space-y-2 text-sm text-slate-600">
                            {message.imageAnalysis.repairSuggestions.map((suggestion, idx) => (
                              <li key={`suggestion-${idx}`} className="rounded-xl border border-slate-100 px-3 py-2">
                                <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                                  <span>{suggestion.issue}</span>
                                  {suggestion.urgency && (
                                    <span className="text-xs uppercase tracking-[0.3em] text-[#0D47A1]">
                                      {suggestion.urgency}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{suggestion.action}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  )}

                  {message.products && message.products.length > 0 && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Curated products</h4>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-semibold text-slate-500">
                          Catalogue
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {message.products.map((product, prodIndex) => (
                          <div key={`product-${prodIndex}`} className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
                            <p className="text-base font-semibold text-slate-900">{product.name}</p>
                            <p className="mt-1 text-sm">Price: {renderPrice(product)}</p>
                            {product.supplier && <p className="mt-1">Available at: {product.supplier}</p>}
                            {product.location && <p className="mt-1">Store: {product.location}</p>}
                            {product.link && (
                              <a href={product.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#0D47A1]">
                                View product
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.realtimeProducts && message.realtimeProducts.length > 0 && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Live web product picks</h4>
                        <span className="rounded-full bg-[#0D47A1]/10 px-3 py-1 text-[0.65rem] font-semibold text-[#0D47A1]">
                          Realtime
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {message.realtimeProducts.map((product, prodIndex) => (
                          <div key={`realtime-product-${prodIndex}`} className="rounded-2xl border border-[#0D47A1]/15 bg-white p-4 text-sm text-slate-600">
                            <p className="text-base font-semibold text-slate-900">{product.name}</p>
                            <p className="mt-1 text-sm">{product.supplier || 'Live retailer'}</p>
                            {product.link && (
                              <a href={product.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#0D47A1]">
                                Open listing
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.professionals && message.professionals.length > 0 && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Vetted professionals</h4>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-semibold text-slate-500">
                          Network
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {message.professionals.map((pro, proIndex) => (
                          <div key={`professional-${proIndex}`} className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
                            <p className="text-base font-semibold text-slate-900">{pro.name}</p>
                            {pro.services && pro.services.length > 0 && <p className="mt-1">Services: {pro.services.join(', ')}</p>}
                            <p className="mt-1">Areas: {formatServiceAreas(pro.serviceAreas)}</p>
                            {pro.rating != null && <p className="mt-1">Rating: {pro.rating}/5</p>}
                            {pro.phone && <p className="mt-1">Phone: {pro.phone}</p>}
                            {pro.website && (
                              <a href={pro.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#0D47A1]">
                                {formatWebsiteLabel(pro.website)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.realtimeProfessionals && message.realtimeProfessionals.length > 0 && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Live web professionals</h4>
                        <span className="rounded-full bg-[#0D47A1]/10 px-3 py-1 text-[0.65rem] font-semibold text-[#0D47A1]">
                          Realtime
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {message.realtimeProfessionals.map((pro, proIndex) => (
                          <div key={`realtime-professional-${proIndex}`} className="rounded-2xl border border-[#0D47A1]/15 bg-white p-4 text-sm text-slate-600">
                            <p className="text-base font-semibold text-slate-900">{pro.name}</p>
                            <p className="mt-1">Areas: {formatServiceAreas(pro.serviceAreas)}</p>
                            {pro.website && (
                              <a href={pro.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#0D47A1]">
                                {formatWebsiteLabel(pro.website)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.realtimeResults && message.realtimeResults.length > 0 && (
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Live research</h4>
                        <span className="rounded-full bg-[#0D47A1]/10 px-3 py-1 text-[0.65rem] font-semibold text-[#0D47A1]">
                          Realtime
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {message.realtimeResults.map((result, resultIdx) => (
                          <article key={`live-result-${resultIdx}`} className="rounded-2xl border border-[#0D47A1]/15 bg-white p-4">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#0D47A1]">
                              {(result.type || 'general').toUpperCase()}
                            </span>
                            <h5 className="mt-2 text-base font-semibold text-slate-900">{result.title}</h5>
                            {result.snippet && <p className="mt-1 text-sm text-slate-600">{result.snippet}</p>}
                            {result.link && (
                              <a href={result.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-sm font-semibold text-[#0D47A1]">
                                Visit source
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {signedIn && isAssistant && !message.isError && (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => openJobModal(message)}
                        className="inline-flex items-center justify-center rounded-full border border-[#0D47A1] px-4 py-2 text-sm font-semibold text-[#0D47A1] transition hover:bg-[#0D47A1] hover:text-white"
                      >
                        Post this as a job
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <Loader className="h-4 w-4 animate-spin text-[#0D47A1]" />
                  <span>Analyzing your problem...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            {selectedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your home repair problem..."
                  disabled={isLoading}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-[#0D47A1] disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || !signedIn}
                  title={signedIn ? 'Attach photos' : 'Sign in to upload images'}
                >
                  <Camera className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isLoading || (!inputMessage.trim() && selectedImages.length === 0)}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#0D47A1] px-6 text-sm font-semibold text-white shadow-lg shadow-[#0D47A1]/30 transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {isLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </section>

        <aside className="space-y-5">
          <article className="rounded-3xl border border-[#0D47A1]/20 bg-white p-6 shadow-xl shadow-[#0D47A1]/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-[#0D47A1]/70">Latest insight</span>
              {lastCost && (
                <span className="rounded-full bg-[#0D47A1]/10 px-3 py-1 text-xs font-semibold text-[#0D47A1]">{lastCost}</span>
              )}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">{lastDifficulty}</h3>
            <p className="mt-2 text-sm text-slate-600">{latestSummary}</p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-slate-100 p-3">
                <p className="text-xl font-semibold text-slate-900">{lastProducts}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Products</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-3">
                <p className="text-xl font-semibold text-slate-900">{lastPros}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Pros</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-3">
                <p className="text-xl font-semibold text-slate-900">{lastLive}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Live</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow">
            <h4 className="text-sm font-semibold text-slate-900">System status</h4>
            <ul className="mt-4 space-y-3">
              {statusTiles.map((tile) => (
                <li key={tile.label} className="flex items-start justify-between rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{tile.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{tile.label}</p>
                      <p className="text-xs text-slate-500">{tile.description}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      tile.state === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tile.badge}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow">
            <h4 className="text-sm font-semibold text-slate-900">Suggested prompts</h4>
            <div className="mt-4 space-y-3">
              {promptLibrary.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInputMessage(prompt)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:border-[#0D47A1] hover:text-[#0D47A1]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </article>
        </aside>
      </div>

      {jobModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Post this job</h3>
              <button
                type="button"
                onClick={() => setJobModal({ open: false, source: null })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label="Close job modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                <span>Title</span>
                <input
                  type="text"
                  value={jobForm.title}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={jobForm.description}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-semibold text-slate-700">
                  <span>Preferred time</span>
                  <input
                    type="text"
                    value={jobForm.preferredTime}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
                    placeholder="This weekend, ASAP..."
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  <span>Budget min (AUD)</span>
                  <input
                    type="number"
                    value={jobForm.budgetMin}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, budgetMin: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  <span>Budget max (AUD)</span>
                  <input
                    type="number"
                    value={jobForm.budgetMax}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, budgetMax: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D47A1]"
                  />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={() => setJobModal({ open: false, source: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitJob}
                disabled={jobSubmitting}
                className="inline-flex items-center justify-center rounded-full bg-[#0D47A1] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {jobSubmitting ? 'Posting…' : 'Post job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
