'use client'

import React, { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import { useAccessToken } from '../src/hooks/useAccessToken'

type User = { id: string; token?: string } | null

export default function HomePage() {
  const { isSignedIn, getToken } = useAccessToken();
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    // Initialize anonymous session ID regardless of auth
    const genId = () => 'user_' + Math.random().toString(36).substr(2, 9)
    const existingId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
    const userId = existingId || genId()
    if (!existingId && typeof window !== 'undefined') {
      localStorage.setItem('userId', userId)
    }
    async function initUser() {
      if (isSignedIn()) {
        try {
          const token = await getToken()
          setUser({ id: userId, token })
        } catch {
          setUser({ id: userId })
        }
      } else {
        setUser({ id: userId })
      }
    }
    initUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn()])

  if (!user) {
    return <div>Loading...</div>
  }
  return <ChatInterface user={user} />
}