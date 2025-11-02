'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useHttp } from '../api/http';
import { useAccessToken } from '../hooks/useAccessToken';

/**
 * ChatInterface
 *
 * This component provides the main conversational UI for the Home Repair
 * assistant.  It focuses on collecting the user's problem description
 * (and any images) and renders structured responses from the backend,
 * including recommended products and professionals.
 *
 * Props:
 *   user – an object containing at least `{ id }` and optionally a
 *           `token` property.  The token, if present, will be sent
 *           as a Bearer Authorization header to authenticated API
 *           endpoints.
 */
const ChatInterface = ({ user }) => {
  const { post } = useHttp();
  const { signedIn } = useAccessToken();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // API calls use the useHttp hook to automatically apply the base URL and bearer token

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && selectedImages.length === 0) return;
    if (!user) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      images: selectedImages,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const body = {
        message: inputMessage,
        conversationId,
        userId: user.id,
        images: selectedImages
      };
      // Use the useHttp helper to automatically include the bearer token (if signed in)
      const response = await post('/api/chat-handler', body);
      const {
        response: aiResponse,
        conversationId: newConvId,
        products,
        professionals,
        realtimeResults,
        realtimeProducts,
        realtimeProfessionals
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
        realtimeProfessionals
      };
      setMessages(prev => [...prev, assistantMessage]);
      setSelectedImages([]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedImages(prev => [...prev, {
            file,
            dataUrl: e.target.result,
            name: file.name
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render price or price range
  const renderPrice = (product) => {
    if (product.priceLow != null && product.priceHigh != null) {
      return `$${product.priceLow} – $${product.priceHigh}`;
    }
    if (product.price != null) {
      return `$${product.price}`;
    }
    return 'N/A';
  };

  const formatResultType = (type) => {
    if (!type || type === 'general') return 'General';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="chat-interface">
      <div
        className="premium-banner"
        style={{
          marginBottom: 12,
          padding: '12px 16px',
          backgroundColor: '#f5f8ff',
          border: '1px solid #d0dcff',
          borderRadius: 8,
          fontSize: 14,
          lineHeight: 1.4
        }}
      >
        {signedIn
          ? 'Live web search results, real-time pricing and image analysis are active on your account.'
          : 'Sign in to unlock live web search results, professional referrals and AI image analysis.'}
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome to Home Assistant!</h2>
            <p>Describe your home problem or upload photos, and I'll help you find the best solution.</p>
            <div className="example-questions">
              <h3>Try asking:</h3>
              <ul>
                <li>"My oven has stubborn stains, how can I clean it?"</li>
                <li>"There's a small hole in my wall, can I fix it myself?"</li>
                <li>"I want to move my furniture. Whom should I hire?"</li>
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
                    <img key={imgIndex} src={img.dataUrl} alt="User upload" className="message-image" />
                  ))}
                </div>
              )}
              <div className="message-text">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  linkTarget="_blank"
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} rel="noopener noreferrer" target="_blank" />
                    )
                  }}
                >
                  {message.content || ''}
                </ReactMarkdown>
              </div>
              {message.products && message.products.length > 0 && (
                <div className="recommended-products">
                  <h4>Recommended Products:</h4>
                  {message.products.map((product, prodIndex) => (
                    <div key={prodIndex} className="product-card">
                      <h5>{product.name}</h5>
                      <p>Price: {renderPrice(product)}</p>
                      {product.supplier && <p>Available at: {product.supplier}</p>}
                      {product.link && (
                        <a href={product.link} target="_blank" rel="noopener noreferrer">
                          View Product
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {message.professionals && message.professionals.length > 0 && (
                <div className="recommended-professionals">
                  <h4>Professional Help:</h4>
                  {message.professionals.map((pro, proIndex) => (
                    <div key={proIndex} className="professional-card">
                      <h5>{pro.name}</h5>
                      {pro.services && pro.services.length > 0 && (
                        <p>Services: {pro.services.join(', ')}</p>
                      )}
                      {pro.serviceAreas && pro.serviceAreas.length > 0 && (
                        <p>Areas: {pro.serviceAreas.join(', ')}</p>
                      )}
                      {pro.rating != null && <p>Rating: {pro.rating}/5</p>}
                      {pro.phone && <p>Phone: {pro.phone}</p>}
                      {pro.website && (
                        <p>
                          Website:{' '}
                          <a href={pro.website} target="_blank" rel="noopener noreferrer">
                            {pro.website}
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {message.realtimeResults && message.realtimeResults.length > 0 && (
                <div className="realtime-results">
                  <h4>Live Web Results:</h4>
                  {message.realtimeResults.slice(0, 3).map((result, resultIndex) => (
                    <div
                      key={result.id || result.link || resultIndex}
                      className="realtime-result-card"
                    >
                      <h5>{result.title}</h5>
                      <p>Type: {formatResultType(result.type)}</p>
                      {result.snippet && <p>{result.snippet}</p>}
                      {result.link && (
                        <a href={result.link} target="_blank" rel="noopener noreferrer">
                          {result.displayLink || result.link}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
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
      {/* Input area with additional filters */}
      <div className="chat-input-area">
        {selectedImages.length > 0 && (
          <div className="selected-images">
            {selectedImages.map((img, index) => (
              <div key={index} className="selected-image">
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
            title={signedIn ? 'Upload a photo for analysis' : 'Sign in to enable photo analysis'}
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
    </div>
  );
};

export default ChatInterface;
