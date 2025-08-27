'use client'

import Link from 'next/link'

export default function Navigation() {
  return (
    <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
      <Link href="/" style={{ marginRight: '1rem', textDecoration: 'none' }}>
        Chat
      </Link>
      <Link href="/profile" style={{ textDecoration: 'none' }}>
        Profile
      </Link>
    </nav>
  )
}
