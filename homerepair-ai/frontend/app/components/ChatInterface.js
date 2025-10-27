'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader } from 'lucide-react';
import axios from 'axios';
import { useAccessToken } from '../../src/hooks/useAccessToken';

/**
 * ChatInterface
 *
 * This component provides the main conversational UI for the Home Repair
 * assistant.  It extends the original version by collecting optional
 * metadata about the user's location, desired repair category and
 * budget.  These inputs are passed to the backend so that the
 * product matcher can return city‑specific recommendations.  The
 * component also aligns with the backend contract by rendering
 * products and professionals using the `link` field rather than the
 * deprecated `productUrl`, and by showing price ranges when
 * available.
 *
 * Props:
 *   user – an object containing at least `{ id }` and optionally a
 *           `token` property.  The token, if present, will be sent
 *           as a Bearer Authorization header to authenticated API
 *           endpoints.
 */
const ChatInterface = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [postcode, setPostcode] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { getToken } = useAccessToken();

  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:7071') + '/api';

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && selectedImages.length === 0) || !user) return;

    const messageToSend = inputMessage;
    const imagesToSend = [...selectedImages];

    setIsLoading(true);

    let token = null;
    try {
      token = await getToken();
    } catch (authErr) {
      console.error('Token acquisition failed:', authErr);
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Please sign in to continue the conversation.',
          timestamp: new Date().toISOString(),
          isError: true
        }
      ]);
      return;
    }

    const userMessage = {
      role: 'user',
      content: messageToSend,
      images: imagesToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      const body = {
        message: messageToSend,
        conversationId,
        userId: user.id,
        images: imagesToSend,
        category: category || undefined,
        maxPrice: budget ? Number(budget) : undefined,
        location: location || undefined,
        state: stateInput || undefined,
        postcode: postcode || undefined
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(`${API_BASE}/chat-handler`, body, { headers });
      const {
        response: aiResponse,
        conversationId: newConvId,
        products,
        professionals
      } = response.data;

      if (!conversationId) {
        setConversationId(newConvId);
      }

      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        products,
        professionals
      };
      setMessages(prev => [...prev, assistantMessage]);
      setSelectedImages([]);
    } catch (error) {
      console.error('Chat error:', error);
      const fallback =
        error?.response?.status === 401
          ? 'Your session expired. Please sign in again.'
          : 'Sorry, I encountered an error. Please try again.';
      const errorMessage = {
        role: 'assistant',
        content: fallback,
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

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome! I am your Home Assistant!</h2>
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
                {message.content}
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
        {/* Extra filter inputs */}
        <div className="filters">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Suburb or City (optional)"
            className="filter-input"
          />
          <input
            type="text"
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value)}
            placeholder="State (optional)"
            className="filter-input"
          />
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Postcode (optional)"
            className="filter-input"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. cleaning, plumbing)"
            className="filter-input"
          />
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Max budget (optional)"
            className="filter-input"
          />
        </div>
        <div className="input-controls">
          <button
            className="image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
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
