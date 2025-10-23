// src/components/ChatInterface.js
import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, Loader } from 'lucide-react';
import axios from 'axios';

const ChatInterface = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:7071') + '/api';
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
      const response = await axios.post(`${API_BASE}/chat-handler`, {
        message: inputMessage,
        conversationId,
        userId: user.id,
        images: selectedImages
      });

      const { response: aiResponse, conversationId: newConvId, products, professionals } = response.data;

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

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome to Home Repair AI!</h2>
            <p>Describe your home repair problem or upload photos, and I'll help you find the best solution.</p>
            <div className="example-questions">
              <h3>Try asking:</h3>
              <ul>
                <li>"My oven has stubborn stains, how can I clean it?"</li>
                <li>"There's a small hole in my wall, can I fix it myself?"</li>
                <li>"My kitchen benchtop is damaged, what are my options?"</li>
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
                      <p>Price: ${product.price}</p>
                      <p>Available at: {product.supplier}</p>
                      {product.productUrl && (
                        <a href={product.productUrl} target="_blank" rel="noopener noreferrer">
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
                      <p>Rating: {pro.rating}/5</p>
                      <p>Price Range: ${pro.priceRange}</p>
                      <p>Contact: {pro.contactInfo.phone}</p>
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

      <div className="chat-input-area">
        {selectedImages.length > 0 && (
          <div className="selected-images">
            {selectedImages.map((img, index) => (
              <div key={index} className="selected-image">
                <img src={img.dataUrl} alt={img.name} />
                <button onClick={() => removeImage(index)} className="remove-image">×</button>
              </div>
            ))}
          </div>
        )}

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