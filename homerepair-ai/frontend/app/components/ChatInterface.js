'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader } from 'lucide-react';
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

const ChatInterface = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { getToken, signedIn } = useAccessToken();
  const [authToken, setAuthToken] = useState(null);

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
      title: 'Investor metrics',
      description: 'Difficulty, spend ranges and professional demand packaged for reporting.',
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
    <div className="chat-interface">
      {!signedIn && (
        <div className="auth-banner">
          <strong>Investor preview:</strong> Sign in to stream live pricing, professional referrals and image
          analysis.
        </div>
      )}

      <div className="capability-grid">
        {capabilityCards.map((card) => (
          <article key={card.title} className={`capability-card ${card.state}`}>
            <div className="card-icon">{card.icon}</div>
            <div>
              <div className="card-header">
                <h3>{card.title}</h3>
                <span className="card-badge">{card.badge}</span>
              </div>
              <p>{card.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="chat-layout">
        <section className="conversation-pane">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <h2>Welcome! I am your Home Assistant!</h2>
                <p>
                  Describe your property issue or upload photos, and I&rsquo;ll return a plan with products,
                  pricing and when to escalate to a professional.
                </p>
                <div className="example-questions">
                  <h3>Pitch-ready prompts:</h3>
                  <ul>
                    <li>&ldquo;My oven has stubborn stains, how can I clean it?&rdquo;</li>
                    <li>&ldquo;There&rsquo;s a small hole in my wall, can I fix it myself?&rdquo;</li>
                    <li>&ldquo;I want to move my furniture. Whom should I hire?&rdquo;</li>
                  </ul>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  {message.images && message.images.length > 0 && (
                    <div className="message-images">
                      {message.images.map((img, imgIndex) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={imgIndex} src={img.dataUrl} alt="User upload" className="message-image" />
                      ))}
                    </div>
                  )}
                  <div className="message-text">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      linkTarget="_blank"
                      components={{
                        a: (anchorProps) => (
                          <a {...anchorProps} rel="noopener noreferrer" target="_blank" />
                        )
                      }}
                    >
                      {message.content || ''}
                    </ReactMarkdown>
                  </div>
                  {(message.difficulty || message.estimatedCostHint || formatLocationLabel(message.location)) && (
                    <div className="ai-meta">
                      {message.difficulty && (
                        <div className="meta-pill">
                          <span className="pill-label">Difficulty</span>
                          <span className="pill-value">{message.difficulty}</span>
                        </div>
                      )}
                      {message.estimatedCostHint && (
                        <div className="meta-pill">
                          <span className="pill-label">Est. cost</span>
                          <span className="pill-value">{message.estimatedCostHint}</span>
                        </div>
                      )}
                      {formatLocationLabel(message.location) && (
                        <div className="location-chip">Based on {formatLocationLabel(message.location)}</div>
                      )}
                    </div>
                  )}
                  {message.featuresLimited && (
                    <div className="limited-note">
                      Sign in to unlock product recommendations, professional referrals, and detailed image
                      analysis.
                    </div>
                  )}
                  {message.imageAnalysis && (
                    <div className="insight-card">
                      <div className="section-heading">
                        <h4>Image insights</h4>
                        <span className="accent-pill">Computer vision</span>
                      </div>
                      {message.imageAnalysis.description && (
                        <p className="insight-text">{message.imageAnalysis.description}</p>
                      )}
                      {Array.isArray(message.imageAnalysis.usedFeatures) &&
                        message.imageAnalysis.usedFeatures.length > 0 && (
                          <div className="pill-row">
                            {message.imageAnalysis.usedFeatures.map((feature, idx) => (
                              <span key={`feature-${idx}`} className="feature-pill">
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                      {Array.isArray(message.imageAnalysis.repairSuggestions) &&
                        message.imageAnalysis.repairSuggestions.length > 0 && (
                          <ul className="insight-list">
                            {message.imageAnalysis.repairSuggestions.map((suggestion, idx) => (
                              <li key={`suggestion-${idx}`}>
                                <div>
                                  <strong>{suggestion.issue}</strong>
                                  {suggestion.urgency && (
                                    <span className="urgency-pill">{suggestion.urgency}</span>
                                  )}
                                </div>
                                <p>{suggestion.action}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>
                  )}
                  {message.products && message.products.length > 0 && (
                    <div className="recommended-products result-section">
                      <div className="section-heading">
                        <h4>Curated products</h4>
                        <span className="accent-pill">Catalogue</span>
                      </div>
                      <div className="result-grid">
                        {message.products.map((product, prodIndex) => (
                          <div key={`product-${prodIndex}`} className="product-card">
                            <h5>{product.name}</h5>
                            <p>Price: {renderPrice(product)}</p>
                            {product.supplier && <p>Available at: {product.supplier}</p>}
                            {product.location && <p>Store: {product.location}</p>}
                            {product.link && (
                              <a href={product.link} target="_blank" rel="noopener noreferrer">
                                View product
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.realtimeProducts && message.realtimeProducts.length > 0 && (
                    <div className="recommended-products result-section">
                      <div className="section-heading">
                        <h4>Live web product picks</h4>
                        <span className="accent-pill live">Realtime</span>
                      </div>
                      <div className="result-grid">
                        {message.realtimeProducts.map((product, prodIndex) => (
                          <div key={`realtime-product-${prodIndex}`} className="product-card live">
                            <h5>{product.name}</h5>
                            <p>{product.supplier || 'Live retailer'}</p>
                            {product.link && (
                              <a href={product.link} target="_blank" rel="noopener noreferrer">
                                Open listing
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.professionals && message.professionals.length > 0 && (
                    <div className="recommended-professionals result-section">
                      <div className="section-heading">
                        <h4>Vetted professionals</h4>
                        <span className="accent-pill">Network</span>
                      </div>
                      <div className="result-grid">
                        {message.professionals.map((pro, proIndex) => (
                          <div key={`professional-${proIndex}`} className="professional-card">
                            <h5>{pro.name}</h5>
                            {pro.services && pro.services.length > 0 && (
                              <p>Services: {pro.services.join(', ')}</p>
                            )}
                            <p>Areas: {formatServiceAreas(pro.serviceAreas)}</p>
                            {pro.rating != null && <p>Rating: {pro.rating}/5</p>}
                            {pro.phone && <p>Phone: {pro.phone}</p>}
                            {pro.website && (
                              <a href={pro.website} target="_blank" rel="noopener noreferrer">
                                {formatWebsiteLabel(pro.website)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.realtimeProfessionals && message.realtimeProfessionals.length > 0 && (
                    <div className="recommended-professionals result-section">
                      <div className="section-heading">
                        <h4>Live web professionals</h4>
                        <span className="accent-pill live">Realtime</span>
                      </div>
                      <div className="result-grid">
                        {message.realtimeProfessionals.map((pro, proIndex) => (
                          <div key={`realtime-professional-${proIndex}`} className="professional-card live">
                            <h5>{pro.name}</h5>
                            <p>Areas: {formatServiceAreas(pro.serviceAreas)}</p>
                            {pro.website && (
                              <a href={pro.website} target="_blank" rel="noopener noreferrer">
                                {formatWebsiteLabel(pro.website)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.realtimeResults && message.realtimeResults.length > 0 && (
                    <div className="live-results">
                      <div className="section-heading">
                        <h4>Live research</h4>
                        <span className="accent-pill live">Realtime</span>
                      </div>
                      <div className="live-result-grid">
                        {message.realtimeResults.map((result, resultIdx) => (
                          <article key={`live-result-${resultIdx}`} className="live-result-card">
                            <span className="result-type">{(result.type || 'general').toUpperCase()}</span>
                            <h5>{result.title}</h5>
                            {result.snippet && <p className="result-snippet">{result.snippet}</p>}
                            {result.link && (
                              <a href={result.link} target="_blank" rel="noopener noreferrer">
                                Visit source
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant loading">
                <div className="message-content">
                  <Loader className="spinner" />
                  <span>Analyzing your problem...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            {selectedImages.length > 0 && (
              <div className="selected-images">
                {selectedImages.map((img, index) => (
                  <div key={index} className="selected-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} />
                    <button onClick={() => removeImage(index)} className="remove-image">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="input-controls">
              <button
                className="image-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !signedIn}
                title={signedIn ? 'Attach photos' : 'Sign in to upload images'}
              >
                <Camera size={20} />
              </button>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your home repair problem..."
                disabled={isLoading}
                rows={1}
                className="message-input"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || (!inputMessage.trim() && selectedImages.length === 0)}
                className="send-button"
              >
                <Send size={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </section>

        <aside className="insight-panel">
          <article className="insight-panel__card highlight">
            <div className="panel-header">
              <span className="panel-chip">Latest insight</span>
              {lastCost && <span className="panel-chip cost">{lastCost}</span>}
            </div>
            <h3>{lastDifficulty}</h3>
            <p>{latestSummary}</p>
            <div className="insight-metrics">
              <div>
                <span className="metric-value">{lastProducts}</span>
                <span className="metric-label">Products</span>
              </div>
              <div>
                <span className="metric-value">{lastPros}</span>
                <span className="metric-label">Pros</span>
              </div>
              <div>
                <span className="metric-value">{lastLive}</span>
                <span className="metric-label">Live hits</span>
              </div>
            </div>
          </article>

          <article className="insight-panel__card">
            <h4>System status</h4>
            <ul className="status-list">
              {statusTiles.map((tile) => (
                <li key={tile.label}>
                  <div className="status-info">
                    <span className="status-icon">{tile.icon}</span>
                    <div>
                      <strong>{tile.label}</strong>
                      <p>{tile.description}</p>
                    </div>
                  </div>
                  <span className={`status-chip ${tile.state}`}>{tile.badge}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="insight-panel__card">
            <h4>Suggested prompts</h4>
            <ul className="prompt-list">
              {promptLibrary.map((prompt) => (
                <li key={prompt}>
                  <button type="button" onClick={() => setInputMessage(prompt)}>
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </div>
  );
};

export default ChatInterface;
