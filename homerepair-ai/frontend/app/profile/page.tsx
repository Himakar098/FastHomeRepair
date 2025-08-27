'use client'

import React, { useState, useEffect } from 'react'
import UserProfile from '../components/UserProfile'

type User = {
  id: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (userId) {
      setUser({ id: userId })
    }
  }, [])

  if (!user) {
    return <div>Loading...</div>
  }

  return <UserProfile user={user} />
}
