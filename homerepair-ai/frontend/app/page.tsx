'use client'

import React, { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'

type User = { id: string } | null

export default function HomePage() {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    const genId = () => 'user_' + Math.random().toString(36).substr(2, 9)
    const existingId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
    const userId = existingId || genId()
    if (!existingId && typeof window !== 'undefined') {
      localStorage.setItem('userId', userId)
    }
    setUser({ id: userId })
  }, [])

  if (!user) {
    return <div>Loading...</div>
  }

  return <ChatInterface user={user} />
}
