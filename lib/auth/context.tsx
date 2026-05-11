'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'

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
  profilePictureUrl: string | null
  // Loyalty fields
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number  // Points earned this year (for tier progression)
  totalSpent: number
  totalOrders: number
  annualSpend: number  // Legacy: dollars spent this year
  loyaltyTier: {
    id: string
    name: string
    slug: string
    description: string | null
    primaryColor: string
    secondaryColor: string
    minAnnualPoints: number   // Points required for this tier
    minAnnualSpend: number    // Legacy
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
  setUserData: (userData: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { data: session, status } = useSession()

  console.log('✅ AuthProvider component loaded')

  // Fetch full user data when NextAuth session changes
  useEffect(() => {
    console.log('✅ AuthProvider useEffect running, session status:', status)
    if (status === 'loading') return
    
    if (session?.user?.email) {
      // User is authenticated via NextAuth (OAuth or credentials)
      fetchCurrentUser()
    } else if (status === 'unauthenticated') {
      // Check cookie-based session (fallback for existing users)
      fetchCurrentUser()
    }
  }, [session, status])

  const fetchCurrentUser = async () => {
    try {
      console.log('🔐 Fetching current user...')
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
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
    // Sign out from both NextAuth and custom session
    await Promise.all([
      nextAuthSignOut({ redirect: false }),
      fetch('/api/auth/signout', { method: 'POST' })
    ])
    setUser(null)
  }

  const refreshUser = async () => {
    await fetchCurrentUser()
  }

  const setUserData = (userData: User) => {
    setUser(userData)
    setLoading(false)
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading: loading || status === 'loading', 
        signin, 
        signup, 
        signout, 
        refreshUser,
        setUserData 
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
