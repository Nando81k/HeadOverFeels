'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  isAdmin: boolean
  createdAt: Date
  // Loyalty fields
  currentPoints: number
  lifetimePoints: number
  totalSpent: number
  totalOrders: number
  loyaltyTier: {
    id: string
    name: string
    slug: string
    description: string | null
    minAnnualSpend: number
    pointMultiplier: number
    freeShipping: boolean
    earlyDropAccess: boolean
    perks: string | null
  } | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  signout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  console.log('✅ AuthProvider component loaded')

  // Fetch current user on mount
  useEffect(() => {
    console.log('✅ AuthProvider useEffect running')
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      console.log('🔐 Fetching current user...')
      const response = await fetch('/api/auth/me')
      console.log('🔐 Auth response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('🔐 User data:', data.data)
        setUser(data.data)
      } else {
        console.log('🔐 No user session')
        setUser(null)
      }
    } catch (error) {
      console.error('🔐 Failed to fetch current user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signin = async (email: string, password: string) => {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to sign in')
    }

    const data = await response.json()
    setUser(data.data)
  }

  const signup = async (email: string, password: string, name: string) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create account')
    }

    const data = await response.json()
    setUser(data.data)
  }

  const signout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    setUser(null)
  }

  const refreshUser = async () => {
    await fetchCurrentUser()
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        signin, 
        signup, 
        signout, 
        refreshUser 
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
