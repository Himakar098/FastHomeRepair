'use client'

import React, { useState, useEffect } from 'react'
import { User, Home, Calendar, Settings, MessageSquare, FileText } from 'lucide-react'

export default function UserProfile({ user }) {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    propertyType: 'house',
    yearBuilt: '',
    preferredContactMethod: 'email'
  })
  
  const [chatHistory, setChatHistory] = useState([])
  const [savedReports, setSavedReports] = useState([])
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadUserProfile()
      loadChatHistory()
      loadSavedReports()
    }
  }, [user])

  const loadUserProfile = () => {
    const savedProfile = localStorage.getItem(`profile_${user.id}`)
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile))
    }
  }

  const loadChatHistory = () => {
    const history = localStorage.getItem(`chatHistory_${user.id}`)
    if (history) {
      setChatHistory(JSON.parse(history))
    }
  }

  const loadSavedReports = () => {
    const reports = localStorage.getItem(`savedReports_${user.id}`)
    if (reports) {
      setSavedReports(JSON.parse(reports))
    }
  }

  const handleProfileUpdate = (field, value) => {
    const updatedProfile = { ...profile, [field]: value }
    setProfile(updatedProfile)
    localStorage.setItem(`profile_${user.id}`, JSON.stringify(updatedProfile))
  }

  const handleSave = () => {
    localStorage.setItem(`profile_${user.id}`, JSON.stringify(profile))
    setIsEditing(false)
    alert('Profile saved successfully!')
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearChatHistory = () => {
    if (window.confirm('Are you sure you want to clear your chat history? This cannot be undone.')) {
      setChatHistory([])
      localStorage.removeItem(`chatHistory_${user.id}`)
    }
  }

  if (!user) {
    return <div className="profile-loading">Loading profile...</div>
  }

  return (
    <div className="user-profile">
      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <User size={48} />
          </div>
          <div className="profile-info">
            <h2>{profile.name || 'Perth Homeowner'}</h2>
            <p className="user-id">User ID: {user.id}</p>
          </div>
          <button 
            className="edit-btn"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Settings size={20} />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* Profile Form */}
        <div className="profile-section">
          <h3><User size={20} /> Personal Information</h3>
          <div className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('name', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('email', e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('phone', e.target.value)}
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="form-group">
                <label>Preferred Contact Method</label>
                <select
                  value={profile.preferredContactMethod}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('preferredContactMethod', e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Property Information */}
        <div className="profile-section">
          <h3><Home size={20} /> Property Information</h3>
          <div className="profile-form">
            <div className="form-group">
              <label>Property Address</label>
              <textarea
                value={profile.address}
                disabled={!isEditing}
                onChange={(e) => handleProfileUpdate('address', e.target.value)}
                placeholder="Enter your property address"
                rows={2}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Property Type</label>
                <select
                  value={profile.propertyType}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('propertyType', e.target.value)}
                >
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="unit">Unit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year Built (approximate)</label>
                <input
                  type="number"
                  value={profile.yearBuilt}
                  disabled={!isEditing}
                  onChange={(e) => handleProfileUpdate('yearBuilt', e.target.value)}
                  placeholder="e.g., 1990"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          </div>
          
          {isEditing && (
            <div className="save-section">
              <button className="save-btn" onClick={handleSave}>
                Save Profile
              </button>
            </div>
          )}
        </div>

        {/* Chat History */}
        <div className="profile-section">
          <div className="section-header">
            <h3><MessageSquare size={20} /> Recent Conversations</h3>
            {chatHistory.length > 0 && (
              <button className="clear-btn" onClick={clearChatHistory}>
                Clear History
              </button>
            )}
          </div>
          <div className="chat-history">
            {chatHistory.length === 0 ? (
              <p className="no-data">No chat history yet. Start a conversation to see your history here.</p>
            ) : (
              <div className="history-list">
                {chatHistory.slice(-10).reverse().map((chat, index) => (
                  <div key={index} className="history-item">
                    <div className="history-date">
                      <Calendar size={16} />
                      {formatDate(chat.timestamp)}
                    </div>
                    <div className="history-preview">
                      {chat.message.substring(0, 100)}
                      {chat.message.length > 100 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Saved Reports */}
        <div className="profile-section">
          <h3><FileText size={20} /> Saved Reports & Recommendations</h3>
          <div className="saved-reports">
            {savedReports.length === 0 ? (
              <p className="no-data">No saved reports yet. Generate reports from your conversations to see them here.</p>
            ) : (
              <div className="reports-list">
                {savedReports.map((report, index) => (
                  <div key={index} className="report-item">
                    <div className="report-header">
                      <h4>{report.title}</h4>
                      <span className="report-date">{formatDate(report.timestamp)}</span>
                    </div>
                    <p className="report-summary">{report.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .user-profile {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .profile-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .profile-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .profile-avatar {
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          padding: 15px;
        }

        .profile-info h2 {
          margin: 0;
          font-size: 24px;
        }

        .user-id {
          margin: 5px 0 0 0;
          opacity: 0.8;
          font-size: 14px;
        }

        .edit-btn {
          margin-left: auto;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 10px 15px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .edit-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .profile-section {
          padding: 30px;
          border-bottom: 1px solid #eee;
        }

        .profile-section:last-child {
          border-bottom: none;
        }

        .profile-section h3 {
          margin: 0 0 20px 0;
          color: #333;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 8px;
          font-weight: 500;
          color: #555;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 12px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled,
        .form-group select:disabled,
        .form-group textarea:disabled {
          background-color: #f8f9fa;
          color: #666;
          cursor: not-allowed;
        }

        .save-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .save-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .save-btn:hover {
          background: #218838;
        }

        .clear-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }

        .clear-btn:hover {
          background: #c82333;
        }

        .chat-history,
        .saved-reports {
          min-height: 100px;
        }

        .no-data {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 40px 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .history-list,
        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .history-item,
        .report-item {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }

        .history-date {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }

        .history-preview {
          color: #333;
          line-height: 1.4;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .report-header h4 {
          margin: 0;
          color: #333;
        }

        .report-date {
          font-size: 12px;
          color: #666;
        }

        .report-summary {
          color: #555;
          line-height: 1.4;
          margin: 0;
        }

        .profile-loading {
          text-align: center;
          padding: 50px;
          color: #666;
        }

        @media (max-width: 768px) {
          .user-profile {
            padding: 10px;
          }

          .profile-header {
            padding: 20px;
            flex-direction: column;
            text-align: center;
          }

          .edit-btn {
            margin-left: 0;
            margin-top: 15px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .profile-section {
            padding: 20px;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  )
}