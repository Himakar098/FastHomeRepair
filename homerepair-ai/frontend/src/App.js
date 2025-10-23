// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatInterface from './components/ChatInterface.js';
import UserProfile from './components/UserProfile';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initialize user session
    const userId = localStorage.getItem('userId') || generateUserId();
    localStorage.setItem('userId', userId);
    setUser({ id: userId });
  }, []);

  const generateUserId = () => {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  };

  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <h1> Home Repair AI</h1>
          <p>Get instant expert advice for your home repairs</p>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<ChatInterface user={user} />} />
            <Route path="/profile" element={<UserProfile user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;