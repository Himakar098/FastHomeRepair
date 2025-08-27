'use client'

import React, { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'

type User = { id: string } | null

export default function HomePage() {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    // Initialize user session
    const userId = localStorage.getItem('userId') || generateUserId()
    localStorage.setItem('userId', userId)
    setUser({ id: userId })
  }, [])

  const generateUserId = () => {
    return 'user_' + Math.random().toString(36).substr(2, 9)
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return <ChatInterface user={user} />
}
